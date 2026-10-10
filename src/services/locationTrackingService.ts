import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation, { type GeolocationError } from '@react-native-community/geolocation';
import rideService, { type DriverLocation } from './rideService';
import { isApiError } from '../core/api/errors';
import { logger } from '../core/logging/logger';
import { DRIVER_LOCATION_CODES, driverLocationApi } from '../features/driver-location/api';
import {
  DRIVER_LOCATION_CONFIG,
  DRIVER_LOCATION_WATCH_OPTIONS,
} from '../features/driver-location/config';
import { DRIVER_LOCATION_COPY } from '../features/driver-location/copy';
import {
  shouldPostLocation,
  toLocationBody,
  toLocationFix,
  type DevicePosition,
  type LastPostedLocation,
  type LocationFix,
} from '../features/driver-location/throttle';

export type { LocationFix } from '../features/driver-location/throttle';

export interface TrackingOptions {
  /** Called after the server answered 409 DRIVER_OFFLINE (tracking has already stopped). */
  onDriverOffline?: () => void;
}

/**
 * Foreground-only location permission (B-08: no background location). iOS asks "while using"
 * on the first watch (authorizationLevel whenInUse); Android asks for fine location here.
 * The full permission UX (rationale screen, settings link) is T-308.
 */
const requestForegroundPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }
  try {
    const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
    if ((await PermissionsAndroid.check(fine)) || (await PermissionsAndroid.check(coarse))) {
      return true;
    }
    const result = await PermissionsAndroid.request(fine, {
      title: DRIVER_LOCATION_COPY.permissionTitle,
      message: DRIVER_LOCATION_COPY.permissionMessage,
      buttonPositive: DRIVER_LOCATION_COPY.permissionAllow,
      buttonNegative: DRIVER_LOCATION_COPY.permissionDeny,
    });
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    logger.warn('Location permission check failed', { error });
    return false;
  }
};

/**
 * The driver's one location tracker (T-402, DRV-03/09/10/18).
 *
 * - One device watcher (`watchPosition`) and one timer, both owned here. Starting twice is a
 *   no-op; `stopTracking` clears both. Nothing runs in the background: the caller
 *   (useDriverLocationTracking) stops it when the app leaves the foreground.
 * - Posts POST /tracking/update-location at most every `minPostIntervalMs`, and skips a post
 *   when the driver moved less than `minMoveMeters` and the last post is under `heartbeatMs` old.
 * - 409 DRIVER_OFFLINE: stops, then calls `onDriverOffline` (the caller reloads the status).
 *   403: stops. 429: waits `retry_after`. Other failures are retried on the next tick.
 * - Every async answer carries the run's generation, so nothing from a stopped run (or a
 *   previous session, after logout's `reset`) can post or restart anything.
 */
class LocationTrackingService {
  private active = false;
  private generation = 0;
  private watchId: number | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastLocation: LocationFix | null = null;
  private lastPost: LastPostedLocation | null = null;
  private inFlight = false;
  private blockedUntil = 0;
  private onDriverOffline: (() => void) | undefined;
  private listeners: Set<(location: LocationFix) => void> = new Set();

  /** Starts the watcher and the post timer. Resolves false when permission was refused or it was stopped meanwhile. */
  async startTracking(options: TrackingOptions = {}): Promise<boolean> {
    this.onDriverOffline = options.onDriverOffline;
    if (this.active) {
      return true;
    }
    this.active = true;
    const generation = ++this.generation;

    try {
      Geolocation.setRNConfiguration({
        skipPermissionRequests: false,
        authorizationLevel: 'whenInUse',
        enableBackgroundLocationUpdates: false,
      });
      const granted = await requestForegroundPermission();
      if (generation !== this.generation) {
        return false;
      }
      if (!granted) {
        logger.warn('Driver location: permission not granted');
        this.stopTracking();
        return false;
      }

      this.watchId = Geolocation.watchPosition(
        (position) => this.handlePosition(generation, position),
        (error) => this.handleWatchError(generation, error),
        DRIVER_LOCATION_WATCH_OPTIONS,
      );
      this.timer = setInterval(() => {
        this.flush(generation);
      }, DRIVER_LOCATION_CONFIG.minPostIntervalMs);
      return true;
    } catch (error) {
      logger.warn('Driver location: could not start the watcher', { error });
      if (generation === this.generation) {
        this.stopTracking();
      }
      return false;
    }
  }

  /** Clears the watcher and the timer. The next start posts at once. */
  stopTracking(): void {
    this.generation += 1;
    this.active = false;
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.inFlight = false;
    this.blockedUntil = 0;
    this.lastPost = null;
    this.onDriverOffline = undefined;
  }

  /**
   * Back to the signed-out state (called by logout, T-104): stops tracking and forgets the
   * last position and the listeners, so nothing of one user's session reaches the next one.
   */
  reset(): void {
    this.stopTracking();
    this.lastLocation = null;
    this.listeners.clear();
  }

  getTrackingStatus(): boolean {
    return this.active;
  }

  getLastLocation(): LocationFix | null {
    return this.lastLocation;
  }

  /** Positions from the shared watcher while tracking runs. Returns the unsubscribe function. */
  addLocationListener(listener: (location: LocationFix) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // The backend route is GET /tracking/driver/{id}/latest; 403 unless there is an active ride (BE-20).
  async getDriverLocation(driverId: number): Promise<DriverLocation | null> {
    return rideService.getDriverLocation(driverId);
  }

  private handlePosition(generation: number, position: DevicePosition): void {
    if (generation !== this.generation) return;
    const fix = toLocationFix(position, Date.now());
    if (!fix) return;
    this.lastLocation = fix;
    this.listeners.forEach((listener) => {
      try {
        listener(fix);
      } catch (error) {
        logger.warn('Driver location listener failed', { error });
      }
    });
    this.flush(generation);
  }

  private handleWatchError(generation: number, error: GeolocationError): void {
    if (generation !== this.generation) return;
    logger.warn('Driver location watcher error', { code: error.code });
    if (error.code === error.PERMISSION_DENIED) {
      this.stopTracking();
    }
  }

  /** Posts the latest fix when the throttle allows it. One request at a time. */
  private flush(generation: number): void {
    if (generation !== this.generation || this.inFlight) return;
    const now = Date.now();
    if (now < this.blockedUntil) return;
    const fix = this.lastLocation;
    if (!fix || !shouldPostLocation(fix, this.lastPost, now)) return;

    this.inFlight = true;
    driverLocationApi
      .post(toLocationBody(fix))
      .then(() => {
        if (generation !== this.generation) return;
        this.lastPost = { latitude: fix.latitude, longitude: fix.longitude, at: now };
      })
      .catch((error: unknown) => {
        if (generation !== this.generation) return;
        this.handlePostError(error, now);
      })
      .finally(() => {
        if (generation === this.generation) {
          this.inFlight = false;
        }
      });
  }

  private handlePostError(error: unknown, now: number): void {
    if (!isApiError(error)) {
      logger.warn('Driver location post failed');
      return;
    }
    if (error.status === 409 && error.code === DRIVER_LOCATION_CODES.driverOffline) {
      const onDriverOffline = this.onDriverOffline;
      this.stopTracking();
      onDriverOffline?.();
      return;
    }
    if (error.status === 403) {
      logger.warn('Driver location refused', { status: error.status, code: error.code });
      this.stopTracking();
      return;
    }
    if (error.status === 429) {
      this.blockedUntil =
        now + (error.retryAfter ? error.retryAfter * 1000 : DRIVER_LOCATION_CONFIG.rateLimitBackoffMs);
      return;
    }
    logger.warn('Driver location post failed', { kind: error.kind, status: error.status });
  }
}

// One instance for the whole app.
const locationTrackingService = new LocationTrackingService();

export default locationTrackingService;
