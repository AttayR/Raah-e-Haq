/**
 * T-410: the driver's GPS froze mid-ride. On iOS, @react-native-community/geolocation ends a
 * running watch when anyone calls getCurrentPosition (its resume call hit RCTEventEmitter's
 * no-op `startObserving`), and DriverMapScreen did so on mount. The tracker then re-posted the
 * last fix on its heartbeat for minutes as if it were fresh.
 *
 * Covered here: the native patch is applied, one shared refcounted watcher owned by the
 * tracker, the self-heal restart of a silent watcher, and no posting of an old fix.
 */
import Geolocation from '@react-native-community/geolocation';
import { driverLocationApi } from '../../../src/features/driver-location/api';
import { DRIVER_LOCATION_CONFIG } from '../../../src/features/driver-location/config';
import locationTrackingService from '../../../src/services/locationTrackingService';

const { minPostIntervalMs, heartbeatMs, watchRestartAfterMs, maxFixAgeMs, arrivalPingMaxAgeMs } =
  DRIVER_LOCATION_CONFIG;
const geo = Geolocation as jest.Mocked<typeof Geolocation>;

// Jest runs from the repository root; paths are relative to it.
const { readFileSync } = jest.requireActual<{
  readFileSync: (file: string, encoding: 'utf8') => string;
}>('fs');

type PositionCallback = (position: { coords: Record<string, number>; timestamp: number }) => void;

const BASE = { latitude: 31.5204, longitude: 74.3587 };

/** Sends a position through the success callback of watch number `index` (default: latest). */
const emitOn = (index: number, metresNorth = 0) => {
  const onPosition = geo.watchPosition.mock.calls[index][0] as unknown as PositionCallback;
  onPosition({
    coords: { latitude: BASE.latitude + metresNorth / 111_195, longitude: BASE.longitude },
    timestamp: Date.now(),
  });
};
const emit = (metresNorth = 0) => emitOn(geo.watchPosition.mock.calls.length - 1, metresNorth);

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
let nextWatchId = 1;

beforeEach(() => {
  jest.useFakeTimers();
  nextWatchId = 1;
  geo.watchPosition.mockReset();
  geo.watchPosition.mockImplementation(() => nextWatchId++);
  geo.clearWatch.mockClear();
  geo.stopObserving.mockClear();
  geo.getCurrentPosition.mockClear();
  post = jest.spyOn(driverLocationApi, 'post').mockResolvedValue(undefined);
});

afterEach(() => {
  locationTrackingService.reset();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('native geolocation patch (T-410 root cause)', () => {
  it('getCurrentPosition during a watch resumes the watch with its options', () => {
    const source = readFileSync(
      'node_modules/@react-native-community/geolocation/ios/RNCGeolocation.mm',
      'utf8',
    );
    // The bare call resolves to RCTEventEmitter's no-op hook and the watch silently ends.
    expect(source).not.toMatch(/\[self startObserving\];/);
    expect(source).toContain('[self startObserving:_observerOptions];');
  });
});

describe('self-heal of a silent watcher (T-410)', () => {
  it('restarts the watcher once after a silent window, and again only after another one', async () => {
    await locationTrackingService.startTracking();
    emit(0);
    await settle();
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);

    // Silence: no fix for longer than the window (ticks every minPostIntervalMs).
    await advance(watchRestartAfterMs + minPostIntervalMs);
    expect(geo.clearWatch).toHaveBeenCalledTimes(1);
    expect(geo.clearWatch).toHaveBeenCalledWith(1);
    expect(geo.watchPosition).toHaveBeenCalledTimes(2);

    // Still silent, but within the new window: no further restart (no loop).
    await advance(watchRestartAfterMs - minPostIntervalMs);
    expect(geo.watchPosition).toHaveBeenCalledTimes(2);

    // A second full silent window: one more restart.
    await advance(minPostIntervalMs * 2);
    expect(geo.watchPosition).toHaveBeenCalledTimes(3);
  });

  it('a watcher that keeps delivering fixes is never restarted', async () => {
    await locationTrackingService.startTracking();
    for (let i = 0; i < 10; i += 1) {
      emit(i * 20);
      await advance(watchRestartAfterMs / 2);
    }
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
    expect(geo.clearWatch).not.toHaveBeenCalled();
  });

  it('a fix from the replaced watcher is ignored; the restarted one is posted', async () => {
    await locationTrackingService.startTracking();
    emit(0);
    await settle();
    await advance(watchRestartAfterMs + minPostIntervalMs);
    expect(geo.watchPosition).toHaveBeenCalledTimes(2);
    post.mockClear();

    emitOn(0, 500);
    await settle();
    expect(locationTrackingService.getLastLocation()?.latitude).toBeCloseTo(BASE.latitude, 8);

    emitOn(1, 500);
    await settle();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0].latitude).toBeCloseTo(BASE.latitude + 500 / 111_195, 8);
  });
});

describe('an old fix is not posted as fresh (T-410)', () => {
  it('the heartbeat stops once the last fix is older than maxFixAgeMs', async () => {
    await locationTrackingService.startTracking();
    emit(0);
    await settle();
    expect(post).toHaveBeenCalledTimes(1);

    // Heartbeats while the fix is still young enough.
    await advance(heartbeatMs);
    expect(post).toHaveBeenCalledTimes(2);
    await advance(heartbeatMs);
    expect(post).toHaveBeenCalledTimes(3);

    // The watcher restarts but the device stays silent: nothing more is posted.
    await advance(maxFixAgeMs * 4);
    expect(post).toHaveBeenCalledTimes(3);

    // A new fix arrives: posting resumes at once.
    emit(0);
    await settle();
    expect(post).toHaveBeenCalledTimes(4);
  });

  it('the arrival ping (T-409) does not post an old fix either', async () => {
    await locationTrackingService.startTracking();
    emit(0);
    await settle();
    expect(post).toHaveBeenCalledTimes(1);

    jest.setSystemTime(Date.now() + maxFixAgeMs + 1_000);
    await locationTrackingService.pingIfStale(arrivalPingMaxAgeMs);
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe('one shared watcher (T-410)', () => {
  it('a screen hold and tracking share one native watch; it ends only when both let go', async () => {
    const release = locationTrackingService.acquireLocationWatch();
    await settle();
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);

    await locationTrackingService.startTracking();
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);

    locationTrackingService.stopTracking();
    expect(geo.clearWatch).not.toHaveBeenCalled();

    release();
    release();
    expect(geo.clearWatch).toHaveBeenCalledTimes(1);
    expect(geo.clearWatch).toHaveBeenCalledWith(1);
  });

  it('releasing a screen hold never stops the watch while tracking runs', async () => {
    await locationTrackingService.startTracking();
    const release = locationTrackingService.acquireLocationWatch();
    await settle();
    release();
    expect(geo.clearWatch).not.toHaveBeenCalled();
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);

    emit(0);
    await settle();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('a screen hold delivers positions to listeners without posting', async () => {
    const listener = jest.fn();
    locationTrackingService.addLocationListener(listener);
    locationTrackingService.acquireLocationWatch();
    await settle();
    emit(0);
    await advance(heartbeatMs * 2);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
  });

  it('a hold released before permission resolves never starts the watch', async () => {
    const release = locationTrackingService.acquireLocationWatch();
    release();
    await settle();
    expect(geo.watchPosition).not.toHaveBeenCalled();
  });

  it('logout (reset) stops a held watch; a stale release cannot drop a new session hold', async () => {
    const oldRelease = locationTrackingService.acquireLocationWatch();
    await settle();
    locationTrackingService.reset();
    expect(geo.clearWatch).toHaveBeenCalledTimes(1);

    locationTrackingService.acquireLocationWatch();
    await settle();
    expect(geo.watchPosition).toHaveBeenCalledTimes(2);
    oldRelease();
    expect(geo.clearWatch).toHaveBeenCalledTimes(1);
  });

  it('the tracker never asks the device for a one-shot position or stops observing globally', async () => {
    await locationTrackingService.startTracking();
    locationTrackingService.acquireLocationWatch()();
    emit(0);
    await advance(watchRestartAfterMs * 3);
    locationTrackingService.stopTracking();

    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    expect(geo.stopObserving).not.toHaveBeenCalled();
  });
});
