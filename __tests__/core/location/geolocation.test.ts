/**
 * T-712 (Android smoke 2, 2026-10-21): an "Approximate only" phone with Google Location Accuracy
 * off got no position (the library's AndroidLocationManager refuses GPS without FINE). The app now
 * reads through the fused provider, configured once for lookups and the driver watch alike, and
 * the fused single lookup (no native timeout) ends on a JS timer that clears itself.
 */
import { Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {
  configureGeolocation,
  getPositionOnce,
  isDeviceLocationOff,
  resetGeolocationConfigurationForTests,
} from '../../../src/core/location/geolocation';

const geo = Geolocation as jest.Mocked<typeof Geolocation>;
type Success = Parameters<typeof Geolocation.getCurrentPosition>[0];
type Failure = NonNullable<Parameters<typeof Geolocation.getCurrentPosition>[1]>;

const position = { coords: { latitude: 31.47, longitude: 74.27, accuracy: 2000 }, timestamp: 0 } as unknown as Parameters<Success>[0];
const failure = (code: number, message = 'fake') =>
  ({ code, message, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }) as Parameters<Failure>[0];

beforeEach(() => {
  jest.useFakeTimers();
  jest.replaceProperty(Platform, 'OS', 'android');
  resetGeolocationConfigurationForTests();
  geo.setRNConfiguration.mockClear();
  geo.getCurrentPosition.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('configureGeolocation (T-712)', () => {
  it('Android: the fused provider, no library permission prompt, applied only once', () => {
    configureGeolocation();
    configureGeolocation();
    configureGeolocation();
    expect(geo.setRNConfiguration).toHaveBeenCalledTimes(1);
    expect(geo.setRNConfiguration).toHaveBeenCalledWith({
      skipPermissionRequests: true,
      authorizationLevel: 'whenInUse',
      enableBackgroundLocationUpdates: false,
      locationProvider: 'playServices',
    });
  });

  it('iOS: what the driver tracker always set (the library prompts "while using")', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    configureGeolocation();
    expect(geo.setRNConfiguration).toHaveBeenCalledWith({
      skipPermissionRequests: false,
      authorizationLevel: 'whenInUse',
      enableBackgroundLocationUpdates: false,
      locationProvider: 'auto',
    });
  });
});

describe('getPositionOnce (T-712)', () => {
  it('Android: a lookup that never answers ends with TIMEOUT after its timeout; a late answer is ignored', () => {
    let late: Success | undefined;
    geo.getCurrentPosition.mockImplementation((ok) => {
      late = ok;
    });
    const ok = jest.fn();
    const fail = jest.fn();
    getPositionOnce(ok, fail, { timeout: 10000, enableHighAccuracy: true });

    jest.advanceTimersByTime(9999);
    expect(fail).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(fail).toHaveBeenCalledTimes(1);
    expect(fail.mock.calls[0][0].code).toBe(3);
    expect(jest.getTimerCount()).toBe(0);

    late?.(position);
    expect(ok).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledTimes(1);
  });

  it('Android: an answer clears the timer at once (nothing fires later)', () => {
    geo.getCurrentPosition.mockImplementation((ok) => ok(position));
    const ok = jest.fn();
    const fail = jest.fn();
    getPositionOnce(ok, fail, { timeout: 10000 });
    expect(ok).toHaveBeenCalledWith(position);
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(20000);
    expect(fail).not.toHaveBeenCalled();
  });

  it('Android: a native error clears the timer too', () => {
    geo.getCurrentPosition.mockImplementation((_ok, fail) => fail?.(failure(2)));
    const fail = jest.fn();
    getPositionOnce(jest.fn(), fail, { timeout: 10000 });
    expect(fail).toHaveBeenCalledTimes(1);
    expect(fail.mock.calls[0][0].code).toBe(2);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('iOS: no JS timer (the library keeps its own timeout)', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    geo.getCurrentPosition.mockImplementation(() => undefined);
    getPositionOnce(jest.fn(), jest.fn(), { timeout: 10000 });
    expect(jest.getTimerCount()).toBe(0);
    expect(geo.getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), { timeout: 10000 });
  });
});

describe('isDeviceLocationOff (T-712)', () => {
  it('only the fused settings failure or the legacy no-provider answer means the device location is off', () => {
    expect(isDeviceLocationOff(failure(2, 'Location not available (FusedLocationProvider/settings).'))).toBe(true);
    expect(isDeviceLocationOff(failure(2, 'Location not available (FusedLocationProvider/lastLocation).'))).toBe(false);
    expect(isDeviceLocationOff(failure(2, 'Location not available (FusedLocationProvider).'))).toBe(false);
    expect(isDeviceLocationOff(failure(2, 'No location provider available.'))).toBe(true);
    expect(isDeviceLocationOff(failure(3, 'Location not available (FusedLocationProvider/settings).'))).toBe(false);
    jest.replaceProperty(Platform, 'OS', 'ios');
    expect(isDeviceLocationOff(failure(2, 'Location not available (FusedLocationProvider/settings).'))).toBe(false);
  });
});
