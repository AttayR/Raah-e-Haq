/** Shared test fixtures (not a test file: everything under __tests__ is run by Jest). */
import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from '../src/store/rootReducer';
import type { RideRequest, RideResource } from '../src/services/rideService';
import type { User } from '../src/services/api';

/** A RideResource as GET /rides/{id} returns it (fake local data only). */
export const makeRide = (overrides: Partial<RideResource> = {}): RideResource => ({
  id: 41,
  ride_id: 'RIDE-41',
  passenger_id: 9,
  pickup_address: 'Fake Pickup Street',
  dropoff_address: 'Fake Dropoff Road',
  pickup_latitude: 31.52,
  pickup_longitude: 74.35,
  dropoff_latitude: 31.48,
  dropoff_longitude: 74.3,
  status: 'requested',
  vehicle_type: 'car',
  passenger_count: 1,
  base_fare: 50,
  distance_fare: 120,
  time_fare: 20,
  total_fare: 190,
  driver_earnings: 152,
  platform_commission: 38,
  payment_method: 'cash',
  payment_status: 'pending',
  stops: [],
  current_stop_index: 0,
  active_stops_count: 0,
  completed_stops_count: 0,
  created_at: '2026-10-09T10:00:00Z',
  updated_at: '2026-10-09T10:00:00Z',
  requested_at: '2026-10-09T10:00:00Z',
  ...overrides,
});

/** A POST /rides body (fake local data only). */
export const makeRideRequest = (overrides: Partial<RideRequest> = {}): RideRequest => ({
  pickup_address: 'Fake Pickup Street',
  dropoff_address: 'Fake Dropoff Road',
  pickup_latitude: 31.52,
  pickup_longitude: 74.35,
  dropoff_latitude: 31.48,
  dropoff_longitude: 74.3,
  vehicle_type: 'car',
  passenger_count: 1,
  special_instructions: '',
  stops: [],
  ...overrides,
});

export const envelope = (data: unknown, extra: Record<string, unknown> = {}) => ({
  success: true,
  message: 'OK',
  data,
  ...extra,
});

export const page = (rides: RideResource[]) =>
  envelope(rides, { pagination: { current_page: 1, last_page: 1, per_page: 20, total: rides.length } });

/** The passenger id of makeRide() and of the user makeStore() signs in by default. */
export const FIXTURE_PASSENGER_ID = 9;

/** A signed-in passenger (fake local data only). */
export const makePassenger = (id: number = FIXTURE_PASSENGER_ID): User => ({
  id,
  name: 'Fake Passenger',
  email: 'passenger@example.test',
  phone: null,
  status: 'active',
  role: 'passenger',
  roles: ['passenger'],
});

/**
 * A store with the real root reducer. By default a passenger (id 9, the makeRide passenger)
 * is signed in; `{ userId: null }` gives a signed-out store.
 */
export const makeStore = ({ userId = FIXTURE_PASSENGER_ID }: { userId?: number | null } = {}) => {
  const initial = rootReducer(undefined, { type: '@@fixtures/init' });
  return configureStore({
    reducer: rootReducer,
    preloadedState: {
      ...initial,
      apiAuth: {
        ...initial.apiAuth,
        user: userId === null ? null : makePassenger(userId),
      },
    },
  });
};
export type TestStore = ReturnType<typeof makeStore>;
