/**
 * T-402: the one driver location tracker (DRV-03/09/10/18): one watcher and one timer, the
 * throttled POST /tracking/update-location, 409 DRIVER_OFFLINE / 429 handling and cleanup.
 */
import Geolocation from '@react-native-community/geolocation';
import { ApiError } from '../../../src/core/api/errors';
import { driverLocationApi } from '../../../src/features/driver-location/api';
import { DRIVER_LOCATION_CONFIG } from '../../../src/features/driver-location/config';
import locationTrackingService from '../../../src/services/locationTrackingService';

const { minPostIntervalMs, heartbeatMs } = DRIVER_LOCATION_CONFIG;
const geo = Geolocation as jest.Mocked<typeof Geolocation>;

type PositionCallback = (position: { coords: Record<string, number>; timestamp: number }) => void;

const BASE = { latitude: 31.5204, longitude: 74.3587 };

/** Sends a position through the watcher's success callback. */
const emit = (metresNorth = 0, extra: Record<string, number> = {}) => {
  const onPosition = geo.watchPosition.mock.calls[geo.watchPosition.mock.calls.length - 1][0] as unknown as PositionCallback;
  onPosition({
    coords: { latitude: BASE.latitude + metresNorth / 111_195, longitude: BASE.longitude, ...extra },
    timestamp: Date.now(),
  });
};

const settle = async () => {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
};

const advance = async (ms: number) => {
  jest.advanceTimersByTime(ms);
  await settle();
};

let post: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  geo.watchPosition.mockClear();
  geo.clearWatch.mockClear();
  geo.setRNConfiguration.mockClear();
  post = jest.spyOn(driverLocationApi, 'post').mockResolvedValue(undefined);
});

afterEach(() => {
  locationTrackingService.reset();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('locationTrackingService (T-402)', () => {
  it('starts one foreground-only watcher and one timer, however often it is started', async () => {
    const setIntervalSpy = jest.spyOn(globalThis, 'setInterval');
    await locationTrackingService.startTracking();
    await locationTrackingService.startTracking();

    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(geo.setRNConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ authorizationLevel: 'whenInUse', enableBackgroundLocationUpdates: false }),
    );
  });

  it('posts the first fix at once with the documented body', async () => {
    await locationTrackingService.startTracking();
    emit(0, { heading: -1, speed: -1, accuracy: 8 });
    await settle();

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith({ ...BASE, heading: -1, speed: -1, accuracy: 8 });
  });

  it('throttles: no second post within the minimum interval, then posts on movement', async () => {
    await locationTrackingService.startTracking();
    emit(0);
    await settle();
    emit(50);
    await settle();
    expect(post).toHaveBeenCalledTimes(1);

    await advance(minPostIntervalMs);
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1][0].latitude).toBeCloseTo(BASE.latitude + 50 / 111_195, 8);
  });

  it('a stationary driver posts only on the heartbeat', async () => {
    await locationTrackingService.startTracking();
    emit(0);
    await settle();
    expect(post).toHaveBeenCalledTimes(1);

    emit(3);
    await advance(heartbeatMs - minPostIntervalMs);
    expect(post).toHaveBeenCalledTimes(1);

    await advance(minPostIntervalMs);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('on 409 DRIVER_OFFLINE stops the watcher and the timer, then asks for a status reload', async () => {
    const onDriverOffline = jest.fn();
    post.mockRejectedValueOnce(
      new ApiError({ kind: 'conflict', status: 409, code: 'DRIVER_OFFLINE', message: 'Driver is offline' }),
    );
    await locationTrackingService.startTracking({ onDriverOffline });
    emit(0);
    await settle();

    expect(onDriverOffline).toHaveBeenCalledTimes(1);
    expect(geo.clearWatch).toHaveBeenCalledWith(1);
    expect(locationTrackingService.getTrackingStatus()).toBe(false);

    await advance(heartbeatMs * 2);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('on 429 waits retry_after before the next post', async () => {
    post.mockRejectedValueOnce(
      new ApiError({ kind: 'rate_limited', status: 429, retryAfter: 20, message: 'Too many' }),
    );
    await locationTrackingService.startTracking();
    emit(0);
    await settle();

    await advance(15_000);
    expect(post).toHaveBeenCalledTimes(1);
    await advance(5_000);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('stopTracking clears the watcher and the timer: nothing is posted afterwards', async () => {
    const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');
    await locationTrackingService.startTracking();
    emit(0);
    await settle();
    locationTrackingService.stopTracking();

    expect(geo.clearWatch).toHaveBeenCalledTimes(1);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    await advance(heartbeatMs * 2);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('a stop during the permission step leaves nothing running', async () => {
    const started = locationTrackingService.startTracking();
    locationTrackingService.stopTracking();
    await expect(started).resolves.toBe(false);
    expect(geo.watchPosition).not.toHaveBeenCalled();
  });

  describe('pingIfStale (T-409, before POST /rides/{id}/arrived)', () => {
    const MAX_AGE = DRIVER_LOCATION_CONFIG.arrivalPingMaxAgeMs;

    it('posts the latest fix once when the last post is older than the limit, even without movement', async () => {
      await locationTrackingService.startTracking();
      emit(0);
      await settle();
      expect(post).toHaveBeenCalledTimes(1);

      // Not moving: the throttle would wait for the heartbeat (30 s).
      jest.setSystemTime(Date.now() + MAX_AGE + 1_000);
      await locationTrackingService.pingIfStale(MAX_AGE);
      expect(post).toHaveBeenCalledTimes(2);
      expect(post).toHaveBeenLastCalledWith(BASE);

      // Fresh now: a second call sends nothing.
      await locationTrackingService.pingIfStale(MAX_AGE);
      expect(post).toHaveBeenCalledTimes(2);
    });

    it('sends nothing while the last post is recent', async () => {
      await locationTrackingService.startTracking();
      emit(0);
      await settle();
      jest.setSystemTime(Date.now() + MAX_AGE - 5_000);
      await locationTrackingService.pingIfStale(MAX_AGE);
      expect(post).toHaveBeenCalledTimes(1);
    });

    it('sends nothing when tracking is off or there is no fix yet', async () => {
      await locationTrackingService.pingIfStale(MAX_AGE);
      await locationTrackingService.startTracking();
      await locationTrackingService.pingIfStale(MAX_AGE);
      expect(post).not.toHaveBeenCalled();
    });

    it('waits for a post already in flight instead of sending a second one', async () => {
      let release: () => void = () => undefined;
      post.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
      await locationTrackingService.startTracking();
      emit(0);
      let done = false;
      const ping = locationTrackingService.pingIfStale(MAX_AGE).then(() => { done = true; });
      await settle();
      expect(done).toBe(false);
      release();
      await ping;
      expect(post).toHaveBeenCalledTimes(1);
    });

    it('never rejects when the post fails', async () => {
      await locationTrackingService.startTracking();
      emit(0);
      await settle();
      post.mockRejectedValueOnce(new ApiError({ kind: 'server', status: 500, message: 'x' }));
      jest.setSystemTime(Date.now() + MAX_AGE + 1_000);
      await expect(locationTrackingService.pingIfStale(MAX_AGE)).resolves.toBeUndefined();
      expect(post).toHaveBeenCalledTimes(2);
    });
  });
});
