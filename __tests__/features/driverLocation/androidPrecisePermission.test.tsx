/**
 * T-596: driver location permission on Android 12+. The tracker asked for FINE alone (Android 12+
 * ignores that request) and its watch let the library prompt again (`skipPermissionRequests:
 * false`), re-prompting a driver who chose approximate. Now FINE and COARSE are asked together,
 * Android watches skip the library's own prompt, tracking needs precise location, and the Drive
 * sheet shows "Turn on precise location" when only approximate is granted. iOS is unchanged.
 */
import React from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { act, render, renderHook, screen } from '@testing-library/react-native';
import Geolocation from '@react-native-community/geolocation';
import { resetGeolocationConfigurationForTests } from '../../../src/core/location/geolocation';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { DriveSheetBody } from '../../../src/components/driver/drive/DriveSheet';
import { driverLocationApi } from '../../../src/features/driver-location/api';
import { locationOsApproximateOnly } from '../../../src/features/permissions/locationStatus';
import { useLocationBlocked } from '../../../src/features/permissions/useLocationBlocked';
import locationTrackingService from '../../../src/services/locationTrackingService';

const geo = Geolocation as jest.Mocked<typeof Geolocation>;
const { ACCESS_FINE_LOCATION: FINE, ACCESS_COARSE_LOCATION: COARSE } = PermissionsAndroid.PERMISSIONS;
const { GRANTED, DENIED } = PermissionsAndroid.RESULTS;

const originalOS = Platform.OS;
const setOS = (os: typeof Platform.OS) => Object.defineProperty(Platform, 'OS', { value: os, configurable: true });

const settle = async () => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
  });
};

/** Which permissions the device already has. */
const granted = (has: { fine?: boolean; coarse?: boolean }) =>
  jest
    .spyOn(PermissionsAndroid, 'check')
    .mockImplementation(async (permission) => (permission === FINE ? !!has.fine : permission === COARSE ? !!has.coarse : false));

/** What the driver answers in the OS prompt. */
const answers = (fine: string, coarse: string) =>
  jest
    .spyOn(PermissionsAndroid, 'requestMultiple')
    .mockResolvedValue({ [FINE]: fine, [COARSE]: coarse } as Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>);

beforeEach(() => {
  geo.watchPosition.mockReset();
  geo.watchPosition.mockImplementation(() => 1);
  geo.clearWatch.mockClear();
  geo.setRNConfiguration.mockClear();
  resetGeolocationConfigurationForTests();
  jest.spyOn(driverLocationApi, 'post').mockResolvedValue(undefined);
});

afterEach(() => {
  locationTrackingService.reset();
  setOS(originalOS);
  jest.restoreAllMocks();
});

describe('driver tracker permission on Android (T-596)', () => {
  beforeEach(() => setOS('android'));

  it('asks for fine and coarse together; precise access starts tracking with no library prompt', async () => {
    granted({});
    const requestMultiple = answers(GRANTED, GRANTED);
    const request = jest.spyOn(PermissionsAndroid, 'request');

    expect(await locationTrackingService.startTracking()).toBe(true);

    expect(requestMultiple).toHaveBeenCalledWith([FINE, COARSE]);
    expect(request).not.toHaveBeenCalled();
    expect(geo.setRNConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ skipPermissionRequests: true, enableBackgroundLocationUpdates: false }),
    );
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
    expect(locationTrackingService.getTrackingStatus()).toBe(true);
  });

  it('approximate only from the prompt: does not track coarse', async () => {
    granted({});
    answers(DENIED, GRANTED);

    expect(await locationTrackingService.startTracking()).toBe(false);

    expect(geo.watchPosition).not.toHaveBeenCalled();
    expect(locationTrackingService.getTrackingStatus()).toBe(false);
  });

  it('approximate already granted: no new prompt, no tracking, but the offline map may still hold the watch', async () => {
    granted({ coarse: true });
    const requestMultiple = answers(GRANTED, GRANTED);

    expect(await locationTrackingService.startTracking()).toBe(false);
    expect(geo.watchPosition).not.toHaveBeenCalled();

    const release = locationTrackingService.acquireLocationWatch();
    await settle();
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
    release();

    expect(requestMultiple).not.toHaveBeenCalled();
  });

  it('refused: neither tracking nor a watch', async () => {
    granted({});
    answers(DENIED, DENIED);

    expect(await locationTrackingService.startTracking()).toBe(false);
    locationTrackingService.acquireLocationWatch();
    await settle();

    expect(geo.watchPosition).not.toHaveBeenCalled();
  });

  it('precise already granted: tracks without asking', async () => {
    granted({ fine: true, coarse: true });
    const requestMultiple = answers(DENIED, DENIED);

    expect(await locationTrackingService.startTracking()).toBe(true);
    expect(requestMultiple).not.toHaveBeenCalled();
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
  });
});

describe('driver tracker permission on iOS (unchanged)', () => {
  it('lets the library ask "while using" on the first watch and never calls PermissionsAndroid', async () => {
    setOS('ios');
    const check = jest.spyOn(PermissionsAndroid, 'check');
    const requestMultiple = jest.spyOn(PermissionsAndroid, 'requestMultiple');

    expect(await locationTrackingService.startTracking()).toBe(true);

    expect(geo.setRNConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ skipPermissionRequests: false, authorizationLevel: 'whenInUse' }),
    );
    expect(requestMultiple).not.toHaveBeenCalled();
    // locationOsUndetermined does not check PermissionsAndroid on iOS either.
    expect(check).not.toHaveBeenCalled();
  });
});

describe('approximate-only status (T-596)', () => {
  it.each([
    [{ fine: true, coarse: true }, false],
    [{ coarse: true }, true],
    [{}, false],
  ])('Android %j → %s', async (has, expected) => {
    setOS('android');
    granted(has);
    expect(await locationOsApproximateOnly()).toBe(expected);
  });

  it('is false on iOS', async () => {
    setOS('ios');
    expect(await locationOsApproximateOnly()).toBe(false);
  });

  it('useLocationBlocked reports the approximate reason on Android', async () => {
    setOS('android');
    granted({ coarse: true });
    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));

    const { result } = renderHook(() => useLocationBlocked(true));
    await settle();

    expect(result.current.blocked).toBe(true);
    expect(result.current.reason).toBe('approximate');
  });
});

describe('Drive sheet "Turn on precise location" (T-596)', () => {
  it('offline with approximate only: the precise card replaces Go online', async () => {
    render(
      <ThemeProvider>
        <DriveSheetBody
          status="offline"
          busy={false}
          disabled={false}
          onToggle={jest.fn()}
          hasRide={false}
          onResume={jest.fn()}
          isApproved
          vehicleType="car"
          locationBlocked={{ onOpenSettings: jest.fn(), onRetry: jest.fn(), reason: 'approximate' }}
        />
      </ThemeProvider>,
    );
    await settle();

    expect(screen.getByTestId('drive-location-precise-needed')).toBeTruthy();
    expect(screen.getByText('Turn on precise location')).toBeTruthy();
    expect(screen.getByTestId('drive-location-open-settings')).toBeTruthy();
    expect(screen.queryByTestId('drive-online-toggle')).toBeNull();
  });
});
