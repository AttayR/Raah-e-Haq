/**
 * T-403/T-404: the incoming-requests slice (expiry, local reject, 409/429) and the accepted ride.
 */
import { configureStore } from '@reduxjs/toolkit';
import { ApiError } from '../../../src/core/api/errors';
import { rootReducer } from '../../../src/store/rootReducer';
import { resetApp } from '../../../src/store/actions';
import { driverRequestsApi } from '../../../src/features/driver-requests/api';
import {
  acceptRideRequest,
  clearPendingRequests,
  dismissRideRequest,
  fetchPendingRides,
  pruneExpiredRequests,
} from '../../../src/features/driver-requests/slice';
import { selectDriverActiveRide } from '../../../src/features/driver-ride/slice';
import { makePendingRequest } from '../../../test-utils/driverRequestFixtures';
import { makeRide } from '../../../test-utils/rideFixtures';

const makeStore = () => configureStore({ reducer: rootReducer });

const conflict = (code: string) =>
  new ApiError({ kind: 'conflict', status: 409, code, message: 'Refused by the server' });

afterEach(() => jest.restoreAllMocks());

describe('fetchPendingRides', () => {
  it('stores the answer, without requests whose window has passed', async () => {
    const now = Date.now();
    jest.spyOn(driverRequestsApi, 'listPending').mockResolvedValue({
      requests: [
        makePendingRequest({ id: 1, expiresAt: now + 60_000 }),
        makePendingRequest({ id: 2, expiresAt: now - 1 }),
        makePendingRequest({ id: 3, expiresAt: null }),
      ],
    });
    const store = makeStore();
    const pending = store.dispatch(fetchPendingRides(null));
    expect(store.getState().driverRequests.loadStatus).toBe('loading');
    await pending;

    const state = store.getState().driverRequests;
    expect(state.loadStatus).toBe('done');
    expect(state.items.map((item) => item.id)).toEqual([1, 3]);
  });

  it('keeps a rejected id hidden while it is listed and forgets it once it is not', async () => {
    const list = jest.spyOn(driverRequestsApi, 'listPending');
    list.mockResolvedValue({ requests: [makePendingRequest({ id: 1 }), makePendingRequest({ id: 2 })] });
    const store = makeStore();
    await store.dispatch(fetchPendingRides(null));

    store.dispatch(dismissRideRequest(1));
    expect(store.getState().driverRequests.items.map((item) => item.id)).toEqual([2]);

    await store.dispatch(fetchPendingRides(null));
    expect(store.getState().driverRequests.items.map((item) => item.id)).toEqual([2]);
    expect(store.getState().driverRequests.dismissedIds).toEqual([1]);

    list.mockResolvedValue({ requests: [makePendingRequest({ id: 2 })] });
    await store.dispatch(fetchPendingRides(null));
    expect(store.getState().driverRequests.dismissedIds).toEqual([]);
  });

  it('a 409 clears the list and keeps the code; a 429 keeps the list', async () => {
    const list = jest.spyOn(driverRequestsApi, 'listPending');
    list.mockResolvedValueOnce({ requests: [makePendingRequest({ id: 1 })] });
    const store = makeStore();
    await store.dispatch(fetchPendingRides(null));

    list.mockRejectedValueOnce(
      new ApiError({ kind: 'rate_limited', status: 429, code: 'rate_limited', retryAfter: 9, message: 'Slow down' }),
    );
    await store.dispatch(fetchPendingRides(null));
    expect(store.getState().driverRequests.items).toHaveLength(1);
    expect(store.getState().driverRequests.loadStatus).toBe('done');

    list.mockRejectedValueOnce(conflict('NO_APPROVED_VEHICLE'));
    await store.dispatch(fetchPendingRides(null));
    const state = store.getState().driverRequests;
    expect(state.items).toEqual([]);
    expect(state.loadStatus).toBe('failed');
    expect(state.errorCode).toBe('NO_APPROVED_VEHICLE');
  });

  it('a network failure keeps the list and shows the error', async () => {
    const list = jest.spyOn(driverRequestsApi, 'listPending');
    list.mockResolvedValueOnce({ requests: [makePendingRequest({ id: 1 })] });
    const store = makeStore();
    await store.dispatch(fetchPendingRides(null));
    list.mockRejectedValueOnce(new ApiError({ kind: 'network', message: 'Network error. Please check your connection.' }));
    await store.dispatch(fetchPendingRides(null));
    expect(store.getState().driverRequests.items).toHaveLength(1);
    expect(store.getState().driverRequests.error).toBe('Network error. Please check your connection.');
  });

  it('pruneExpiredRequests and clearPendingRequests', async () => {
    jest.spyOn(driverRequestsApi, 'listPending').mockResolvedValue({
      requests: [makePendingRequest({ id: 1, expiresAt: Date.now() + 1_000 })],
    });
    const store = makeStore();
    await store.dispatch(fetchPendingRides(null));
    store.dispatch(pruneExpiredRequests(Date.now() + 2_000));
    expect(store.getState().driverRequests.items).toEqual([]);

    await store.dispatch(fetchPendingRides(null));
    store.dispatch(clearPendingRequests());
    expect(store.getState().driverRequests).toMatchObject({ items: [], loadStatus: 'idle', error: null });
  });
});

describe('acceptRideRequest', () => {
  it('puts the accepted ride in driverRide and empties the list', async () => {
    jest.spyOn(driverRequestsApi, 'listPending').mockResolvedValue({ requests: [makePendingRequest({ id: 41 })] });
    const accepted = makeRide({ id: 41, status: 'accepted', driver_id: 5, accepted_at: '2026-10-09T10:01:00Z' });
    jest.spyOn(driverRequestsApi, 'accept').mockResolvedValue(accepted);
    const store = makeStore();
    await store.dispatch(fetchPendingRides(null));

    await store.dispatch(acceptRideRequest(41));

    expect(selectDriverActiveRide(store.getState())).toEqual(accepted);
    expect(store.getState().driverRequests.items).toEqual([]);
    expect(store.getState().driverRequests.acceptingId).toBeNull();
  });

  it('sends one request on a double tap', async () => {
    let finish: (ride: ReturnType<typeof makeRide>) => void = () => undefined;
    const accept = jest
      .spyOn(driverRequestsApi, 'accept')
      .mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const store = makeStore();

    const first = store.dispatch(acceptRideRequest(41));
    const second = store.dispatch(acceptRideRequest(41));
    expect(store.getState().driverRequests.acceptingId).toBe(41);
    finish(makeRide({ id: 41, status: 'accepted' }));
    await Promise.all([first, second]);

    expect(accept).toHaveBeenCalledTimes(1);
  });

  it.each(['RIDE_ALREADY_ACCEPTED', 'RIDE_NOT_AVAILABLE', 'DRIVER_ON_RIDE', 'DRIVER_NOT_AVAILABLE', 'NO_APPROVED_VEHICLE'])(
    'a 409 %s removes the request and keeps it hidden',
    async (code) => {
      jest.spyOn(driverRequestsApi, 'listPending').mockResolvedValue({
        requests: [makePendingRequest({ id: 41 }), makePendingRequest({ id: 42 })],
      });
      jest.spyOn(driverRequestsApi, 'accept').mockRejectedValue(conflict(code));
      const store = makeStore();
      await store.dispatch(fetchPendingRides(null));

      const action = await store.dispatch(acceptRideRequest(41));

      expect(action.payload).toMatchObject({ code, status: 409 });
      expect(store.getState().driverRequests.items.map((item) => item.id)).toEqual([42]);
      expect(selectDriverActiveRide(store.getState())).toBeNull();
      await store.dispatch(fetchPendingRides(null));
      expect(store.getState().driverRequests.items.map((item) => item.id)).toEqual([42]);
    },
  );

  it('a 403 PHONE_NOT_VERIFIED keeps the request', async () => {
    jest.spyOn(driverRequestsApi, 'listPending').mockResolvedValue({ requests: [makePendingRequest({ id: 41 })] });
    jest.spyOn(driverRequestsApi, 'accept').mockRejectedValue(
      new ApiError({ kind: 'forbidden', status: 403, code: 'PHONE_NOT_VERIFIED', message: 'Verify your phone' }),
    );
    const store = makeStore();
    await store.dispatch(fetchPendingRides(null));
    await store.dispatch(acceptRideRequest(41));
    expect(store.getState().driverRequests.items).toHaveLength(1);
  });

  it('logout (resetApp) clears the requests and the accepted ride', async () => {
    jest.spyOn(driverRequestsApi, 'accept').mockResolvedValue(makeRide({ id: 41, status: 'accepted' }));
    const store = makeStore();
    await store.dispatch(acceptRideRequest(41));
    store.dispatch(resetApp());
    expect(selectDriverActiveRide(store.getState())).toBeNull();
    expect(store.getState().driverRequests.dismissedIds).toEqual([]);
  });
});
