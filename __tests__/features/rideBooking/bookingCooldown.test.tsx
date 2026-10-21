/**
 * BOOKING_COOLDOWN: POST /rides answers 429 `{code: BOOKING_COOLDOWN, retry_after}` (plus
 * Retry-After) after 5 unaccepted requests were cancelled within 30 minutes. The server's message
 * is shown in the refusal dialog, Request is disabled with a countdown from retry_after (a timer
 * that is cleaned up), and nothing is retried automatically.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { act, render, renderHook } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import { dialog, dialogStore } from '../../../src/core/dialog';
import { RideRequestRefused, useActiveRideActions } from '../../../src/features/active-ride/hooks';
import { classifyRideRequestFailure } from '../../../src/features/ride-booking/rideRequestFailure';
import {
  BOOKING_COOLDOWN_FALLBACK_SECONDS,
  bookingCooldownSeconds,
  holdBookings,
  resetBookingCooldown,
} from '../../../src/features/ride-booking/bookingCooldown';
import { ChooseRideFooter } from '../../../src/features/ride-booking/components/BookingStages';
import { toVehicleOptions } from '../../../src/features/ride-booking/vehicleOptions';
import type { FareEstimates, VehicleType } from '../../../src/features/ride-booking/api';
import { setLocale } from '../../../src/i18n';
import '../../../src/i18n/copy-ur-Latn';
import { makeRideRequest, makeStore } from '../../../test-utils/rideFixtures';

const MESSAGE = 'You cancelled several requests. You can book again in a few minutes.';
const cooldown429 = (retryAfter: number) =>
  [
    429,
    {
      success: false,
      message: MESSAGE,
      code: 'BOOKING_COOLDOWN',
      retry_after: retryAfter,
      error: { code: 'BOOKING_COOLDOWN', message: MESSAGE, retry_after: retryAfter },
    },
    { 'Retry-After': String(retryAfter) },
  ] as const;

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
});
afterEach(() => {
  act(() => dialog.dismissAll());
  resetBookingCooldown();
  mock.restore();
  setLocale('en');
  jest.useRealTimers();
});

describe('classifyRideRequestFailure: BOOKING_COOLDOWN', () => {
  const base = { kind: 'rate_limited' as const, status: 429, code: 'BOOKING_COOLDOWN', message: MESSAGE, fieldErrors: {} };

  it('is a cooldown with the server message and retry_after', () => {
    expect(classifyRideRequestFailure({ ...base, retryAfter: 300 }, 'x')).toEqual({ kind: 'cooldown', message: MESSAGE, retryAfter: 300 });
  });

  it('falls back to the nested error.retry_after, then to none', () => {
    expect(classifyRideRequestFailure({ ...base, extra: { retry_after: 90 } }, 'x')).toEqual({ kind: 'cooldown', message: MESSAGE, retryAfter: 90 });
    expect(classifyRideRequestFailure(base, 'x')).toEqual({ kind: 'cooldown', message: MESSAGE, retryAfter: null });
  });
});

describe('bookingCooldown hold', () => {
  it('counts down from retry_after and ends by itself; a missing value waits the fallback', () => {
    holdBookings(5, 1_000);
    expect(bookingCooldownSeconds(1_000)).toBe(5);
    expect(bookingCooldownSeconds(5_500)).toBe(1);
    expect(bookingCooldownSeconds(6_000)).toBe(0);
    holdBookings(null, 0);
    expect(bookingCooldownSeconds(0)).toBe(BOOKING_COOLDOWN_FALLBACK_SECONDS);
  });
});

describe('useActiveRideActions.requestRide: 429 BOOKING_COOLDOWN', () => {
  it('shows the server message in the refusal dialog, holds booking for retry_after and sends one POST', async () => {
    jest.useFakeTimers();
    mock.onPost('/rides').reply(...cooldown429(240));
    const store = makeStore();
    const wrapper = ({ children }: React.PropsWithChildren) => <Provider store={store}>{children}</Provider>;
    const { result } = renderHook(() => useActiveRideActions({}), { wrapper });

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current.requestRide(makeRideRequest()).catch((e) => e);
    });

    expect(thrown).toBeInstanceOf(RideRequestRefused);
    expect((thrown as RideRequestRefused).failure).toEqual({ kind: 'cooldown', message: MESSAGE, retryAfter: 240 });
    expect(dialogStore.getCurrent()).toMatchObject({ kind: 'alert', title: 'Ride Request Failed', body: MESSAGE });
    expect(bookingCooldownSeconds()).toBe(240);

    // Never retried automatically, not even once the hold has passed.
    await act(async () => {
      jest.advanceTimersByTime(241_000);
    });
    expect(mock.history.post.filter((r) => r.url === '/rides')).toHaveLength(1);
    expect(bookingCooldownSeconds()).toBe(0);
  });
});

describe('ChooseRideFooter while a BOOKING_COOLDOWN runs', () => {
  const types: VehicleType[] = [{ key: 'car', label: 'Car', capacity: 4 }];
  const estimates: FareEstimates = {
    distance_km: 5,
    duration_min: 12,
    estimates: [
      {
        vehicle_type: 'car',
        fare: 230,
        currency: 'PKR',
        breakdown: { base: 50, distance: 150, time: 30, stops: 0, min_fare_adjustment: 0, booking_fee: 0 },
        offer_band: null,
        fare_policy: null,
      },
    ],
    fare_notice: null,
  };
  const loaded = { status: 'ready' as const, data: estimates, error: null, retry: jest.fn() };
  const options = toVehicleOptions(types, estimates);
  const footer = () => <ChooseRideFooter options={options} estimates={loaded} selectedVehicle="car" onConfirm={jest.fn()} />;

  it('is disabled with a countdown, ticks each second and comes back by itself', () => {
    jest.useFakeTimers();
    act(() => holdBookings(65));
    const { getByTestId } = render(footer());
    expect(getByTestId('fare-request')).toHaveTextContent('Request again in 1:05');
    expect(getByTestId('fare-request').props.accessibilityState).toMatchObject({ disabled: true });

    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    expect(getByTestId('fare-request')).toHaveTextContent('Request again in 1:04');

    act(() => {
      jest.advanceTimersByTime(64_000);
    });
    expect(getByTestId('fare-request')).toHaveTextContent('Request Car · Rs 230');
    expect(getByTestId('fare-request').props.accessibilityState).toMatchObject({ disabled: false });
    // The interval stopped at 0.
    expect(jest.getTimerCount()).toBe(0);
  });

  it('a hold that starts while the footer is shown disables it at once', () => {
    jest.useFakeTimers();
    const { getByTestId } = render(footer());
    expect(getByTestId('fare-request')).toHaveTextContent('Request Car · Rs 230');
    act(() => holdBookings(30));
    expect(getByTestId('fare-request')).toHaveTextContent('Request again in 0:30');
  });

  it('clears its timer on unmount', () => {
    jest.useFakeTimers();
    act(() => holdBookings(120));
    const { unmount } = render(footer());
    expect(jest.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('reads in Roman Urdu', () => {
    setLocale('ur-Latn');
    act(() => holdBookings(45));
    const { getByTestId } = render(footer());
    expect(getByTestId('fare-request')).toHaveTextContent('0:45 mein dobara request karein');
  });
});
