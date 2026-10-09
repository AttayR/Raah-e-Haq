/**
 * T-401 (DRV-01, DRV-13): driver online/offline lives in one Redux slice backed by
 * GET/PUT /driver/status (BE-06). Before, Home and Map each kept a local `useState(false)`
 * that never reached the server, and the only API call targeted /tracking/update-status,
 * which never existed.
 */
import MockAdapter from 'axios-mock-adapter';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { resetApp } from '../../../src/store/actions';
import { bumpSessionEpoch } from '../../../src/store/sessionEpoch';
import { toDriverStatusInfo } from '../../../src/features/driver-status/api';
import {
  initialDriverStatusState,
  loadDriverStatus,
  selectDriverIsOnline,
  selectDriverIsOnRide,
  selectDriverStatusBusy,
  setDriverStatus,
} from '../../../src/features/driver-status/slice';

const statusBody = (status: string, extra: Record<string, unknown> = {}) => ({
  success: true,
  message: 'Driver status',
  data: {
    status,
    is_online: status !== 'offline',
    can_accept_rides: status === 'available',
    active_ride_id: null,
    changed_at: '2026-10-09T10:00:00+05:00',
    last_location_at: null,
    ...extra,
  },
});

const refusal = (code: string, message: string) => ({ success: false, message, error: { code } });

const makeStore = () =>
  configureStore({
    reducer: rootReducer,
    middleware: (getDefault) =>
      getDefault({
        serializableCheck: false,
        thunk: { extraArgument: { purgePersistedState: () => Promise.resolve() } },
      }),
  });

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
});

describe('toDriverStatusInfo', () => {
  it('fails closed: an unknown or missing status reads as offline', () => {
    expect(toDriverStatusInfo({ status: 'busy' }).status).toBe('offline');
    expect(toDriverStatusInfo(null).status).toBe('offline');
  });

  it('keeps the active ride id only while on a ride', () => {
    expect(toDriverStatusInfo({ status: 'on_ride', active_ride_id: 41 }).activeRideId).toBe(41);
    expect(toDriverStatusInfo({ status: 'available', active_ride_id: 41 }).activeRideId).toBeNull();
  });
});

describe('driverStatus slice', () => {
  it('starts unknown (not online) before the server answered', () => {
    const store = makeStore();
    expect(store.getState().driverStatus).toEqual(initialDriverStatusState);
    expect(selectDriverIsOnline(store.getState())).toBe(false);
  });

  it('loads the status from GET /driver/status', async () => {
    mock.onGet('/driver/status').reply(200, statusBody('available'));
    const store = makeStore();

    await store.dispatch(loadDriverStatus());

    expect(store.getState().driverStatus.status).toBe('available');
    expect(store.getState().driverStatus.loadStatus).toBe('done');
    expect(selectDriverIsOnline(store.getState())).toBe(true);
  });

  it('counts on_ride as online', async () => {
    mock.onGet('/driver/status').reply(200, statusBody('on_ride', { active_ride_id: 77 }));
    const store = makeStore();

    await store.dispatch(loadDriverStatus());

    expect(selectDriverIsOnline(store.getState())).toBe(true);
    expect(selectDriverIsOnRide(store.getState())).toBe(true);
    expect(store.getState().driverStatus.activeRideId).toBe(77);
  });

  it('PUTs {status: online} and changes only when the server answered (not optimistic)', async () => {
    let release: (() => void) | undefined;
    mock.onPut('/driver/status').reply(
      (config) =>
        new Promise((resolve) => {
          expect(JSON.parse(config.data)).toEqual({ status: 'online' });
          release = () => resolve([200, statusBody('available')]);
        }),
    );
    const store = makeStore();

    const pending = store.dispatch(setDriverStatus('online'));
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(store.getState().driverStatus.status).toBeNull();
    expect(selectDriverIsOnline(store.getState())).toBe(false);
    expect(selectDriverStatusBusy(store.getState())).toBe(true);

    release?.();
    await pending;

    expect(store.getState().driverStatus.status).toBe('available');
    expect(selectDriverStatusBusy(store.getState())).toBe(false);
    expect(mock.history.put).toHaveLength(1);
  });

  it('keeps the confirmed status and the server message on a 403', async () => {
    mock.onGet('/driver/status').reply(200, statusBody('offline'));
    mock
      .onPut('/driver/status')
      .reply(403, refusal('NO_APPROVED_VEHICLE', 'You need an approved vehicle before you can go online.'));
    const store = makeStore();
    await store.dispatch(loadDriverStatus());

    const action = await store.dispatch(setDriverStatus('online'));

    expect(setDriverStatus.rejected.match(action)).toBe(true);
    expect(action.payload).toMatchObject({ status: 403, code: 'NO_APPROVED_VEHICLE' });
    expect(store.getState().driverStatus.status).toBe('offline');
    expect(store.getState().driverStatus.error).toBe('You need an approved vehicle before you can go online.');
  });

  it('never overlaps a load and a toggle (one request at a time)', async () => {
    mock.onGet('/driver/status').reply(200, statusBody('offline'));
    mock.onPut('/driver/status').reply(200, statusBody('available'));
    const store = makeStore();

    const first = store.dispatch(loadDriverStatus());
    const second = store.dispatch(loadDriverStatus());
    const toggle = store.dispatch(setDriverStatus('online'));
    await Promise.all([first, second, toggle]);

    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.put).toHaveLength(0);
  });

  it('drops an answer that arrives after the session ended', async () => {
    mock.onGet('/driver/status').reply(() => {
      bumpSessionEpoch();
      return [200, statusBody('available')];
    });
    const store = makeStore();

    await store.dispatch(loadDriverStatus());

    expect(store.getState().driverStatus.status).toBeNull();
  });

  it('is cleared by logout (resetApp)', async () => {
    mock.onGet('/driver/status').reply(200, statusBody('available'));
    const store = makeStore();
    await store.dispatch(loadDriverStatus());

    store.dispatch(resetApp());

    expect(store.getState().driverStatus).toEqual(initialDriverStatusState);
  });
});
