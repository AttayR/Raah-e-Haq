/**
 * T-583 (BE-113): one booking per tap. A confirm after one that got no answer reuses its
 * Idempotency-Key for the same body; a 200 + Idempotent-Replayed is read like the 201; a 409
 * RIDE_ALREADY_ACTIVE opens the open ride or parcel (GET /rides/{id}) instead of an error; the
 * parcel form does the same. (The swipe-back guard is tested in qaFollowUpsT585.test.tsx.)
 */
import React from 'react';
import { Provider } from 'react-redux';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import rideService from '../../../src/services/rideService';
import * as modals from '../../../src/components/NotificationManager';
import { toast, toastStore, useScreenToast } from '../../../src/core/toast';
import { resetScreenToasts } from '../../../src/core/toast/screenToast';
import { openActiveBooking, RideRequestRefused, useActiveRideActions } from '../../../src/features/active-ride/hooks';
import { createActiveRide } from '../../../src/features/active-ride/slice';
import { classifyRideRequestFailure } from '../../../src/features/ride-booking/rideRequestFailure';
import { createBookingAttemptKeys } from '../../../src/features/ride-booking/idempotency';
import { useBookingRequest } from '../../../src/features/ride-booking/useBookingRequest';
import type { FareOffer } from '../../../src/features/fare/hooks';
import { envelope, makeRide, makeRideRequest, makeStore } from '../../../test-utils/rideFixtures';

const ALREADY_ACTIVE_409 = {
  success: false,
  message: 'You already have a booking in progress. Open it, or cancel it before booking again.',
  error: {
    code: 'RIDE_ALREADY_ACTIVE',
    message: 'You already have a booking in progress. Open it, or cancel it before booking again.',
    ride_id: 202,
    ride_ref: 'RIDE-01M59Z',
    status: 'requested',
    vehicle_type: 'car',
  },
};

let mock: MockAdapter;
let showError: jest.SpyInstance;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  showError = jest.spyOn(modals, 'showErrorModal').mockImplementation(() => undefined);
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
  act(() => {
    toast.hide();
    resetScreenToasts();
  });
});

describe('classifyRideRequestFailure (BE-113)', () => {
  const base = { message: 'x', fieldErrors: {} };

  it('409 RIDE_ALREADY_ACTIVE with a ride id is `already_active`', () => {
    expect(
      classifyRideRequestFailure({ ...base, kind: 'conflict', status: 409, code: 'RIDE_ALREADY_ACTIVE', message: 'Open', extra: { ride_id: 202 } }, 'f'),
    ).toEqual({ kind: 'already_active', message: 'Open', rideId: 202 });
    // Without an id there is nothing to open: the server's message.
    expect(classifyRideRequestFailure({ ...base, kind: 'conflict', status: 409, code: 'RIDE_ALREADY_ACTIVE', message: 'Open' }, 'f')).toEqual({
      kind: 'message',
      message: 'Open',
    });
  });

  it('no answer (network, timeout) is marked uncertain; an answer is not', () => {
    expect(classifyRideRequestFailure({ ...base, kind: 'network', message: 'Network error.' }, 'f')).toEqual({
      kind: 'message',
      message: 'Network error.',
      uncertain: true,
    });
    expect(classifyRideRequestFailure({ ...base, kind: 'timeout', message: 'Timed out' }, 'f')).toMatchObject({ uncertain: true });
    expect(classifyRideRequestFailure({ ...base, kind: 'server', status: 500, message: 'Oops' }, 'f')).toEqual({ kind: 'message', message: 'Oops' });
  });
});

describe('booking attempt keys', () => {
  let n = 0;
  const next = () => `key-${(n += 1)}`;
  beforeEach(() => {
    n = 0;
  });

  it('a fresh key per attempt once the server answered', () => {
    const keys = createBookingAttemptKeys(next);
    expect(keys.keyFor(makeRideRequest())).toBe('key-1');
    keys.settle(false);
    expect(keys.keyFor(makeRideRequest())).toBe('key-2');
  });

  it('the same body after no answer keeps the key; a changed body does not', () => {
    const keys = createBookingAttemptKeys(next);
    expect(keys.keyFor(makeRideRequest())).toBe('key-1');
    keys.settle(true);
    expect(keys.keyFor(makeRideRequest())).toBe('key-1');
    keys.settle(true);
    expect(keys.keyFor(makeRideRequest({ vehicle_type: 'bike' }))).toBe('key-2');
    keys.settle(false);
    expect(keys.keyFor(makeRideRequest({ vehicle_type: 'bike' }))).toBe('key-3');
  });
});

describe('useBookingRequest retries with the same key after no answer', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const offer: FareOffer = { band: null, value: null, offeredFare: null, step: jest.fn(), reset: jest.fn(), applyBand: jest.fn(() => false) };
  const flow = {
    pickup: { latitude: 31.52, longitude: 74.35, address: 'Fake Pickup Street' },
    destination: { latitude: 31.48, longitude: 74.3, address: 'Fake Dropoff Road' },
    stops: [],
    selectedVehicle: 'car',
    femaleDriverOnly: false,
    setError: jest.fn(),
    setStage: jest.fn(),
  };

  const tap = async (confirm: () => void) => {
    act(() => confirm());
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
  };

  it('network failure → same key; an answered refusal → a new key', async () => {
    const requestRide = jest
      .fn()
      .mockRejectedValueOnce(new RideRequestRefused({ kind: 'message', message: 'Network error.', uncertain: true }))
      .mockRejectedValueOnce(new RideRequestRefused({ kind: 'message', message: 'Refused' }))
      .mockResolvedValue(makeRide());
    const { result } = renderHook(() => useBookingRequest({ flow, offer, requestRide }));

    await tap(result.current.confirm);
    await waitFor(() => expect(requestRide).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.busy).toBe(false));
    await tap(result.current.confirm);
    await waitFor(() => expect(requestRide).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.busy).toBe(false));
    await tap(result.current.confirm);
    await waitFor(() => expect(requestRide).toHaveBeenCalledTimes(3));

    const keys = requestRide.mock.calls.map((call) => call[1]);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it('`already_active` keeps the sheet on the ride (not back to Choose a ride)', async () => {
    const setStage = jest.fn();
    const requestRide = jest.fn().mockRejectedValue(new RideRequestRefused({ kind: 'already_active', message: 'Open', rideId: 202 }));
    const { result } = renderHook(() => useBookingRequest({ flow: { ...flow, setStage }, offer, requestRide }));
    await tap(result.current.confirm);
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(setStage).toHaveBeenLastCalledWith('requesting');
    expect(setStage).not.toHaveBeenCalledWith('vehicle');
  });
});

describe('POST /rides answers (BE-113)', () => {
  it('200 + Idempotent-Replayed is read exactly like the 201: the ride becomes the active ride', async () => {
    mock.onPost('/rides').reply(200, envelope(makeRide({ id: 77, status: 'accepted' }), { message: 'Ride request created successfully' }), {
      'Idempotent-Replayed': 'true',
    });
    const store = makeStore();
    const action = await store.dispatch(createActiveRide({ ...makeRideRequest(), idempotencyKey: 'abc-12345' }));
    expect(createActiveRide.fulfilled.match(action)).toBe(true);
    expect(store.getState().activeRide.ride?.id).toBe(77);
    expect(mock.history.post[0].headers?.['Idempotency-Key']).toBe('abc-12345');
  });

  it('409 RIDE_ALREADY_ACTIVE opens that ride (GET /rides/{id}) with a note, no error modal', async () => {
    mock.onPost('/rides').reply(409, ALREADY_ACTIVE_409);
    mock.onGet('/rides/202').reply(200, envelope(makeRide({ id: 202, status: 'requested' })));
    const info = jest.spyOn(toast, 'info');
    const store = makeStore();
    const wrapper = ({ children }: React.PropsWithChildren) => <Provider store={store}>{children}</Provider>;
    const { result } = renderHook(() => useActiveRideActions(), { wrapper });

    let refusal: unknown;
    await act(async () => {
      await result.current.requestRide(makeRideRequest(), 'key-1').catch((e: unknown) => {
        refusal = e;
      });
    });
    expect(refusal).toBeInstanceOf(RideRequestRefused);
    expect((refusal as RideRequestRefused).failure).toMatchObject({ kind: 'already_active', rideId: 202 });
    expect(store.getState().activeRide.ride?.id).toBe(202);
    expect(showError).not.toHaveBeenCalled();
    // T-585: the note waits for Booking to show the opened booking, then shows.
    expect(info).not.toHaveBeenCalled();
    expect(toastStore.getCurrent()).toBeNull();
    renderHook(() => useScreenToast('booking', true));
    await waitFor(() =>
      expect(toastStore.getCurrent()).toMatchObject({
        type: 'info',
        title: 'You already have a booking',
        message: 'Here it is. Cancel it before you book again.',
      }),
    );
  });

  it('409 whose ride has ended meanwhile shows the server message instead', async () => {
    mock.onPost('/rides').reply(409, ALREADY_ACTIVE_409);
    mock.onGet('/rides/202').reply(200, envelope(makeRide({ id: 202, status: 'cancelled' })));
    const store = makeStore();
    const wrapper = ({ children }: React.PropsWithChildren) => <Provider store={store}>{children}</Provider>;
    const { result } = renderHook(() => useActiveRideActions(), { wrapper });
    await act(async () => {
      await result.current.requestRide(makeRideRequest(), 'key-1').catch(() => undefined);
    });
    expect(store.getState().activeRide.ride).toBeNull();
    expect(showError).toHaveBeenCalledWith('Ride Request Failed', ALREADY_ACTIVE_409.message, expect.anything());
  });

  it('409 while another live ride is held: that ride stays, no "already have a booking" note', async () => {
    const store = makeStore();
    mock.onPost('/rides').replyOnce(201, envelope(makeRide({ id: 300, status: 'accepted' })));
    await store.dispatch(createActiveRide(makeRideRequest()));
    mock.onGet('/rides/202').reply(200, envelope(makeRide({ id: 202, status: 'requested' })));
    const info = jest.spyOn(toast, 'info');
    await expect(openActiveBooking(store.dispatch, 202)).resolves.toBeNull();
    expect(store.getState().activeRide.ride?.id).toBe(300);
    expect(info).not.toHaveBeenCalled();
    renderHook(() => useScreenToast('booking', true));
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 50);
      });
    });
    expect(toastStore.getCurrent()).toBeNull();
  });

  it('createRide resolves the replayed ride from a 200 body', async () => {
    mock.onPost('/rides').reply(200, envelope(makeRide({ id: 88 })), { 'Idempotent-Replayed': 'true' });
    await expect(rideService.createRide(makeRideRequest(), { idempotencyKey: 'abc-12345' })).resolves.toMatchObject({ id: 88 });
  });
});
