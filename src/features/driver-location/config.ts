/**
 * Tuning of the driver location tracker (T-402). POST /tracking/update-location allows 60
 * requests a minute (BE-06); these values stay far below that.
 */
export const DRIVER_LOCATION_CONFIG = {
  /** Never two posts closer together than this; also the tracker's tick. */
  minPostIntervalMs: 5_000,
  /** A driver who has not moved still posts this often, so the server keeps seeing them. */
  heartbeatMs: 30_000,
  /** Movement below this (metres) does not count as moving. */
  minMoveMeters: 10,
  /** Wait after a 429 that carries no `retry_after`. */
  rateLimitBackoffMs: 60_000,
  /**
   * Before "I've arrived", a last post older than this is refreshed with one post first, so
   * the server's arrival check (BE-64) judges where the driver is now (T-409).
   */
  arrivalPingMaxAgeMs: 20_000,
} as const;

export interface DriverLocationConfig {
  minPostIntervalMs: number;
  heartbeatMs: number;
  minMoveMeters: number;
  rateLimitBackoffMs: number;
}

/** Options of the one foreground watcher (@react-native-community/geolocation watchPosition). */
export const DRIVER_LOCATION_WATCH_OPTIONS = {
  enableHighAccuracy: true,
  distanceFilter: DRIVER_LOCATION_CONFIG.minMoveMeters,
  interval: DRIVER_LOCATION_CONFIG.minPostIntervalMs,
  fastestInterval: DRIVER_LOCATION_CONFIG.minPostIntervalMs,
  maximumAge: DRIVER_LOCATION_CONFIG.minPostIntervalMs,
} as const;
