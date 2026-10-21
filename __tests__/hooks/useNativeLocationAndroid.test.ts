/**
 * T-593 (Android smoke 2026-10-21, issue 3): every Android debug build (real phones too) faked a
 * granted permission and the Lahore default point (isAndroidEmulator = Platform.OS === 'android'
 * && __DEV__). Android now goes through the real pre-prompt -> OS prompt -> denied / "Turn on"
 * path, and the geolocation library never asks the OS on its own.
 */
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import Geolocation from '@react-native-community/geolocation';
import { useNativeLocation } from '../../src/hooks/useNativeLocation';
import { permissionPrimer } from '../../src/features/permissions/primer';
import { getDefaultLocation } from '../../src/utils/locationUtils';
import { resetGeolocationConfigurationForTests } from '../../src/core/location/geolocation';
import { useBookingLocationGate } from '../../src/features/ride-booking/useBookingLocationGate';
import locationTrackingService from '../../src/services/locationTrackingService';
import { logger } from '../../src/core/logging/logger';

const geo = Geolocation as jest.Mocked<typeof Geolocation>;
type Success = Parameters<typeof Geolocation.getCurrentPosition>[0];
type Failure = NonNullable<Parameters<typeof Geolocation.getCurrentPosition>[1]>;

const position = (latitude: number, longitude: number) =>
  ({ coords: { latitude, longitude, accuracy: 5, altitude: null, heading: null, speed: null, altitudeAccuracy: null }, timestamp: 0 }) as unknown as Parameters<Success>[0];
const failure = (code: number, message = 'fake') => ({ code, message, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }) as Parameters<Failure>[0];

const { ACCESS_FINE_LOCATION: FINE, ACCESS_COARSE_LOCATION: COARSE } = PermissionsAndroid.PERMISSIONS;
const { GRANTED, DENIED, NEVER_ASK_AGAIN } = PermissionsAndroid.RESULTS;
type Answer = (typeof PermissionsAndroid.RESULTS)[keyof typeof PermissionsAndroid.RESULTS];
type MultipleResult = Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>;

const settle = async () => {
  await act(async () => {
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
  });
};

let granted: boolean;
let requestMultiple: jest.SpyInstance;
let release: () => void;

/** The OS prompt's answer; a grant makes later checks pass. */
const osAnswers = (fine: Answer, coarse: Answer) => {
  requestMultiple.mockImplementation(async () => {
    granted = fine === GRANTED || coarse === GRANTED;
    return { [FINE]: fine, [COARSE]: coarse } as MultipleResult;
  });
};

beforeEach(async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  granted = false;
  geo.getCurrentPosition.mockReset();
  geo.setRNConfiguration.mockClear();
  resetGeolocationConfigurationForTests();
  geo.getCurrentPosition.mockImplementation((ok) => ok(position(31.47, 74.27)));
  jest.spyOn(PermissionsAndroid, 'check').mockImplementation(async () => granted);
  requestMultiple = jest.spyOn(PermissionsAndroid, 'requestMultiple');
  osAnswers(GRANTED, GRANTED);
  permissionPrimer.reset();
  await AsyncStorage.clear();
  release = permissionPrimer.registerHost();
});

afterEach(() => {
  release();
  jest.restoreAllMocks();
});

describe('useNativeLocation on Android (T-593)', () => {
  it('not granted: the pre-prompt comes first; nothing is faked and the library is not called', async () => {
    const { result } = renderHook(() => useNativeLocation());
    await settle();
    expect(permissionPrimer.current()).toBe('locationPassenger');
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    expect(requestMultiple).not.toHaveBeenCalled();
    expect(result.current.currentLocation).toBeNull();
    expect(result.current.permissionStatus.isGranted).toBe(false);
  });

  it('"Not now": the "Turn on" state, the OS unasked, no default point', async () => {
    const { result } = renderHook(() => useNativeLocation());
    await settle();
    act(() => permissionPrimer.answer('later'));
    await settle();
    expect(requestMultiple).not.toHaveBeenCalled();
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    expect(result.current.error).toBe('denied');
    expect(result.current.currentLocation).toBeNull();
  });

  it('"Continue" then "Allow": asks fine and coarse, then reads the real position', async () => {
    const { result } = renderHook(() => useNativeLocation());
    await settle();
    act(() => permissionPrimer.answer('continue'));
    await settle();
    expect(requestMultiple).toHaveBeenCalledWith([FINE, COARSE]);
    expect(result.current.currentLocation).toEqual({ latitude: 31.47, longitude: 74.27 });
    expect(result.current.currentLocation).not.toEqual(
      expect.objectContaining({ latitude: getDefaultLocation().latitude }),
    );
    expect(result.current.permissionStatus).toEqual({ isGranted: true, canAskAgain: false, isLocationEnabled: true });
    // Every library lookup on Android runs with the library's own permission request off
    // (T-712: through the fused provider), configured before the first lookup.
    expect(geo.setRNConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ skipPermissionRequests: true, locationProvider: 'playServices' }),
    );
    expect(geo.setRNConfiguration.mock.invocationCallOrder[0]).toBeLessThan(
      geo.getCurrentPosition.mock.invocationCallOrder[0],
    );
  });

  it('approximate only (coarse granted) counts as access', async () => {
    osAnswers(DENIED, GRANTED);
    const { result } = renderHook(() => useNativeLocation());
    await settle();
    act(() => permissionPrimer.answer('continue'));
    await settle();
    expect(result.current.currentLocation).toEqual({ latitude: 31.47, longitude: 74.27 });
  });

  it('"Don\'t allow": denied and askable again; "Turn on" asks the OS again', async () => {
    osAnswers(DENIED, DENIED);
    const { result } = renderHook(() => useNativeLocation());
    await settle();
    act(() => permissionPrimer.answer('continue'));
    await settle();
    expect(result.current.error).toBe('denied');
    expect(result.current.permissionStatus.canAskAgain).toBe(true);
    expect(result.current.currentLocation).toBeNull();
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();

    osAnswers(GRANTED, GRANTED);
    await act(async () => {
      await result.current.requestLocationPermission();
    });
    expect(requestMultiple).toHaveBeenCalledTimes(2);
    expect(result.current.currentLocation).toEqual({ latitude: 31.47, longitude: 74.27 });
    expect(result.current.error).toBeNull();
  });

  it('"Don\'t ask again": denied for Settings', async () => {
    osAnswers(NEVER_ASK_AGAIN, NEVER_ASK_AGAIN);
    const { result } = renderHook(() => useNativeLocation());
    await settle();
    act(() => permissionPrimer.answer('continue'));
    await settle();
    expect(result.current.error).toBe('denied');
    expect(result.current.permissionStatus.canAskAgain).toBe(false);
  });

  it('granted but the lookup times out: a retry error, not the Lahore default point', async () => {
    granted = true;
    geo.getCurrentPosition.mockImplementation((_ok, fail) => fail?.(failure(3)));
    const { result } = renderHook(() => useNativeLocation());
    await settle();
    expect(permissionPrimer.current()).toBeNull();
    expect(result.current.currentLocation).toBeNull();
    expect(result.current.error).toBe('unavailable');
  });
});

const FUSED_DEVICE_OFF = 'Location not available (FusedLocationProvider/settings).';
/** The fused provider found no fix (yet): its lookup or availability failed. */
const NO_FIX = 'Location not available (FusedLocationProvider/lastLocation).';
/** The legacy AndroidLocationManager (phones without Play Services) with location switched off. */
const LEGACY_NO_PROVIDER = 'No location provider available.';

describe('useNativeLocation on Android, approximate access (T-712)', () => {
  it('granted but no fused fix (code 2): "unavailable" with a retry, never "disabled" or Settings', async () => {
    granted = true;
    geo.getCurrentPosition.mockImplementation((_ok, fail) => fail?.(failure(2, NO_FIX)));
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    const { result } = renderHook(() => useBookingLocationGate({ active: true, rideShown: false }));
    await settle();
    expect(result.current.currentLocation).toBeNull();
    expect(result.current.refused).toBe(false);
    expect(result.current.wait?.reason).toBe('unavailable');

    // The Banner action looks again instead of opening Settings (access is already granted).
    await act(async () => {
      result.current.askOrSettings();
    });
    await settle();
    expect(openSettings).not.toHaveBeenCalled();
    expect(result.current.wait?.reason).toBe('unavailable');

    // The wait state's retry finds the position once the fused provider has one.
    geo.getCurrentPosition.mockImplementation((ok) => ok(position(31.47, 74.27)));
    await act(async () => {
      result.current.wait?.onRetry();
    });
    await settle();
    expect(openSettings).not.toHaveBeenCalled();
    expect(result.current.currentLocation).toEqual({ latitude: 31.47, longitude: 74.27 });
  });

  it('no fix yet (code 2, unavailable) is logged at debug, not as a warning (no LogBox)', async () => {
    granted = true;
    geo.getCurrentPosition.mockImplementation((_ok, fail) => fail?.(failure(2, NO_FIX)));
    const warn = jest.spyOn(logger, 'warn');
    const debug = jest.spyOn(logger, 'debug');
    renderHook(() => useNativeLocation());
    await settle();
    expect(debug).toHaveBeenCalledWith('Location error:', expect.objectContaining({ code: 2 }));
    expect(warn).not.toHaveBeenCalledWith('Location error:', expect.anything());
  });

  it.each([
    ['fused settings failure', FUSED_DEVICE_OFF],
    ['legacy manager, no Play Services', LEGACY_NO_PROVIDER],
  ])('the device location switched off (%s): still "disabled", for Settings', async (_name, message) => {
    granted = true;
    geo.getCurrentPosition.mockImplementation((_ok, fail) => fail?.(failure(2, message)));
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    const { result } = renderHook(() => useBookingLocationGate({ active: true, rideShown: false }));
    await settle();
    expect(result.current.refused).toBe(true);
    await act(async () => {
      result.current.askOrSettings();
    });
    expect(openSettings).toHaveBeenCalled();
  });

  it('the device location switched off (fused settings failure): the hook reads "disabled"', async () => {
    granted = true;
    geo.getCurrentPosition.mockImplementation((_ok, fail) => fail?.(failure(2, FUSED_DEVICE_OFF)));
    const { result } = renderHook(() => useNativeLocation());
    await settle();
    expect(result.current.error).toBe('disabled');
  });

  it('one fused high-accuracy lookup (no separate probe), configured once before it', async () => {
    granted = true;
    const { result } = renderHook(() => useNativeLocation());
    await settle();
    await act(async () => {
      await result.current.getCurrentLocation();
    });
    expect(geo.getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(geo.getCurrentPosition.mock.calls[0][2]).toEqual(
      expect.objectContaining({ enableHighAccuracy: true, timeout: 10000 }),
    );
    expect(geo.setRNConfiguration).toHaveBeenCalledTimes(1);
    expect(geo.setRNConfiguration.mock.invocationCallOrder[0]).toBeLessThan(
      geo.getCurrentPosition.mock.invocationCallOrder[0],
    );
  });

  it('a fused lookup that never answers ends as "unavailable" after 10 s, its timer cleared', async () => {
    granted = true;
    jest.useFakeTimers();
    try {
      geo.getCurrentPosition.mockImplementation(() => undefined);
      const { result } = renderHook(() => useNativeLocation());
      await settle();
      expect(result.current.error).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(10000);
      });
      await settle();
      expect(result.current.error).toBe('unavailable');
      expect(result.current.isLoading).toBe(false);
      // One lookup, no loop (the wrapper's own timer is covered in core/location/geolocation).
      expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('the driver watch shares the one configuration: never reconfigured under a running watch', async () => {
    granted = true;
    geo.watchPosition.mockClear();
    geo.clearWatch.mockClear();
    jest.spyOn(PermissionsAndroid, 'check').mockImplementation(async () => true);
    renderHook(() => useNativeLocation());
    await settle();
    try {
      expect(await locationTrackingService.startTracking()).toBe(true);
      const releaseWatch = locationTrackingService.acquireLocationWatch();
      await settle();
      locationTrackingService.stopTracking();
      expect(await locationTrackingService.startTracking()).toBe(true);
      releaseWatch();

      expect(geo.setRNConfiguration).toHaveBeenCalledTimes(1);
      expect(geo.setRNConfiguration.mock.invocationCallOrder[0]).toBeLessThan(
        geo.watchPosition.mock.invocationCallOrder[0],
      );
    } finally {
      locationTrackingService.reset();
    }
    // Every watch started was cleared again.
    expect(geo.clearWatch).toHaveBeenCalledTimes(geo.watchPosition.mock.calls.length);
  });
});
