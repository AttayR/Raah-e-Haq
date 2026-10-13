import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation, { type GeolocationError } from '@react-native-community/geolocation';
import rideService, { type DriverLocation } from './rideService';
import { isApiError } from '../core/api/errors';
import { logger } from '../core/logging/logger';
import { DRIVER_LOCATION_CODES, driverLocationApi } from '../features/driver-location/api';
import {
  DRIVER_LOCATION_CONFIG,
  DRIVER_LOCATION_RIDE_CONFIG,
  DRIVER_LOCATION_RIDE_WATCH_OPTIONS,
  DRIVER_LOCATION_WATCH_OPTIONS,
  type DriverLocationConfig,
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
 * - The app's only device watcher (`watchPosition`), owned here (T-410). Tracking holds it, and
 *   a screen that needs positions while not tracking holds it with `acquireLocationWatch`; it
 *   runs while anyone holds it and nothing else may start or stop a native watch. On iOS a
 *   `getCurrentPosition` while a watch runs ends that watch (patched in patches/, but driver
 *   screens read positions from here instead of asking the device themselves).
 * - One post timer while tracking; starting twice is a no-op, `stopTracking` clears it. Nothing
 *   runs in the background: the callers stop when the app leaves the foreground.
 * - Posts POST /tracking/update-location at most every `minPostIntervalMs`, and skips a post
 *   when the driver moved less than `minMoveMeters` and the last post is under `heartbeatMs` old.
 *   A fix older than `maxFixAgeMs` is never posted, so a frozen position is not sent as fresh.
 * - Self-heal (T-410): while tracking, no new fix for `watchRestartAfterMs` restarts the watcher
 *   once; the next restart needs another full silent window.
 * - 409 DRIVER_OFFLINE: stops, then calls `onDriverOffline` (the caller reloads the status).
 *   403: stops. 429: waits `retry_after`. Other failures are retried on the next tick.
 * - Every async answer carries the run's generation, so nothing from a stopped run (or a
 *   previous session, after logout's `reset`) can post or restart anything.
 * - Ride cadence (T-517, `setRideCadence`): while the driver has a ride in progress the tick is
 *   DRIVER_LOCATION_RIDE_CONFIG (every 4 s, 5 m) and the watcher reports more often; the timer
 *   and the watcher are restarted only when the cadence actually changes.
 */
class LocationTrackingService {
  private active = false;
  private generation = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastLocation: LocationFix | null = null;
  private lastPost: LastPostedLocation | null = null;
  private inFlight: Promise<void> | null = null;
  private blockedUntil = 0;
  private onDriverOffline: (() => void) | undefined;
  private listeners: Set<(location: LocationFix) => void> = new Set();

  // The shared device watcher.
  private watchId: number | null = null;
  private watchGeneration = 0;
  /** Tracking holds the watcher (set once permission was granted). */
  private trackingHoldsWatch = false;
  /** Holders through `acquireLocationWatch` whose permission step succeeded. */
  private watchRefs = 0;
  /** Bumped by `reset`, so a holder from a previous session cannot release a new one's hold. */
  private session = 0;
  /** When the device last delivered a fix, or the watcher (re)started (epoch ms). */
  private lastSignAt = 0;
  /** When the device last delivered a fix (epoch ms); 0 before the first one. */
  private lastFixAt = 0;
  /** T-517: a ride is in progress, so post (and watch) at the ride cadence. */
  private rideCadence = false;

  /** Starts the watcher and the post timer. Resolves false when permission was refused or it was stopped meanwhile. */
  async startTracking(options: TrackingOptions = {}): Promise<boolean> {
    this.onDriverOffline = options.onDriverOffline;
    if (this.active) {
      return true;
    }
    this.active = true;
    const generation = ++this.generation;

    try {
      const granted = await this.preparePermission();
      if (generation !== this.generation) {
        return false;
      }
      if (!granted) {
        logger.warn('Driver location: permission not granted');
        this.stopTracking();
        return false;
      }

      this.trackingHoldsWatch = true;
      this.syncWatch();
      this.startTimer(generation);
      // A watcher already held by a screen may have a fix to post now, or be silent already.
      this.tick(generation);
      return true;
    } catch (error) {
      logger.warn('Driver location: could not start the watcher', { error });
      if (generation === this.generation) {
        this.stopTracking();
      }
      return false;
    }
  }

  /**
   * T-517: switch between the normal and the ride cadence (a ride in progress, accepted →
   * started). A no-op when unchanged; otherwise a running post timer and watcher restart with
   * the new interval and options.
   */
  setRideCadence(onRide: boolean): void {
    if (this.rideCadence === onRide) return;
    this.rideCadence = onRide;
    if (this.active && this.timer !== null) {
      this.startTimer(this.generation);
    }
    if (this.watchId !== null) {
      this.stopWatch();
      this.startWatch();
    }
  }

  getRideCadence(): boolean {
    return this.rideCadence;
  }

  /** Stops posting and releases tracking's hold on the watcher. The next start posts at once. */
  stopTracking(): void {
    this.generation += 1;
    this.active = false;
    this.trackingHoldsWatch = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.syncWatch();
    this.inFlight = null;
    this.blockedUntil = 0;
    this.lastPost = null;
    this.onDriverOffline = undefined;
  }

  /**
   * Holds the shared watcher without posting (T-410), for a screen that shows the driver's
   * position while tracking may be off (the driver map when offline). Returns the release
   * function; calling it more than once is harmless. Positions arrive through
   * `addLocationListener` / `getLastLocation`.
   */
  acquireLocationWatch(): () => void {
    const session = this.session;
    let released = false;
    let counted = false;
    this.preparePermission()
      .then((granted) => {
        if (released || session !== this.session || !granted) return;
        counted = true;
        this.watchRefs += 1;
        this.syncWatch();
      })
      .catch((error: unknown) => {
        logger.warn('Driver location: could not hold the watcher', { error });
      });
    return () => {
      if (released) return;
      released = true;
      if (!counted || session !== this.session) return;
      this.watchRefs = Math.max(0, this.watchRefs - 1);
      this.syncWatch();
    };
  }

  /**
   * Back to the signed-out state (called by logout, T-104): stops tracking and the watcher and
   * forgets the last position and the listeners, so nothing of one user's session reaches the
   * next one.
   */
  reset(): void {
    this.session += 1;
    this.watchRefs = 0;
    this.stopTracking();
    this.lastLocation = null;
    this.lastFixAt = 0;
    this.rideCadence = false;
    this.listeners.clear();
  }

  /**
   * One extra post when the server's copy may be old (T-409, before POST /rides/{id}/arrived):
   * if tracking runs, has a fresh fix, and the last accepted post is older than `maxAgeMs` (or
   * there is none), the latest fix is posted now, ignoring the movement throttle (a 429 wait is
   * still honoured). A post already in flight is awaited instead. Never throws, never loops:
   * failures go through the usual handling and the caller carries on.
   */
  async pingIfStale(maxAgeMs: number): Promise<void> {
    if (this.inFlight) {
      await this.inFlight;
      return;
    }
    if (!this.active) return;
    const now = Date.now();
    if (now < this.blockedUntil) return;
    const fix = this.lastLocation;
    if (!fix || !this.isFixFresh(now)) return;
    if (this.lastPost && now - this.lastPost.at < maxAgeMs) return;
    await this.post(this.generation, fix, now);
  }

  getTrackingStatus(): boolean {
    return this.active;
  }

  getLastLocation(): LocationFix | null {
    return this.lastLocation;
  }

  /** Positions from the shared watcher while it runs. Returns the unsubscribe function. */
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

  /** Foreground-only configuration and permission, shared by every holder of the watcher. */
  private async preparePermission(): Promise<boolean> {
    Geolocation.setRNConfiguration({
      skipPermissionRequests: false,
      authorizationLevel: 'whenInUse',
      enableBackgroundLocationUpdates: false,
    });
    return requestForegroundPermission();
  }

  private config(): DriverLocationConfig {
    return this.rideCadence ? DRIVER_LOCATION_RIDE_CONFIG : DRIVER_LOCATION_CONFIG;
  }

  /** (Re)starts the one post timer at the current cadence. */
  private startTimer(generation: number): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.tick(generation);
    }, this.config().minPostIntervalMs);
  }

  /** Runs the device watcher exactly while someone holds it. */
  private syncWatch(): void {
    const wanted = this.trackingHoldsWatch || this.watchRefs > 0;
    if (wanted && this.watchId === null) {
      this.startWatch();
    } else if (!wanted && this.watchId !== null) {
      this.stopWatch();
    }
  }

  private startWatch(): void {
    const watchGeneration = ++this.watchGeneration;
    this.lastSignAt = Date.now();
    this.watchId = Geolocation.watchPosition(
      (position) => this.handlePosition(watchGeneration, position),
      (error) => this.handleWatchError(watchGeneration, error),
      this.rideCadence ? DRIVER_LOCATION_RIDE_WATCH_OPTIONS : DRIVER_LOCATION_WATCH_OPTIONS,
    );
  }

  private stopWatch(): void {
    this.watchGeneration += 1;
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /** The post timer: self-heal a silent watcher, then post when the throttle allows it. */
  private tick(generation: number): void {
    if (generation !== this.generation) return;
    const now = Date.now();
    const silentForMs = now - this.lastSignAt;
    if (this.watchId !== null && silentForMs > DRIVER_LOCATION_CONFIG.watchRestartAfterMs) {
      logger.warn('Driver location: no new fix, restarting the watcher', { silentForMs });
      this.stopWatch();
      this.startWatch();
    }
    this.flush(generation);
  }

  private isFixFresh(now: number): boolean {
    return this.lastFixAt > 0 && now - this.lastFixAt < DRIVER_LOCATION_CONFIG.maxFixAgeMs;
  }

  private handlePosition(watchGeneration: number, position: DevicePosition): void {
    if (watchGeneration !== this.watchGeneration) return;
    const now = Date.now();
    const fix = toLocationFix(position, now);
    if (!fix) return;
    this.lastLocation = fix;
    this.lastFixAt = now;
    this.lastSignAt = now;
    this.listeners.forEach((listener) => {
      try {
        listener(fix);
      } catch (error) {
        logger.warn('Driver location listener failed', { error });
      }
    });
    if (this.active) {
      this.flush(this.generation);
    }
  }

  private handleWatchError(watchGeneration: number, error: GeolocationError): void {
    if (watchGeneration !== this.watchGeneration) return;
    logger.warn('Driver location watcher error', { code: error.code });
    if (error.code === error.PERMISSION_DENIED) {
      this.watchRefs = 0;
      this.stopTracking();
    }
  }

  /** Posts the latest fix when the throttle allows it and the fix is fresh. One request at a time. */
  private flush(generation: number): void {
    if (generation !== this.generation || this.inFlight) return;
    const now = Date.now();
    if (now < this.blockedUntil) return;
    const fix = this.lastLocation;
    if (!fix || !this.isFixFresh(now) || !shouldPostLocation(fix, this.lastPost, now, this.config())) return;
    this.post(generation, fix, now);
  }

  /** Posts `fix`; resolves (never rejects) once the answer was handled. One request at a time. */
  private post(generation: number, fix: LocationFix, now: number): Promise<void> {
    const request = driverLocationApi
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
        if (generation === this.generation && this.inFlight === request) {
          this.inFlight = null;
        }
      });
    this.inFlight = request;
    return request;
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
