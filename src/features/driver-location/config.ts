/**
 * Tuning of the driver location tracker (T-402) while the driver is online without a ride.
 * POST /tracking/update-location allows 60 requests a minute (BE-06); these values stay far
 * below that.
 *
 * T-537 (PERF-21): an online driver waiting for a request does not need 5 s / 10 m precision.
 * The server treats a position as current for 5 minutes (rides.pending.location_max_age_minutes,
 * the nearby-drivers search, BE-20), and the 30 s heartbeat keeps it well inside that, so
 * online-idle posts at most every 10 s on a 25 m move. The ride cadence below is unchanged.
 */
export const DRIVER_LOCATION_CONFIG = {
  /** Never two posts closer together than this; also the tracker's tick. */
  minPostIntervalMs: 10_000,
  /** A driver who has not moved still posts this often, so the server keeps seeing them. */
  heartbeatMs: 30_000,
  /** Movement below this (metres) does not count as moving. */
  minMoveMeters: 25,
  /** Wait after a 429 that carries no `retry_after`. */
  rateLimitBackoffMs: 60_000,
  /**
   * Before "I've arrived", a last post older than this is refreshed with one post first, so
   * the server's arrival check (BE-64) judges where the driver is now (T-409).
   */
  arrivalPingMaxAgeMs: 20_000,
  /**
   * While tracking, no new fix for this long restarts the device watcher once (T-410). A
   * restart delivers a fresh fix at once, so a driver standing still is refreshed too.
   */
  watchRestartAfterMs: 60_000,
  /**
   * A fix older than this is never posted (heartbeat or arrival ping): the server must not
   * see a frozen position as the driver's current one (T-410). Above `watchRestartAfterMs`,
   * so a healthy watcher always has a fix this fresh.
   */
  maxFixAgeMs: 90_000,
} as const;

/**
 * T-517: the cadence while the driver has a ride in progress (accepted → started) and the app
 * is in the foreground, so the passenger's vehicle marker gets a new position about every 4 s
 * (the passenger reads at the same pace, DRIVER_LOCATION_POLL_MS). 15 posts a minute stay well
 * inside POST /tracking/update-location's 60/min and the API group's 120/min per user. Outside a
 * ride the normal cadence above applies.
 */
export const DRIVER_LOCATION_RIDE_CONFIG = {
  ...DRIVER_LOCATION_CONFIG,
  minPostIntervalMs: 4_000,
  /** Small moves still count on a ride (stop-and-go traffic), above GPS jitter. */
  minMoveMeters: 5,
} as const;

export interface DriverLocationConfig {
  minPostIntervalMs: number;
  heartbeatMs: number;
  minMoveMeters: number;
  rateLimitBackoffMs: number;
}

/**
 * Options of the one foreground watcher (@react-native-community/geolocation watchPosition)
 * while the driver is online without a ride. High accuracy stays on: matching and the pickup
 * ETA use this position.
 */
export const DRIVER_LOCATION_WATCH_OPTIONS = {
  // Kept on while online idle (not balanced/network): request matching and the pickup ETA use this fix.
  enableHighAccuracy: true,
  distanceFilter: DRIVER_LOCATION_CONFIG.minMoveMeters,
  interval: DRIVER_LOCATION_CONFIG.minPostIntervalMs,
  fastestInterval: DRIVER_LOCATION_CONFIG.minPostIntervalMs,
  maximumAge: DRIVER_LOCATION_CONFIG.minPostIntervalMs,
} as const;

/**
 * T-517: the watcher on a ride. Fixes arrive more often than posts (Android every 2 s, iOS per
 * 5 m), so the driver's own vehicle marker moves smoothly and each post has a fresh fix.
 */
export const DRIVER_LOCATION_RIDE_WATCH_OPTIONS = {
  enableHighAccuracy: true,
  distanceFilter: DRIVER_LOCATION_RIDE_CONFIG.minMoveMeters,
  interval: 2_000,
  fastestInterval: 1_000,
  maximumAge: 2_000,
} as const;

/**
 * T-537 (PERF-20): the watcher while only a screen holds it (the Drive map of an offline
 * driver, T-410). Nothing is posted then, so the device may use its low-power mode: about
 * 100 m accuracy on iOS, the network provider on Android, a new fix per 50 m or 15 s. Still a
 * watch, not a one-shot read: on iOS `getCurrentPosition` during a watch ends that watch.
 */
export const DRIVER_LOCATION_LOW_POWER_WATCH_OPTIONS = {
  enableHighAccuracy: false,
  distanceFilter: 50,
  interval: 15_000,
  fastestInterval: 15_000,
  maximumAge: 15_000,
} as const;
