/**
 * UI-R11 Drive v2 (driver-drive-home D2) and request countdown (driver-incoming-request R3): the
 * subtitle notice order, the status block, the feed error grace (R6), the tracker's failed
 * uploads and weak GPS signals, and the wall-clock countdown maths.
 */
import React from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ApiError } from '../../src/core/api/errors';
import { rootReducer } from '../../src/store/rootReducer';
import { driveNotice, type DriveNoticeInput } from '../../src/components/driver/drive/driveNotice';
import { DriveStatusHeader } from '../../src/components/driver/drive/DriveStatusHeader';
import { driverRequestsApi } from '../../src/features/driver-requests/api';
import { useRideRequestFeedNotice } from '../../src/features/driver-requests/hooks';
import { fetchPendingRides } from '../../src/features/driver-requests/slice';
import {
  REQUEST_DECISION_SECONDS,
  offerDurationMs,
  useOfferClock,
  useOfferCountdown,
  type OfferClock,
} from '../../src/features/driver-requests/countdown';
import { countdownRemainingMs, countdownSecondsLeft, type CountdownSpec } from '../../src/components/ui';
import { useLocationUploadsFailing, useWeakGpsSignal } from '../../src/features/driver-location/hooks';
import locationTrackingService, { type LocationFix } from '../../src/services/locationTrackingService';
import { makePendingRequest } from '../../test-utils/driverRequestFixtures';
import { setLocale } from '../../src/i18n';
import '../../src/i18n/copy-ur-Latn';
import { resetLanguagePreferenceForTests } from '../../src/i18n/languagePreference';

const base: DriveNoticeInput = {
  status: 'online',
  deviceOffline: false,
  uploadsFailing: false,
  feedFailed: false,
  hasFix: true,
  weakGps: false,
  autoAccept: false,
};

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
};

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  resetLanguagePreferenceForTests();
});

describe('driveNotice (D2 order, first match wins)', () => {
  it('follows the table order', () => {
    const all = {
      ...base,
      deviceOffline: true,
      uploadsFailing: true,
      feedFailed: true,
      hasFix: false,
      weakGps: true,
      autoAccept: true,
    };
    expect(driveNotice({ ...all, status: 'checking' })).toBe('checking');
    expect(driveNotice(all)).toBe('deviceOffline');
    expect(driveNotice({ ...all, deviceOffline: false })).toBe('uploadsFailing');
    expect(driveNotice({ ...all, deviceOffline: false, uploadsFailing: false })).toBe('feedFailed');
    expect(
      driveNotice({
        ...all,
        deviceOffline: false,
        uploadsFailing: false,
        feedFailed: false,
      }),
    ).toBe('noFix');
    expect(driveNotice({ ...base, weakGps: true, autoAccept: true })).toBe('weakGps');
    expect(driveNotice({ ...base, autoAccept: true })).toBe('autoAccept');
    expect(driveNotice(base)).toBe('online');
  });

  it('offline and on-ride drivers only get the notices that apply to them', () => {
    const offline = { ...base, status: 'offline' as const };
    expect(
      driveNotice({
        ...offline,
        uploadsFailing: true,
        feedFailed: true,
        hasFix: false,
        weakGps: true,
      }),
    ).toBe('offline');
    expect(driveNotice({ ...offline, deviceOffline: true })).toBe('deviceOffline');
    const onRide = { ...base, status: 'onRide' as const };
    expect(driveNotice({ ...onRide, feedFailed: true, hasFix: false })).toBe('onRide');
    expect(driveNotice({ ...onRide, uploadsFailing: true })).toBe('uploadsFailing');
    expect(driveNotice({ ...onRide, weakGps: true })).toBe('weakGps');
  });
});

describe('DriveStatusHeader (D2)', () => {
  it('shows the hint under the status in the subtitle slot, read as one summary', () => {
    const { getByTestId, getByText } = render(<DriveStatusHeader status="offline" />);
    getByText("You're offline");
    expect(getByTestId('drive-hint').props.children).toBe('Go online to start getting ride requests.');
    expect(getByText("You're offline").parent?.parent).toBeTruthy();
  });

  it('a notice replaces the hint; the feed error offers Retry; no shimmer while a notice shows', () => {
    const onRetry = jest.fn();
    const { getByTestId, queryByTestId, rerender } = render(
      <DriveStatusHeader status="online" notice="feedFailed" onRetry={onRetry} />,
    );
    expect(getByTestId('drive-hint').props.children).toBe("Couldn't load ride requests.");
    fireEvent.press(getByTestId('drive-notice-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(queryByTestId('drive-searching')).toBeNull();
    rerender(<DriveStatusHeader status="online" notice="online" />);
    expect(queryByTestId('drive-notice-retry')).toBeNull();
    getByTestId('drive-searching');
    rerender(<DriveStatusHeader status="online" notice="weakGps" />);
    expect(getByTestId('drive-hint').props.children).toBe('Weak GPS signal. Requests may be delayed.');
  });

  it('checking draws a skeleton; Roman Urdu notices', () => {
    const { getByTestId, queryByTestId, rerender } = render(<DriveStatusHeader status="checking" notice="checking" />);
    getByTestId('drive-hint-skeleton', { includeHiddenElements: true });
    expect(queryByTestId('drive-hint')).toBeNull();
    setLocale('ur-Latn');
    rerender(<DriveStatusHeader status="online" notice="deviceOffline" />);
    expect(getByTestId('drive-hint').props.children).toBe('Aap offline hain. Requests ruki hui hain.');
  });
});

describe('useRideRequestFeedNotice (R6 first-poll grace)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  });

  const locationRequired = () =>
    new ApiError({
      kind: 'validation',
      status: 422,
      code: 'LOCATION_REQUIRED',
      message: 'Location required',
    });

  it('without a fix, waits for a second failure in a row; with a fix, at once', async () => {
    const store = configureStore({ reducer: rootReducer });
    let fail: (error: unknown) => void = () => undefined;
    jest.spyOn(driverRequestsApi, 'listPending').mockImplementation(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    const Wrapper = ({ children }: React.PropsWithChildren) => <Provider store={store}>{children}</Provider>;
    const hook = renderHook(({ location }: { location: { latitude: number; longitude: number } | null }) => useRideRequestFeedNotice(location), {
      wrapper: Wrapper,
      initialProps: {
        location: null as { latitude: number; longitude: number } | null,
      },
    });
    const failOnce = async () => {
      act(() => {
        store.dispatch(fetchPendingRides(null));
      });
      await flush();
      await act(async () => fail(locationRequired()));
      await flush();
    };
    await failOnce();
    expect(hook.result.current.failed).toBe(false);
    await failOnce();
    expect(hook.result.current.failed).toBe(true);
    expect(hook.result.current.canRetry).toBe(true);
    // With a fix the first failure already shows.
    const withFix = renderHook(() => useRideRequestFeedNotice({ latitude: 31.5, longitude: 74.3 }), {
      wrapper: Wrapper,
    });
    expect(withFix.result.current.failed).toBe(true);
  });

  it('a status refusal is not retryable from the notice', async () => {
    const store = configureStore({ reducer: rootReducer });
    jest.spyOn(driverRequestsApi, 'listPending').mockRejectedValue(
      new ApiError({
        kind: 'conflict',
        status: 409,
        code: 'DRIVER_ON_RIDE',
        message: 'x',
      }),
    );
    const Wrapper = ({ children }: React.PropsWithChildren) => <Provider store={store}>{children}</Provider>;
    const hook = renderHook(() => useRideRequestFeedNotice({ latitude: 31.5, longitude: 74.3 }), { wrapper: Wrapper });
    await act(async () => {
      await store.dispatch(fetchPendingRides(null));
    });
    await flush();
    expect(hook.result.current.failed).toBe(true);
    expect(hook.result.current.canRetry).toBe(false);
  });
});

describe('tracker signals (D2)', () => {
  const fix = (accuracy: number | null): LocationFix => ({
    latitude: 31.5,
    longitude: 74.3,
    heading: null,
    speed: null,
    accuracy,
    timestamp: 0,
  });

  it('uploads failing flips at the threshold and back after a good post', () => {
    let listener: ((failures: number) => void) | undefined;
    const unsubscribe = jest.fn();
    jest.spyOn(locationTrackingService, 'getPostFailures').mockReturnValue(0);
    jest.spyOn(locationTrackingService, 'addPostFailureListener').mockImplementation(fn => {
      listener = fn;
      return unsubscribe;
    });
    const hook = renderHook(() => useLocationUploadsFailing(3));
    expect(hook.result.current).toBe(false);
    act(() => listener?.(2));
    expect(hook.result.current).toBe(false);
    act(() => listener?.(3));
    expect(hook.result.current).toBe(true);
    act(() => listener?.(0));
    expect(hook.result.current).toBe(false);
    hook.unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('weak GPS only after 30 s of fixes worse than 100 m; a good fix clears it', () => {
    jest.useFakeTimers();
    let listener: ((f: LocationFix) => void) | undefined;
    jest.spyOn(locationTrackingService, 'getLastLocation').mockReturnValue(fix(150));
    jest.spyOn(locationTrackingService, 'addLocationListener').mockImplementation(fn => {
      listener = fn;
      return jest.fn();
    });
    const hook = renderHook(() => useWeakGpsSignal(true, 100, 30_000));
    act(() => jest.advanceTimersByTime(29_000));
    expect(hook.result.current).toBe(false);
    act(() => listener?.(fix(180)));
    act(() => jest.advanceTimersByTime(1_000));
    expect(hook.result.current).toBe(true);
    act(() => listener?.(fix(8)));
    expect(hook.result.current).toBe(false);
  });

  it('the tracker counts failed posts in a row and resets on stop', () => {
    const seen: number[] = [];
    const off = locationTrackingService.addPostFailureListener(n => seen.push(n));
    locationTrackingService.stopTracking();
    expect(locationTrackingService.getPostFailures()).toBe(0);
    off();
    expect(seen).toEqual([]);
  });
});

describe('request countdown maths (R3)', () => {
  it('20 s default, the server window when sent, never past the listing expiry', () => {
    expect(REQUEST_DECISION_SECONDS).toBe(20);
    expect(offerDurationMs({ offerSeconds: null, expiresAt: null }, 0)).toBe(20_000);
    expect(offerDurationMs({ offerSeconds: 45, expiresAt: null }, 0)).toBe(45_000);
    expect(offerDurationMs({ offerSeconds: 45, expiresAt: 8_000 }, 0)).toBe(8_000);
    expect(offerDurationMs({ offerSeconds: null, expiresAt: 1_000 }, 5_000)).toBe(0);
  });

  it('remaining time is wall-clock from the start (a backgrounded app comes back right)', () => {
    const spec: CountdownSpec = { startedAt: 1_000, durationMs: 20_000 };
    expect(countdownRemainingMs(spec, 1_000)).toBe(20_000);
    expect(countdownSecondsLeft(spec, 1_100)).toBe(20);
    expect(countdownSecondsLeft(spec, 19_100)).toBe(2);
    expect(countdownSecondsLeft(spec, 20_100)).toBe(1);
    expect(countdownSecondsLeft(spec, 60_000)).toBe(0);
  });

  it('useOfferClock starts when ready, pauses and resumes without losing time', () => {
    jest.useFakeTimers();
    jest.setSystemTime(10_000);
    const request = makePendingRequest({ id: 7 });
    const hook = renderHook(({ ready, paused }: { ready: boolean; paused: boolean }) => useOfferClock(request, ready, paused), {
      initialProps: { ready: false, paused: false },
    });
    expect(hook.result.current).toBeNull();
    hook.rerender({ ready: true, paused: false });
    expect(hook.result.current).toEqual({
      rideId: 7,
      startedAt: 10_000,
      durationMs: 20_000,
      paused: false,
    });
    jest.setSystemTime(15_000);
    hook.rerender({ ready: true, paused: true });
    expect(hook.result.current?.paused).toBe(true);
    jest.setSystemTime(25_000);
    hook.rerender({ ready: true, paused: false });
    // 10 s paused are added back: 15 s left, as when the pause began.
    expect(hook.result.current?.startedAt).toBe(20_000);
    expect(countdownRemainingMs(hook.result.current as CountdownSpec, 25_000)).toBe(15_000);
  });

  it('useOfferCountdown says 10 then 5 seconds and expires at 0, not while paused', () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    const onExpire = jest.fn();
    const hook = renderHook(({ spec }: { spec: OfferClock | null }) => useOfferCountdown(spec, onExpire), {
      initialProps: {
        spec: { rideId: 7, startedAt: 0, durationMs: 20_000 } as OfferClock | null,
      },
    });
    act(() => jest.advanceTimersByTime(9_999));
    expect(hook.result.current).toBeNull();
    act(() => jest.advanceTimersByTime(1));
    expect(hook.result.current).toBe(10);
    act(() => jest.advanceTimersByTime(5_000));
    expect(hook.result.current).toBe(5);
    expect(onExpire).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(5_000));
    expect(onExpire).toHaveBeenCalledTimes(1);
    // The clock's own ride, whatever is on screen by then.
    expect(onExpire).toHaveBeenCalledWith(7);

    hook.rerender({
      spec: { rideId: 8, startedAt: 20_000, durationMs: 20_000, paused: true },
    });
    expect(hook.result.current).toBeNull();
    act(() => jest.advanceTimersByTime(60_000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
