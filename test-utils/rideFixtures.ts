/** Shared test fixtures (not a test file: everything under __tests__ is run by Jest). */
import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from '../src/store/rootReducer';
import type { RideRequest, RideResource } from '../src/services/rideService';

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
  passenger_id: 9,
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

export const makeStore = () => configureStore({ reducer: rootReducer });
export type TestStore = ReturnType<typeof makeStore>;
