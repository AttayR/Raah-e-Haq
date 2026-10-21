/**
 * T-410: the driver's GPS froze mid-ride. On iOS, @react-native-community/geolocation ends a
 * running watch when anyone calls getCurrentPosition (its resume call hit RCTEventEmitter's
 * no-op `startObserving`), and DriverMapScreen did so on mount. The tracker then re-posted the
 * last fix on its heartbeat for minutes as if it were fresh.
 *
 * Covered here: the native patch is applied, one shared refcounted watcher owned by the
 * tracker, the self-heal restart of a silent watcher, and no posting of an old fix.
 */
import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { driverLocationApi } from '../../../src/features/driver-location/api';
import {
  DRIVER_LOCATION_CONFIG,
  DRIVER_LOCATION_LOW_POWER_WATCH_OPTIONS,
  DRIVER_LOCATION_LOW_POWER_WATCH_OPTIONS_ANDROID,
  DRIVER_LOCATION_RIDE_WATCH_OPTIONS,
  DRIVER_LOCATION_WATCH_OPTIONS,
} from '../../../src/features/driver-location/config';
import locationTrackingService from '../../../src/services/locationTrackingService';
import { logger } from '../../../src/core/logging/logger';

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
    const warn = jest.spyOn(logger, 'warn');
    const debug = jest.spyOn(logger, 'debug');
    await advance(watchRestartAfterMs + minPostIntervalMs);
    expect(geo.clearWatch).toHaveBeenCalledTimes(1);
    expect(geo.clearWatch).toHaveBeenCalledWith(1);
    expect(geo.watchPosition).toHaveBeenCalledTimes(2);
    // T-585: a parked driver gets no new fix; expected, so debug (no yellow Debug LogBox).
    expect(debug).toHaveBeenCalledWith('Driver location: no new fix, restarting the watcher', expect.anything());
    expect(warn).not.toHaveBeenCalled();

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

    // T-537: tracking takes over the running watch with its options (one native watch at a time).
    await locationTrackingService.startTracking();
    expect(geo.clearWatch).toHaveBeenCalledTimes(1);
    expect(geo.clearWatch).toHaveBeenLastCalledWith(1);
    expect(geo.watchPosition).toHaveBeenCalledTimes(2);

    // Tracking stops while the screen still holds it: the watch goes on, in low power.
    locationTrackingService.stopTracking();
    expect(geo.clearWatch).toHaveBeenCalledTimes(2);
    expect(geo.watchPosition).toHaveBeenCalledTimes(3);

    release();
    release();
    expect(geo.clearWatch).toHaveBeenCalledTimes(3);
    expect(geo.clearWatch).toHaveBeenLastCalledWith(3);
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

describe('native fused provider patch (T-712)', () => {
  const source = () =>
    readFileSync(
      'node_modules/@react-native-community/geolocation/android/src/main/java/com/reactnativecommunity/geolocation/PlayServicesLocationManager.java',
      'utf8',
    );

  it('stopObserving forgets its callback, and a late settings answer registers only the current one', () => {
    const java = source();
    expect(java).toMatch(/removeLocationUpdates\(mLocationCallback\);\s*\/\/[^\n]*\n(\s*\/\/[^\n]*\n)*\s*mLocationCallback = null;/);
    expect(java.match(/if \(!single && locationCallback != mLocationCallback\)/g)).toHaveLength(2);
  });

  it('a single lookup ends natively (one update, its timeout) and removes its own updates on every answer', () => {
    const java = source();
    expect(java).toContain('requestBuilder.setMaxUpdates(1);');
    expect(java).toContain('requestBuilder.setDurationMillis(locationOptions.timeout);');
    expect(java).not.toContain('removeLocationUpdates(mSingleLocationCallback)');
    expect(java.match(/removeLocationUpdates\(this\);/g)).toHaveLength(3);
  });

  it('the patch touches only library sources (android/src, ios), never build output', () => {
    const patch = readFileSync('patches/@react-native-community+geolocation+3.4.0.patch', 'utf8');
    const header = /^diff --git a\/node_modules\/@react-native-community\/geolocation\/(\S+) /gm;
    const files = Array.from(patch.matchAll(header), (m) => m[1]);
    expect(files).toEqual([
      'android/src/main/java/com/reactnativecommunity/geolocation/PlayServicesLocationManager.java',
      'ios/RNCGeolocation.mm',
    ]);
    files.forEach((file) => expect(file).toMatch(/^(android\/src\/|ios\/)/));
    expect(patch).not.toMatch(/GIT binary patch|Binary files/);
  });

  it('not high accuracy is balanced power, not low power', () => {
    expect(source()).toContain(
      'locationOptions.highAccuracy ? Priority.PRIORITY_HIGH_ACCURACY : Priority.PRIORITY_BALANCED_POWER_ACCURACY',
    );
  });
});

describe('watch accuracy by mode (T-537, PERF-20)', () => {
  const lastOptions = () => geo.watchPosition.mock.calls[geo.watchPosition.mock.calls.length - 1][2];

  it('a screen hold alone (offline driver) runs the low-power watch', async () => {
    locationTrackingService.acquireLocationWatch();
    await settle();
    expect(lastOptions()).toEqual(DRIVER_LOCATION_LOW_POWER_WATCH_OPTIONS);
    expect(DRIVER_LOCATION_LOW_POWER_WATCH_OPTIONS.enableHighAccuracy).toBe(false);
  });

  it('T-712: on Android (fused, whose low power never uses GPS) the offline watch is high accuracy, but sparse', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
    const release = locationTrackingService.acquireLocationWatch();
    // The Android permission step has more awaits (primer status, two checks).
    for (let i = 0; i < 4; i += 1) await settle();
    expect(lastOptions()).toEqual(DRIVER_LOCATION_LOW_POWER_WATCH_OPTIONS_ANDROID);
    expect(DRIVER_LOCATION_LOW_POWER_WATCH_OPTIONS_ANDROID).toEqual({
      enableHighAccuracy: true,
      distanceFilter: 50,
      interval: 30_000,
      fastestInterval: 15_000,
      maximumAge: 30_000,
    });

    // Online tracking and rides keep their own options on Android too.
    await locationTrackingService.startTracking();
    expect(lastOptions()).toEqual(DRIVER_LOCATION_WATCH_OPTIONS);
    locationTrackingService.stopTracking();
    expect(lastOptions()).toEqual(DRIVER_LOCATION_LOW_POWER_WATCH_OPTIONS_ANDROID);
    release();
  });

  it('T-712: a quick low-power -> tracking switch on Android clears each watch before the next; never two at once', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
    const running = new Set<number>();
    let most = 0;
    geo.watchPosition.mockImplementation(() => {
      const id = nextWatchId++;
      running.add(id);
      most = Math.max(most, running.size);
      return id;
    });
    geo.clearWatch.mockImplementation((id: number) => {
      running.delete(id);
    });

    const release = locationTrackingService.acquireLocationWatch();
    // Going online right away, before the low-power watch had any fix.
    const online = locationTrackingService.startTracking();
    for (let i = 0; i < 4; i += 1) await settle();
    expect(await online).toBe(true);
    locationTrackingService.stopTracking();
    expect(await locationTrackingService.startTracking()).toBe(true);

    expect(most).toBe(1);
    expect(running.size).toBe(1);
    expect(lastOptions()).toEqual(DRIVER_LOCATION_WATCH_OPTIONS);
    // Each watch started before the last one was cleared, with its own id.
    const started = geo.watchPosition.mock.results.map((r) => r.value as number);
    expect(geo.clearWatch.mock.calls.map(([id]) => id)).toEqual(started.slice(0, -1));

    locationTrackingService.stopTracking();
    release();
    expect(running.size).toBe(0);
  });

  it('online tracking runs the high-accuracy watch; a ride its own; back to low power when tracking stops', async () => {
    const release = locationTrackingService.acquireLocationWatch();
    await settle();
    await locationTrackingService.startTracking();
    expect(lastOptions()).toEqual(DRIVER_LOCATION_WATCH_OPTIONS);
    expect(DRIVER_LOCATION_WATCH_OPTIONS.enableHighAccuracy).toBe(true);

    locationTrackingService.setRideCadence(true);
    expect(lastOptions()).toEqual(DRIVER_LOCATION_RIDE_WATCH_OPTIONS);
    locationTrackingService.setRideCadence(false);
    expect(lastOptions()).toEqual(DRIVER_LOCATION_WATCH_OPTIONS);

    const watches = geo.watchPosition.mock.calls.length;
    locationTrackingService.stopTracking();
    expect(geo.watchPosition).toHaveBeenCalledTimes(watches + 1);
    expect(lastOptions()).toEqual(DRIVER_LOCATION_LOW_POWER_WATCH_OPTIONS);
    release();
    expect(geo.clearWatch).toHaveBeenCalledTimes(watches + 1);
  });

  it('going online never posts the last low-power fix; the first post is a high-accuracy fix', async () => {
    const listener = jest.fn();
    locationTrackingService.addLocationListener(listener);
    locationTrackingService.acquireLocationWatch();
    await settle();
    emit(0); // low-power fix: shown on the map
    expect(listener).toHaveBeenCalledTimes(1);

    await locationTrackingService.startTracking();
    await advance(heartbeatMs);
    await locationTrackingService.pingIfStale(arrivalPingMaxAgeMs);
    expect(post).not.toHaveBeenCalled();

    emit(40); // first fix of the high-accuracy watch
    await settle();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toMatchObject({ latitude: expect.closeTo(BASE.latitude + 40 / 111_195, 6) });

    // The heartbeat goes on as before.
    await advance(heartbeatMs);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('a second screen hold does not restart a watch that already has the right options', async () => {
    await locationTrackingService.startTracking();
    locationTrackingService.acquireLocationWatch();
    locationTrackingService.acquireLocationWatch();
    await settle();
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
    expect(geo.clearWatch).not.toHaveBeenCalled();
  });
});
