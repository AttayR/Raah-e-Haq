/**
 * T-301 / PAX-10: the active ride is one Redux slice, restored from the server on launch.
 * Before T-301 the ride lived in each PassengerMapScreen instance (useRide local state), so
 * a restart or a second mount lost it, and nothing asked the server for an active ride.
 */
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import { bumpSessionEpoch } from '../../../src/store/sessionEpoch';
import { resetApp } from '../../../src/store/actions';
import {
  cancelActiveRide,
  clearActiveRide,
  createActiveRide,
  refreshActiveRide,
  restoreActiveRide,
  selectInProgressRide,
} from '../../../src/features/active-ride/slice';
import { ACTIVE_RIDE_STATUS_QUERY } from '../../../src/features/active-ride/api';
import { isRideInProgress, isRideTerminal } from '../../../src/features/active-ride/status';
import { envelope, makeRide, makeRideRequest, makeStore, page } from '../../../test-utils/rideFixtures';

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
});

const request = makeRideRequest();

describe('status helpers (API statuses)', () => {
  it('requested, accepted and ongoing are in progress; completed and cancelled are final', () => {
    expect((['requested', 'accepted', 'arrived', 'started', 'ongoing'] as const).every((status) =>
      isRideInProgress(makeRide({ status })))).toBe(true);
    expect(isRideInProgress(makeRide({ status: 'completed' }))).toBe(false);
    expect(isRideTerminal(makeRide({ status: 'cancelled' }))).toBe(true);
    expect(isRideTerminal(null)).toBe(false);
  });
});

describe('restoreActiveRide (launch restore)', () => {
  it('asks GET /rides with the BE-01 status list and keeps the in-progress ride', async () => {
    mock.onGet('/rides').reply(200, page([makeRide({ id: 7, status: 'accepted' })]));
    const store = makeStore();

    await store.dispatch(restoreActiveRide());

    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].params).toEqual({ status: ACTIVE_RIDE_STATUS_QUERY });
    expect(ACTIVE_RIDE_STATUS_QUERY).toBe('requested,accepted,arrived,started,ongoing');
    expect(store.getState().activeRide.ride).toMatchObject({ id: 7, status: 'accepted' });
    expect(store.getState().activeRide.restoreStatus).toBe('done');
  });

  it('keeps only a ride of the signed-in passenger (T-301 follow-up)', async () => {
    mock.onGet('/rides').reply(
      200,
      page([
        makeRide({ id: 12, passenger_id: 77, status: 'accepted' }),
        makeRide({ id: 11, status: 'requested' }),
      ]),
    );
    const store = makeStore();

    await store.dispatch(restoreActiveRide());

    expect(store.getState().activeRide.ride?.id).toBe(11);
  });

  it('restores nothing when only other users\' rides come back', async () => {
    mock.onGet('/rides').reply(200, page([makeRide({ passenger_id: 77, status: 'ongoing' })]));
    const store = makeStore();

    await store.dispatch(restoreActiveRide());

    expect(store.getState().activeRide.ride).toBeNull();
    expect(store.getState().activeRide.restoreStatus).toBe('done');
  });

  it('does not ask the server when nobody is signed in', async () => {
    const store = makeStore({ userId: null });

    await store.dispatch(restoreActiveRide());

    expect(mock.history.get).toHaveLength(0);
    expect(store.getState().activeRide.ride).toBeNull();
  });

  it('a 422 for the status list fails the restore; there is no unfiltered fallback (BE-01 is live)', async () => {
    mock.onGet('/rides').reply(422, { success: false, message: 'Validation failed', errors: { status: ['invalid'] } });
    const store = makeStore();

    await store.dispatch(restoreActiveRide());

    expect(mock.history.get).toHaveLength(1);
    expect(store.getState().activeRide.ride).toBeNull();
    expect(store.getState().activeRide.restoreStatus).toBe('failed');
  });

  it('ignores finished rides even if the server returns them for the filter', async () => {
    mock.onGet('/rides').reply(200, page([makeRide({ status: 'completed' }), makeRide({ status: 'cancelled' })]));
    const store = makeStore();

    await store.dispatch(restoreActiveRide());

    expect(store.getState().activeRide.ride).toBeNull();
    expect(store.getState().activeRide.restoreStatus).toBe('done');
  });

  it('a failed check (offline) keeps no ride and marks the restore failed', async () => {
    mock.onGet('/rides').networkError();
    const store = makeStore();

    await store.dispatch(restoreActiveRide());

    expect(store.getState().activeRide.ride).toBeNull();
    expect(store.getState().activeRide.restoreStatus).toBe('failed');
  });

  it('drops the answer when the user signed out while it ran', async () => {
    mock.onGet('/rides').reply(() => {
      bumpSessionEpoch();
      return [200, page([makeRide({ status: 'requested' })])];
    });
    const store = makeStore();

    await store.dispatch(restoreActiveRide());

    expect(store.getState().activeRide.ride).toBeNull();
  });

  it('runs once at a time', async () => {
    mock.onGet('/rides').reply(200, page([]));
    const store = makeStore();

    await Promise.all([store.dispatch(restoreActiveRide()), store.dispatch(restoreActiveRide())]);

    expect(mock.history.get).toHaveLength(1);
  });

  it('never replaces a ride booked while the restore was running', async () => {
    const store = makeStore();
    mock.onGet('/rides').reply(() => {
      store.dispatch(createActiveRide.fulfilled(makeRide({ id: 99 }), 'req', request));
      return [200, page([makeRide({ id: 5, status: 'accepted' })])];
    });

    await store.dispatch(restoreActiveRide());

    expect(store.getState().activeRide.ride?.id).toBe(99);
  });
});

describe('create, poll and cancel share one ride', () => {
  it('POST /rides makes the created ride the active ride', async () => {
    mock.onPost('/rides').reply(201, envelope(makeRide({ id: 21 })));
    const store = makeStore();

    await store.dispatch(createActiveRide(request));

    expect(store.getState().activeRide.ride?.id).toBe(21);
    expect(store.getState().activeRide.isSubmitting).toBe(false);
  });

  it('a failed create keeps no ride and stores a display-safe message', async () => {
    mock.onPost('/rides').reply(422, { success: false, message: 'The vehicle type is invalid.', errors: { vehicle_type: ['x'] } });
    const store = makeStore();

    await store.dispatch(createActiveRide(request));

    expect(store.getState().activeRide.ride).toBeNull();
    expect(store.getState().activeRide.error).toBe('The vehicle type is invalid.');
  });

  it('the poll updates the status of the active ride', async () => {
    const store = makeStore();
    store.dispatch(createActiveRide.fulfilled(makeRide({ id: 21 }), 'req', request));
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21, status: 'accepted' })));

    await store.dispatch(refreshActiveRide(21));

    expect(store.getState().activeRide.ride?.status).toBe('accepted');
  });

  it('a poll answer for another ride is ignored', async () => {
    const store = makeStore();
    store.dispatch(createActiveRide.fulfilled(makeRide({ id: 21 }), 'req', request));
    mock.onGet('/rides/20').reply(200, envelope(makeRide({ id: 20, status: 'ongoing' })));

    await store.dispatch(refreshActiveRide(20));

    expect(store.getState().activeRide.ride).toMatchObject({ id: 21, status: 'requested' });
  });

  it('a ride the server no longer shows us (404/403) stops being active; a network error does not', async () => {
    const store = makeStore();
    store.dispatch(createActiveRide.fulfilled(makeRide({ id: 21 }), 'req', request));

    mock.onGet('/rides/21').networkErrorOnce();
    await store.dispatch(refreshActiveRide(21));
    expect(store.getState().activeRide.ride?.id).toBe(21);

    mock.onGet('/rides/21').reply(404, { success: false, message: 'Not found' });
    await store.dispatch(refreshActiveRide(21));
    expect(store.getState().activeRide.ride).toBeNull();
  });

  it('a completed ride is no longer in progress; clearActiveRide starts over', async () => {
    const store = makeStore();
    store.dispatch(createActiveRide.fulfilled(makeRide({ id: 21 }), 'req', request));
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21, status: 'completed' })));

    await store.dispatch(refreshActiveRide(21));
    expect(selectInProgressRide(store.getState())).toBeNull();
    expect(store.getState().activeRide.ride?.status).toBe('completed');

    store.dispatch(clearActiveRide());
    expect(store.getState().activeRide.ride).toBeNull();
  });

  it('cancel clears the active ride', async () => {
    const store = makeStore();
    store.dispatch(createActiveRide.fulfilled(makeRide({ id: 21 }), 'req', request));
    mock.onPost('/rides/21/cancel').reply(200, envelope(makeRide({ id: 21, status: 'cancelled' })));

    await store.dispatch(cancelActiveRide(21));

    expect(store.getState().activeRide.ride).toBeNull();
  });

  it('logout (resetApp) empties the slice', () => {
    const store = makeStore();
    store.dispatch(createActiveRide.fulfilled(makeRide({ id: 21 }), 'req', request));

    store.dispatch(resetApp());

    expect(store.getState().activeRide).toEqual(makeStore().getState().activeRide);
  });
});
