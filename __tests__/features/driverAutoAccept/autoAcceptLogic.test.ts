/**
 * T-587: auto-accept settings mapping (GET/PUT /driver/auto-accept), the stepper maths driven by
 * the server's `limits`, the Drive row subtitle states (map-vehicles.md §7.1) and the rule that
 * tells an auto-accepted ride from the driver's own accept.
 */
import { configureStore } from '@reduxjs/toolkit';
import { toAutoAcceptSettings } from '../../../src/features/driver-auto-accept/api';
import { autoAcceptData, makeAutoAcceptSettings } from '../../../test-utils/autoAcceptFixtures';
import {
  autoAcceptSubtitle,
  canStep,
  formatPickupKm,
  isAutoAssignedRide,
  stepValue,
} from '../../../src/features/driver-auto-accept/format';
import { autoAcceptApi } from '../../../src/features/driver-auto-accept/api';
import { ApiError } from '../../../src/core/api/errors';
import {
  initialAutoAcceptState,
  loadAutoAccept,
  saveAutoAccept,
  selectAutoAcceptActive,
} from '../../../src/features/driver-auto-accept/slice';
import { acceptRideRequest } from '../../../src/features/driver-requests/slice';
import { driverRequestsApi } from '../../../src/features/driver-requests/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { makeRide } from '../../../test-utils/rideFixtures';

const settings = makeAutoAcceptSettings;

afterEach(() => jest.restoreAllMocks());

describe('toAutoAcceptSettings', () => {
  it('reads the server settings and limits (decimals as strings too)', () => {
    const mapped = toAutoAcceptSettings(autoAcceptData({ min_fare: '250.00', max_pickup_km: '1.5', women_passengers_only: true }));
    expect(mapped).toMatchObject({
      enabled: false,
      minFare: 250,
      maxPickupKm: 1.5,
      tiers: null,
      eligibleTiers: ['car', 'car_ac'],
      womenPassengersOnly: true,
      available: true,
      limits: { minFare: { min: 0, max: 5000, step: 10 }, maxPickupKm: { min: 0.5, max: 3, step: 0.5, default: 2 } },
    });
  });

  it('keeps the refusal only while not available', () => {
    expect(
      toAutoAcceptSettings(
        autoAcceptData({ available: false, unavailable_code: 'AUTO_ACCEPT_NOT_ENOUGH_RIDES', unavailable_message: 'Complete 5 rides to use auto-accept' }),
      ),
    ).toMatchObject({ available: false, unavailableCode: 'AUTO_ACCEPT_NOT_ENOUGH_RIDES', unavailableMessage: 'Complete 5 rides to use auto-accept' });
  });

  it('refuses a body without usable limits (never invents ranges)', () => {
    expect(toAutoAcceptSettings(autoAcceptData({ limits: undefined }))).toBeNull();
    expect(toAutoAcceptSettings(autoAcceptData({ limits: { min_fare: { min: 0, max: 10, step: 0 }, max_pickup_km: {} } }))).toBeNull();
    expect(toAutoAcceptSettings(null)).toBeNull();
  });
});

describe('steppers from the server limits', () => {
  const km = { min: 0.5, max: 3, step: 0.5 };
  const fare = { min: 0, max: 5000, step: 10 };

  it('steps on the grid and stops at the limits', () => {
    expect(stepValue(2, km, 1)).toBe(2.5);
    expect(stepValue(0.5, km, -1)).toBe(0.5);
    expect(stepValue(3, km, 1)).toBe(3);
    expect(stepValue(0, fare, 1)).toBe(10);
    // A saved value off the grid snaps onto it.
    expect(stepValue(253, fare, 1)).toBe(260);
    expect(canStep(3, km, 1)).toBe(false);
    expect(canStep(0.5, km, -1)).toBe(false);
    expect(canStep(2, km, 1)).toBe(true);
  });

  it('shows one decimal only for a fractional step', () => {
    expect(formatPickupKm(2, 0.5)).toBe('2.0');
    expect(formatPickupKm(1.5, 0.5)).toBe('1.5');
    expect(formatPickupKm(2, 1)).toBe('2');
  });
});

describe('Drive row subtitle (§7.1)', () => {
  it('covers never set, off with settings, on online, on offline and a server refusal', () => {
    expect(autoAcceptSubtitle(settings(), false)).toBe('Accept matching rides for you');
    expect(autoAcceptSubtitle(settings({ min_fare: 300, max_pickup_km: 1.5 }), true)).toBe('Off · Rs 300+ · 1.5 km');
    expect(autoAcceptSubtitle(settings({ enabled: true, min_fare: 300 }), true)).toBe('Rs 300+ · up to 2.0 km · Car, Car AC');
    expect(autoAcceptSubtitle(settings({ enabled: true, min_fare: 300 }), false)).toBe('On · starts when you go online');
    expect(
      autoAcceptSubtitle(settings({ available: false, unavailable_code: 'X', unavailable_message: 'Server says no' }), true),
    ).toBe('Server says no');
    // Paused by a location check while still allowed (BE-120 jump pause).
    expect(autoAcceptSubtitle(settings({ enabled: true, min_fare: 300, paused: true }), true)).toBe(
      'Paused for now while your location is checked',
    );
  });

  it('a paused auto-accept is not active (no badge, circle, hint or takeover)', () => {
    const root = (overrides: Record<string, unknown>) => ({
      driverAutoAccept: { ...initialAutoAcceptState, settings: settings(overrides) },
    });
    expect(selectAutoAcceptActive(root({ enabled: true, min_fare: 300 }))).toBe(true);
    expect(selectAutoAcceptActive(root({ enabled: true, min_fare: 300, paused: true }))).toBe(false);
  });
});

describe('isAutoAssignedRide', () => {
  const watch = { wasOnlineIdle: true, autoAcceptOn: true, ownAcceptedRideId: null };

  it('is a ride that came while online and idle with auto-accept on', () => {
    expect(isAutoAssignedRide({ id: 5, status: 'accepted' }, watch)).toBe(true);
  });

  it('is never the driver own accept, a restored ride at launch, an older stage, or with auto-accept off', () => {
    expect(isAutoAssignedRide({ id: 5, status: 'accepted' }, { ...watch, ownAcceptedRideId: 5 })).toBe(false);
    expect(isAutoAssignedRide({ id: 5, status: 'accepted' }, { ...watch, wasOnlineIdle: false })).toBe(false);
    expect(isAutoAssignedRide({ id: 5, status: 'started' }, watch)).toBe(false);
    expect(isAutoAssignedRide({ id: 5, status: 'accepted' }, { ...watch, autoAcceptOn: false })).toBe(false);
  });
});

describe('auto-accept slice', () => {
  const makeStore = () => configureStore({ reducer: rootReducer });

  it('shows the switch at once and flips it back when the PUT is refused (409)', async () => {
    const store = makeStore();
    jest.spyOn(autoAcceptApi, 'get').mockResolvedValue(settings({ min_fare: 200 }));
    await store.dispatch(loadAutoAccept());
    let resolve: (error: unknown) => void = () => undefined;
    jest.spyOn(autoAcceptApi, 'update').mockImplementation(
      () => new Promise((_, reject) => {
        resolve = reject;
      }),
    );
    const pending = store.dispatch(saveAutoAccept({ enabled: true }));
    expect(store.getState().driverAutoAccept.settings?.enabled).toBe(true);
    expect(store.getState().driverAutoAccept.saving).toBe(true);
    resolve(new ApiError({ message: 'Auto-accept is not available', kind: 'conflict', status: 409, code: 'AUTO_ACCEPT_TOO_MANY_STRIKES' }));
    const action = await pending;
    expect(saveAutoAccept.rejected.match(action) && action.payload?.code).toBe('AUTO_ACCEPT_TOO_MANY_STRIKES');
    expect(store.getState().driverAutoAccept.settings?.enabled).toBe(false);
    expect(store.getState().driverAutoAccept.saving).toBe(false);
  });

  it('keeps settings already shown when a later read fails, and fails only a first read', async () => {
    const store = makeStore();
    const get = jest.spyOn(autoAcceptApi, 'get');
    get.mockRejectedValueOnce(new ApiError({ message: 'x', kind: 'server', status: 500 }));
    await store.dispatch(loadAutoAccept());
    expect(store.getState().driverAutoAccept.loadStatus).toBe('failed');

    get.mockResolvedValueOnce(settings({ min_fare: 100 }));
    await store.dispatch(loadAutoAccept());
    get.mockRejectedValueOnce(new ApiError({ message: 'x', kind: 'network' }));
    await store.dispatch(loadAutoAccept());
    expect(store.getState().driverAutoAccept.loadStatus).toBe('done');
    expect(store.getState().driverAutoAccept.settings?.minFare).toBe(100);
  });

  it('remembers the ride the driver accepted with their own tap', async () => {
    const store = makeStore();
    jest.spyOn(driverRequestsApi, 'accept').mockResolvedValue(makeRide({ id: 77, status: 'accepted' }));
    await store.dispatch(acceptRideRequest(77));
    expect(store.getState().driverAutoAccept.ownAcceptedRideId).toBe(77);
  });
});
