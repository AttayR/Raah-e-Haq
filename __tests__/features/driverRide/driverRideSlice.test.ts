/**
 * T-405: the driver ride thunks against the BE-04 endpoints. Before, start/complete went
 * through PUT /rides/{id} with a client fare (DRV-05) and there was no arrived, stop or cancel.
 */
import MockAdapter from 'axios-mock-adapter';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { resetApp } from '../../../src/store/actions';
import { bumpSessionEpoch } from '../../../src/store/sessionEpoch';
import { acceptRideRequest } from '../../../src/features/driver-requests/slice';
import {
  advanceDriverRide,
  cancelDriverRide,
  refreshDriverRide,
  restoreDriverRide,
  selectDriverActiveRide,
  setDriverActiveRide,
} from '../../../src/features/driver-ride/slice';
import type { RideResource } from '../../../src/services/rideService';
import { envelope, makeRide } from '../../../test-utils/rideFixtures';

const makeStore = () => configureStore({ reducer: rootReducer });

const refusal = (code: string) => ({
  success: false,
  message: 'Refused by the server',
  error: { code, message: 'Refused by the server' },
});

const storeWithRide = (ride: RideResource) => {
  const store = makeStore();
  store.dispatch(setDriverActiveRide(ride));
  return store;
};

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
});

describe('advanceDriverRide', () => {
  it.each([
    ['arrived', 'accepted', 'arrived'],
    ['start', 'arrived', 'started'],
    ['complete', 'started', 'completed'],
  ] as const)('%s posts /rides/{id}/%s with no body and stores the answer', async (action, from, to) => {
    mock.onPost(`/rides/41/${action}`).reply(200, envelope(makeRide({ status: to })));
    const store = storeWithRide(makeRide({ status: from }));

    const pending = store.dispatch(advanceDriverRide({ rideId: 41, action }));
    expect(store.getState().driverRide.pendingAction).toBe(action);
    await pending;

    expect(mock.history.post).toHaveLength(1);
    expect(mock.history.post[0].data).toBeUndefined();
    expect(mock.history.put).toHaveLength(0);
    expect(selectDriverActiveRide(store.getState())?.status).toBe(to);
    expect(store.getState().driverRide.pendingAction).toBeNull();
  });

  it('complete stores the server fare (no client fare is sent)', async () => {
    mock.onPost('/rides/41/complete').reply(
      200,
      envelope(makeRide({ status: 'completed', total_fare: '412.00' as unknown as number })),
    );
    const store = storeWithRide(makeRide({ status: 'started', total_fare: 190 }));
    await store.dispatch(advanceDriverRide({ rideId: 41, action: 'complete' }));
    expect(selectDriverActiveRide(store.getState())?.total_fare).toBe('412.00');
  });

  it('a stop is completed, then the ride is read again (the stop answer is not a ride)', async () => {
    mock.onPost('/rides/41/stops/5/complete').reply(200, envelope({ id: 41, completed_stops: 1, remaining_stops: 0 }));
    mock.onGet('/rides/41').reply(200, envelope(makeRide({ status: 'started', completed_stops_count: 1 })));
    const store = storeWithRide(makeRide({ status: 'started' }));

    await store.dispatch(advanceDriverRide({ rideId: 41, action: 'stop', stopId: 5 }));

    expect(mock.history.post.map((r) => r.url)).toEqual(['/rides/41/stops/5/complete']);
    expect(mock.history.get.map((r) => r.url)).toEqual(['/rides/41']);
    expect(selectDriverActiveRide(store.getState())?.completed_stops_count).toBe(1);
  });

  it('sends one request on a double tap', async () => {
    mock.onPost('/rides/41/arrived').reply(200, envelope(makeRide({ status: 'arrived' })));
    const store = storeWithRide(makeRide({ status: 'accepted' }));

    const first = store.dispatch(advanceDriverRide({ rideId: 41, action: 'arrived' }));
    const second = await store.dispatch(advanceDriverRide({ rideId: 41, action: 'arrived' }));
    await first;

    expect(second.meta.condition).toBe(true);
    expect(mock.history.post).toHaveLength(1);
  });

  it('a 409 keeps the ride and clears the in-flight flag', async () => {
    mock.onPost('/rides/41/start').reply(409, refusal('INVALID_STATUS_TRANSITION'));
    const store = storeWithRide(makeRide({ status: 'arrived' }));

    const action = await store.dispatch(advanceDriverRide({ rideId: 41, action: 'start' }));

    expect(action.payload).toMatchObject({ status: 409, code: 'INVALID_STATUS_TRANSITION' });
    expect(selectDriverActiveRide(store.getState())?.status).toBe('arrived');
    expect(store.getState().driverRide.pendingAction).toBeNull();
  });

  it('403 NOT_ASSIGNED_DRIVER drops the ride', async () => {
    mock.onPost('/rides/41/arrived').reply(403, refusal('NOT_ASSIGNED_DRIVER'));
    const store = storeWithRide(makeRide({ status: 'accepted' }));
    await store.dispatch(advanceDriverRide({ rideId: 41, action: 'arrived' }));
    expect(selectDriverActiveRide(store.getState())).toBeNull();
  });

  it('drops an answer that arrives after a logout', async () => {
    let release: () => void = () => undefined;
    mock.onPost('/rides/41/arrived').reply(
      () =>
        new Promise((resolve) => {
          release = () => resolve([200, envelope(makeRide({ status: 'arrived' }))]);
        }),
    );
    const store = storeWithRide(makeRide({ status: 'accepted' }));
    const pending = store.dispatch(advanceDriverRide({ rideId: 41, action: 'arrived' }));
    await new Promise((resolve) => setImmediate(resolve));

    bumpSessionEpoch();
    store.dispatch(resetApp());
    release();
    await pending;

    expect(selectDriverActiveRide(store.getState())).toBeNull();
    expect(store.getState().driverRide.pendingAction).toBeNull();
  });
});

describe('refreshDriverRide', () => {
  it('replaces the ride with the server copy', async () => {
    mock.onGet('/rides/41').reply(200, envelope(makeRide({ status: 'cancelled' })));
    const store = storeWithRide(makeRide({ status: 'accepted' }));
    await store.dispatch(refreshDriverRide(41));
    expect(selectDriverActiveRide(store.getState())?.status).toBe('cancelled');
  });

  it('ignores an answer for a ride that is no longer the current one', async () => {
    mock.onGet('/rides/41').reply(200, envelope(makeRide({ id: 41, status: 'started' })));
    const store = storeWithRide(makeRide({ id: 50, status: 'accepted' }));
    await store.dispatch(refreshDriverRide(41));
    expect(selectDriverActiveRide(store.getState())).toMatchObject({ id: 50, status: 'accepted' });
  });

  it('a 403 or 404 on the read drops the ride', async () => {
    mock.onGet('/rides/41').reply(404, { success: false, message: 'Not found' });
    const store = storeWithRide(makeRide({ status: 'accepted' }));
    await store.dispatch(refreshDriverRide(41));
    expect(selectDriverActiveRide(store.getState())).toBeNull();
  });

  it('a network failure keeps the ride', async () => {
    mock.onGet('/rides/41').networkError();
    const store = storeWithRide(makeRide({ status: 'accepted' }));
    await store.dispatch(refreshDriverRide(41));
    expect(selectDriverActiveRide(store.getState())?.status).toBe('accepted');
  });
});

describe('restoreDriverRide', () => {
  it.each(['accepted', 'arrived', 'started'] as const)('keeps a %s ride', async (status) => {
    mock.onGet('/rides/41').reply(200, envelope(makeRide({ status })));
    const store = makeStore();
    await store.dispatch(restoreDriverRide(41));
    expect(selectDriverActiveRide(store.getState())?.status).toBe(status);
  });

  it.each(['completed', 'cancelled', 'requested'] as const)('ignores a %s ride', async (status) => {
    mock.onGet('/rides/41').reply(200, envelope(makeRide({ status })));
    const store = makeStore();
    await store.dispatch(restoreDriverRide(41));
    expect(selectDriverActiveRide(store.getState())).toBeNull();
  });

  it('never replaces a ride accepted meanwhile', async () => {
    mock.onGet('/rides/41').reply(200, envelope(makeRide({ id: 41, status: 'started' })));
    const store = makeStore();
    const pending = store.dispatch(restoreDriverRide(41));
    store.dispatch({ type: acceptRideRequest.fulfilled.type, payload: makeRide({ id: 60, status: 'accepted' }) });
    await pending;
    expect(selectDriverActiveRide(store.getState())?.id).toBe(60);
  });
});

describe('cancelDriverRide', () => {
  it('posts the trimmed note and clears the ride', async () => {
    mock.onPost('/rides/41/cancel').reply(200, envelope(makeRide({ status: 'cancelled' })));
    const store = storeWithRide(makeRide({ status: 'arrived' }));
    await store.dispatch(cancelDriverRide({ rideId: 41, note: '  Passenger not at pickup  ' }));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ note: 'Passenger not at pickup' });
    expect(selectDriverActiveRide(store.getState())).toBeNull();
  });

  it('clears the ride when the server puts it back in the queue', async () => {
    mock.onPost('/rides/41/cancel').reply(200, envelope(makeRide({ status: 'requested' })));
    const store = storeWithRide(makeRide({ status: 'accepted' }));
    await store.dispatch(cancelDriverRide({ rideId: 41, note: 'Car broke down' }));
    expect(selectDriverActiveRide(store.getState())).toBeNull();
  });

  it('409 RIDE_CANNOT_BE_CANCELLED keeps the ride', async () => {
    mock.onPost('/rides/41/cancel').reply(409, refusal('RIDE_CANNOT_BE_CANCELLED'));
    const store = storeWithRide(makeRide({ status: 'started' }));
    const action = await store.dispatch(cancelDriverRide({ rideId: 41, note: 'Too late' }));
    expect(action.payload).toMatchObject({ code: 'RIDE_CANNOT_BE_CANCELLED' });
    expect(selectDriverActiveRide(store.getState())?.status).toBe('started');
  });
});
