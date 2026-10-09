/** Driver request fixtures (T-403/T-404). Not a test file: everything under __tests__ is run by Jest. */
import type { PendingRideRequest } from '../src/features/driver-requests/api';

/** One GET /rides/pending `data[]` entry as the server sends it (fake local data only). */
export const pendingRide = (overrides: Record<string, unknown> = {}) => ({
  id: 7,
  ride_id: 'RIDE-7',
  passenger_id: 3,
  driver_id: null,
  pickup_address: 'Fake Pickup Street',
  dropoff_address: 'Fake Dropoff Road',
  pickup_latitude: '31.51000000',
  pickup_longitude: '74.34000000',
  dropoff_latitude: '31.47000000',
  dropoff_longitude: '74.36000000',
  status: 'requested',
  vehicle_type: 'car',
  total_fare: '350.00',
  payment_method: 'cash',
  passenger: { id: 3, name: 'Ayesha', first_name: 'Ayesha', profile_image_url: null, rating: 4.8 },
  requested_at: '2026-10-09T10:00:00.000000Z',
  created_at: '2026-10-09T10:00:00.000000Z',
  estimated_distance: 1.24,
  estimated_pickup_min: 3,
  estimated_fare: '350.00',
  ...overrides,
});

/** A mapped request, as the slice holds it. */
export const makePendingRequest = (overrides: Partial<PendingRideRequest> = {}): PendingRideRequest => ({
  id: 7,
  pickupAddress: 'Fake Pickup Street',
  dropoffAddress: 'Fake Dropoff Road',
  pickup: { latitude: 31.51, longitude: 74.34 },
  dropoff: { latitude: 31.47, longitude: 74.36 },
  passengerFirstName: 'Ayesha',
  passengerRating: 4.8,
  estimatedDistanceKm: 1.24,
  estimatedPickupMin: 3,
  estimatedFare: 350,
  paymentMethod: 'cash',
  vehicleType: 'car',
  expiresAt: null,
  ...overrides,
});
