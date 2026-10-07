/**
 * rideService against the documented Laravel envelope { success, message?, data } (DRV-02).
 * Before T-007 every method read `.data.data` off the body and returned undefined.
 */
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../src/services/api';
import rideService, { RideResource } from '../../src/services/rideService';
import { ApiError } from '../../src/core/api/errors';

const ride = {
  id: 42,
  ride_id: 'RIDE-42',
  passenger_id: 3,
  driver_id: 9,
  pickup_address: 'Pickup',
  dropoff_address: 'Dropoff',
  pickup_latitude: 31.52,
  pickup_longitude: 74.35,
  dropoff_latitude: 31.48,
  dropoff_longitude: 74.3,
  status: 'accepted',
  vehicle_type: 'car',
  passenger_count: 1,
  total_fare: 350,
  stops: [],
} as unknown as RideResource;

const envelope = (data: unknown, extra: Record<string, unknown> = {}) => ({ success: true, message: 'OK', data, ...extra });

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
});

describe('rideService returns the ride object from the envelope', () => {
  it('getRide', async () => {
    mock.onGet('/rides/42').reply(200, envelope(ride));
    await expect(rideService.getRide(42)).resolves.toEqual(ride);
  });

  it('acceptRide (PUT /rides/{id})', async () => {
    mock.onPut('/rides/42').reply(200, envelope(ride));
    const result = await rideService.acceptRide(42, 9);
    expect(result).toEqual(ride);
    expect(result.passenger_id).toBe(3);
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ status: 'accepted', driver_id: 9 });
  });

  it('startRide and completeRide', async () => {
    mock.onPut('/rides/42').reply(200, envelope({ ...ride, status: 'ongoing' }));
    await expect(rideService.startRide(42)).resolves.toMatchObject({ id: 42, status: 'ongoing' });

    mock.onPut('/rides/42').reply(200, envelope({ ...ride, status: 'completed' }));
    await expect(rideService.completeRide(42, 350, 4.2, 12)).resolves.toMatchObject({ status: 'completed' });
  });

  it('cancelRide and assignDriver', async () => {
    mock.onPost('/rides/42/cancel').reply(200, envelope({ ...ride, status: 'cancelled' }));
    await expect(rideService.cancelRide(42)).resolves.toMatchObject({ status: 'cancelled' });

    mock.onPost('/rides/42/assign-driver').reply(200, envelope(ride));
    await expect(rideService.assignDriver(42, 9)).resolves.toEqual(ride);
  });

  it('createRide (201)', async () => {
    mock.onPost('/rides').reply(201, envelope({ ...ride, status: 'requested' }));
    const created = await rideService.createRide({
      passenger_id: 3,
      pickup_address: 'Pickup',
      dropoff_address: 'Dropoff',
      pickup_latitude: 31.52,
      pickup_longitude: 74.35,
      dropoff_latitude: 31.48,
      dropoff_longitude: 74.3,
      vehicle_type: 'car',
      passenger_count: 1,
      special_instructions: '',
      stops: [],
    });
    expect(created.id).toBe(42);
  });

  it('getRides maps data + pagination (GET /rides)', async () => {
    mock.onGet('/rides').reply(200, {
      success: true,
      data: [ride],
      pagination: { current_page: 1, last_page: 3, per_page: 20, total: 41 },
    });
    await expect(rideService.getRides()).resolves.toEqual({
      data: [ride],
      current_page: 1,
      last_page: 3,
      per_page: 20,
      total: 41,
    });
    await expect(rideService.getPassengerRides(3)).resolves.toEqual([ride]);
  });

  it('addStop returns the stops update, not a ride', async () => {
    const update = { id: 42, stops: [], updated_fare: 400, updated_distance: '5 km', updated_duration: '14 minutes' };
    mock.onPost('/rides/42/stops').reply(200, envelope(update));
    await expect(
      rideService.addStop(42, { address: 'Stop', latitude: 31.5, longitude: 74.32, stop_order: 1 }),
    ).resolves.toEqual(update);
  });
});

describe('rideService errors are ApiError', () => {
  it('422 with the nested { error: { code, message, details } } envelope', async () => {
    mock.onPost('/rides').reply(422, {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: { pickup_address: ['Required'] } },
    });
    const error = await rideService
      .createRide({
        passenger_id: 3,
        pickup_address: '',
        dropoff_address: 'Dropoff',
        pickup_latitude: 31.52,
        pickup_longitude: 74.35,
        dropoff_latitude: 31.48,
        dropoff_longitude: 74.3,
        vehicle_type: 'car',
        passenger_count: 1,
        special_instructions: '',
        stops: [],
      })
      .catch(e => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      kind: 'validation',
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      fieldErrors: { pickup_address: ['Required'] },
    });
  });

  it('403 from the driver location route (no active ride, BE-20)', async () => {
    mock.onGet('/tracking/driver/9/latest').reply(403, {
      success: false,
      message: 'Forbidden. You do not have permission to access this resource.',
    });
    await expect(rideService.getDriverLocation(9)).rejects.toMatchObject({ kind: 'forbidden', status: 403 });
  });

  it('network failure', async () => {
    mock.onGet('/rides/42').networkError();
    await expect(rideService.getRide(42)).rejects.toMatchObject({ kind: 'network' });
  });

  it('a 2xx body with success:false is not treated as a ride', async () => {
    mock.onGet('/rides/42').reply(200, { success: false, message: 'Ride not available' });
    await expect(rideService.getRide(42)).rejects.toMatchObject({ kind: 'unknown' });
  });
});
