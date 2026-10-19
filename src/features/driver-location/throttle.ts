import { DRIVER_LOCATION_CONFIG, type DriverLocationConfig } from './config';
import type { DriverLocationBody } from './api';

/** One position from the device watcher. Values the device did not give are null. */
export interface LocationFix {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  timestamp: number;
  /**
   * T-587 (SEC-33): the OS flagged the position as simulated (Android `isFromMockProvider`,
   * iOS 15+ `sourceInformation.isSimulatedBySoftware`). Undefined when the device did not say.
   */
  mocked?: boolean;
}

/** What the server last accepted, and when (epoch ms). */
export interface LastPostedLocation {
  latitude: number;
  longitude: number;
  at: number;
}

interface LatLng {
  latitude: number;
  longitude: number;
}

/** Device position shape (GeolocationResponse of @react-native-community/geolocation). */
export interface DevicePosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
  };
  timestamp?: number;
  /** Top-level flag set by the native module on both platforms (see LocationFix.mocked). */
  mocked?: boolean;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in metres (haversine). */
export const distanceMeters = (a: LatLng, b: LatLng): number => {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

/**
 * Whether the latest fix should be posted now:
 * - nothing posted yet: post;
 * - less than `minPostIntervalMs` since the last post: wait (never faster than the minimum);
 * - `heartbeatMs` or more since the last post: post, even without movement;
 * - otherwise post only when the driver moved more than `minMoveMeters`.
 */
export const shouldPostLocation = (
  fix: LocationFix | null,
  last: LastPostedLocation | null,
  now: number,
  config: DriverLocationConfig = DRIVER_LOCATION_CONFIG,
): boolean => {
  if (!fix) return false;
  if (!last) return true;
  const elapsed = now - last.at;
  if (elapsed < config.minPostIntervalMs) return false;
  if (elapsed >= config.heartbeatMs) return true;
  return distanceMeters(last, fix) > config.minMoveMeters;
};

const finiteOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** The device position as a fix; null when it has no usable coordinate. */
export const toLocationFix = (position: DevicePosition, now: number): LocationFix | null => {
  const latitude = finiteOrNull(position.coords?.latitude);
  const longitude = finiteOrNull(position.coords?.longitude);
  if (latitude === null || longitude === null) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const fix: LocationFix = {
    latitude,
    longitude,
    heading: finiteOrNull(position.coords.heading),
    speed: finiteOrNull(position.coords.speed),
    accuracy: finiteOrNull(position.coords.accuracy),
    timestamp: finiteOrNull(position.timestamp) ?? now,
  };
  if (typeof position.mocked === 'boolean') fix.mocked = position.mocked;
  return fix;
};

/**
 * Below this speed (m/s, ~4 km/h) the device course is noise: Android reports 0 (north) for a
 * standing driver, which would turn the passenger's vehicle marker at every stop (T-517).
 */
export const MIN_HEADING_SPEED_MPS = 1;

/** The device reports a speed (not iOS's -1 "unknown") and it is too slow for a real course. */
const tooSlowForHeading = (fix: LocationFix): boolean =>
  fix.speed !== null && fix.speed >= 0 && fix.speed < MIN_HEADING_SPEED_MPS;

/**
 * The POST body: numbers only, raw device values (speed in m/s, iOS -1 included); a value the
 * device did not give is left out, and so is the heading while standing still (T-517). Never
 * `driver_id` or `status`. `is_mocked` goes with every ping whose device said (T-587).
 */
export const toLocationBody = (fix: LocationFix): DriverLocationBody => {
  const body: DriverLocationBody = { latitude: fix.latitude, longitude: fix.longitude };
  if (fix.heading !== null && !tooSlowForHeading(fix)) body.heading = fix.heading;
  if (fix.speed !== null) body.speed = fix.speed;
  if (fix.accuracy !== null) body.accuracy = fix.accuracy;
  // T-587 (BE-120): the server stops auto-assigning for the session after a simulated ping.
  if (fix.mocked !== undefined) body.is_mocked = fix.mocked;
  return body;
};
