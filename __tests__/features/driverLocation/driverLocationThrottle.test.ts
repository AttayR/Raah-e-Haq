/**
 * T-402: the throttle of POST /tracking/update-location and the body it sends (BE-06).
 */
import {
  distanceMeters,
  shouldPostLocation,
  toLocationBody,
  toLocationFix,
  type LocationFix,
} from '../../../src/features/driver-location/throttle';
import { DRIVER_LOCATION_CONFIG } from '../../../src/features/driver-location/config';

const { minPostIntervalMs, heartbeatMs, minMoveMeters } = DRIVER_LOCATION_CONFIG;

const fix = (overrides: Partial<LocationFix> = {}): LocationFix => ({
  latitude: 31.5204,
  longitude: 74.3587,
  heading: null,
  speed: null,
  accuracy: null,
  timestamp: 0,
  ...overrides,
});

/** About `metres` north of the base fix (1 degree of latitude is about 111,195 m). */
const north = (metres: number): LocationFix => fix({ latitude: 31.5204 + metres / 111_195 });

const T0 = 1_000_000;
const posted = { latitude: 31.5204, longitude: 74.3587, at: T0 };

describe('distanceMeters', () => {
  it('measures metres between two points', () => {
    expect(distanceMeters(fix(), north(100))).toBeCloseTo(100, 0);
    expect(distanceMeters(fix(), fix())).toBe(0);
  });
});

describe('shouldPostLocation', () => {
  it('posts the first fix at once, and never without a fix', () => {
    expect(shouldPostLocation(fix(), null, T0)).toBe(true);
    expect(shouldPostLocation(null, null, T0)).toBe(false);
  });

  it('never posts again before the minimum interval, even after a large move', () => {
    expect(shouldPostLocation(north(500), posted, T0 + minPostIntervalMs - 1)).toBe(false);
  });

  it('posts after the minimum interval when the driver moved more than the threshold', () => {
    expect(shouldPostLocation(north(minMoveMeters * 2), posted, T0 + minPostIntervalMs)).toBe(true);
  });

  it('skips a post when the driver has not moved and the last post is recent', () => {
    expect(shouldPostLocation(north(minMoveMeters / 2), posted, T0 + minPostIntervalMs)).toBe(false);
    expect(shouldPostLocation(fix(), posted, T0 + heartbeatMs - 1)).toBe(false);
  });

  it('posts a stationary driver once the heartbeat interval has passed', () => {
    expect(shouldPostLocation(fix(), posted, T0 + heartbeatMs)).toBe(true);
  });
});

describe('toLocationBody', () => {
  it('sends numbers only, raw device values included (iOS -1), never driver_id or status', () => {
    const body = toLocationBody(fix({ heading: -1, speed: -1, accuracy: 5 }));
    expect(body).toEqual({ latitude: 31.5204, longitude: 74.3587, heading: -1, speed: -1, accuracy: 5 });
    expect(body).not.toHaveProperty('status');
    expect(body).not.toHaveProperty('driver_id');
  });

  it('leaves out values the device did not give', () => {
    expect(toLocationBody(fix())).toEqual({ latitude: 31.5204, longitude: 74.3587 });
  });
});

describe('toLocationFix', () => {
  it('reads the device position', () => {
    expect(
      toLocationFix({ coords: { latitude: 1, longitude: 2, accuracy: 3, heading: 4, speed: 5 }, timestamp: 9 }, 0),
    ).toEqual({ latitude: 1, longitude: 2, accuracy: 3, heading: 4, speed: 5, timestamp: 9 });
  });

  it('drops a position without a usable coordinate', () => {
    expect(toLocationFix({ coords: { latitude: Number.NaN, longitude: 2 } }, 0)).toBeNull();
    expect(toLocationFix({ coords: { latitude: 91, longitude: 2 } }, 0)).toBeNull();
  });
});
