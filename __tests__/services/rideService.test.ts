/**
 * rideService against the documented Laravel envelope { success, message?, data } (DRV-02).
 * Before T-007 every method read `.data.data` off the body and returned undefined.
 */
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../src/services/api';
import rideService, { getDriverPhone, RideResource } from '../../src/services/rideService';
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

  it('acceptRide uses POST /rides/{id}/assign-driver with no body (T-404)', async () => {
    mock.onPost('/rides/42/assign-driver').reply(200, envelope(ride));
    const result = await rideService.acceptRide(42);
    expect(result).toEqual(ride);
    expect(result.passenger_id).toBe(3);
    expect(mock.history.put).toHaveLength(0);
    expect(mock.history.post[0].data).toBeUndefined();
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
    await expect(rideService.assignDriver(42)).resolves.toEqual(ride);
    expect(mock.history.post[1].data).toBeUndefined();
  });

  it('createRide (201)', async () => {
    mock.onPost('/rides').reply(201, envelope({ ...ride, status: 'requested' }));
    const created = await rideService.createRide({
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

describe('nearby drivers and driver location on the BE-20 contract (T-110)', () => {
  const nearby = {
    id: 'a1b2c3d4e5f60718',
    rating: 4.5,
    vehicle_type: 'car',
    distance_km: 1.2,
    estimated_arrival_min: 3,
    location: { latitude: 31.52, longitude: 74.355 },
  };

  it('calls GET /rides/nearby-drivers (never /tracking/drivers-in-radius) with radius and vehicle_type', async () => {
    mock.onGet('/rides/nearby-drivers').reply(200, envelope([nearby]));
    const drivers = await rideService.getNearbyDrivers({ latitude: 31.5, longitude: 74.3, radiusKm: 3, vehicleType: 'bike' });
    expect(drivers).toEqual([nearby]);
    expect(typeof drivers[0].id).toBe('string');
    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].url).toBe('/rides/nearby-drivers');
    expect(mock.history.get[0].params).toEqual({ latitude: 31.5, longitude: 74.3, radius: 3, vehicle_type: 'bike' });
  });

  it('clamps the radius to 1..10 km and defaults to 5', async () => {
    mock.onGet('/rides/nearby-drivers').reply(200, envelope([]));
    await rideService.getNearbyDrivers({ latitude: 1, longitude: 2, radiusKm: 50 });
    await rideService.getNearbyDrivers({ latitude: 1, longitude: 2, radiusKm: 0.2 });
    await rideService.getNearbyDrivers({ latitude: 1, longitude: 2 });
    expect(mock.history.get.map(r => r.params.radius)).toEqual([10, 1, 5]);
    expect(mock.history.get[2].params).not.toHaveProperty('vehicle_type');
  });

  it('keeps only the documented fields and drops entries without an opaque id or position', async () => {
    mock.onGet('/rides/nearby-drivers').reply(
      200,
      envelope([
        { ...nearby, name: 'Leaked Name', phone: '+923001234567', driver_id: 9 },
        { ...nearby, id: 9 },
        { ...nearby, id: 'x', location: { latitude: null, longitude: 74 } },
      ]),
    );
    const drivers = await rideService.getNearbyDrivers({ latitude: 31.5, longitude: 74.3 });
    expect(drivers).toEqual([nearby]);
    expect(drivers[0]).not.toHaveProperty('name');
    expect(drivers[0]).not.toHaveProperty('phone');
  });

  it('a null or unknown vehicle_type stays null; it is never guessed as car (BE-58)', async () => {
    mock.onGet('/rides/nearby-drivers').reply(
      200,
      envelope([
        { ...nearby, id: 'n1', vehicle_type: null },
        { ...nearby, id: 'n2', vehicle_type: 'motorcycle' },
        { ...nearby, id: 'n3', vehicle_type: 'bike' },
      ]),
    );
    const drivers = await rideService.getNearbyDrivers({ latitude: 31.5, longitude: 74.3 });
    expect(drivers.map(d => d.vehicle_type)).toEqual([null, null, 'bike']);
  });

  it('createRide sends the body as built: no passenger_id', async () => {
    mock.onPost('/rides').reply(201, envelope({ ...ride, status: 'requested' }));
    await rideService.createRide({
      pickup_address: 'Pickup',
      dropoff_address: 'Dropoff',
      pickup_latitude: 31.52,
      pickup_longitude: 74.35,
      dropoff_latitude: 31.48,
      dropoff_longitude: 74.3,
      vehicle_type: 'rickshaw',
    });
    const body = JSON.parse(mock.history.post[0].data);
    expect(body).not.toHaveProperty('passenger_id');
    expect(body.vehicle_type).toBe('rickshaw');
  });

  it('429 rejects as rate_limited with retry_after', async () => {
    mock.onGet('/rides/nearby-drivers').reply(429, {
      success: false,
      message: 'Too many requests. Please try again shortly.',
      retry_after: 42,
    });
    await expect(rideService.getNearbyDrivers({ latitude: 31.5, longitude: 74.3 })).rejects.toMatchObject({
      kind: 'rate_limited',
      status: 429,
      retryAfter: 42,
    });
  });

  it('latest location: decimal strings become numbers', async () => {
    mock.onGet('/tracking/driver/9/latest').reply(
      200,
      envelope({
        driver_id: 9,
        latitude: '31.52000000',
        longitude: '74.35000000',
        heading: '90.00',
        status: 'busy',
        last_seen_at: '2026-10-08T10:00:00Z',
      }),
    );
    await expect(rideService.getDriverLocation(9)).resolves.toEqual({
      driver_id: 9,
      latitude: 31.52,
      longitude: 74.35,
      heading: 90,
      status: 'busy',
      last_seen_at: '2026-10-08T10:00:00Z',
    });
  });

  it('getDriverLocationForRide does not call the server unless the ride is active with a driver', async () => {
    for (const status of ['requested', 'completed', 'cancelled'] as const) {
      await expect(rideService.getDriverLocationForRide({ ...ride, status })).resolves.toEqual({ available: false });
    }
    await expect(rideService.getDriverLocationForRide({ ...ride, driver_id: undefined })).resolves.toEqual({ available: false });
    await expect(rideService.getDriverLocationForRide(null)).resolves.toEqual({ available: false });
    expect(mock.history.get).toHaveLength(0);
  });

  it('getDriverLocationForRide treats 403 as "not available" (no throw)', async () => {
    mock.onGet('/tracking/driver/9/latest').reply(403, {
      success: false,
      message: 'Forbidden. You do not have permission to access this resource.',
    });
    await expect(rideService.getDriverLocationForRide(ride)).resolves.toEqual({ available: false });
  });

  it('getDriverLocationForRide returns the position during an active ride, and null data as not available', async () => {
    mock.onGet('/tracking/driver/9/latest').replyOnce(
      200,
      envelope({ driver_id: 9, latitude: 31.5, longitude: 74.3, heading: null, status: 'busy', last_seen_at: 't' }),
    );
    await expect(rideService.getDriverLocationForRide({ ...ride, status: 'started' })).resolves.toMatchObject({
      available: true,
      location: { latitude: 31.5, longitude: 74.3 },
    });
    mock.onGet('/tracking/driver/9/latest').replyOnce(200, envelope(null));
    await expect(rideService.getDriverLocationForRide(ride)).resolves.toEqual({ available: false });
  });

  it('getDriverLocationForRide still throws other failures', async () => {
    mock.onGet('/tracking/driver/9/latest').networkError();
    await expect(rideService.getDriverLocationForRide(ride)).rejects.toMatchObject({ kind: 'network' });
  });

  it('getDriverPhone: ride.driver.phone only while the ride is active', () => {
    const withPhone = { ...ride, driver: { id: 9, name: 'D', phone: '+923001234567' } };
    expect(getDriverPhone(withPhone)).toBe('+923001234567');
    expect(getDriverPhone({ ...withPhone, status: 'arrived' })).toBe('+923001234567');
    expect(getDriverPhone({ ...withPhone, status: 'completed' })).toBeNull();
    expect(getDriverPhone({ ...withPhone, status: 'requested' })).toBeNull();
    expect(getDriverPhone({ ...ride, driver: { id: 9, name: 'D' } })).toBeNull();
    expect(getDriverPhone({ ...ride, driver: { id: 9, name: 'D', phone: ' ' } })).toBeNull();
    expect(getDriverPhone(null)).toBeNull();
  });

  it('getDriverPhone strips spaces and dashes and rejects anything that is not a plain number', () => {
    const withPhone = (phone: string) => ({ ...ride, driver: { id: 9, name: 'D', phone } });
    expect(getDriverPhone(withPhone('+92 300-123 4567'))).toBe('+923001234567');
    expect(getDriverPhone(withPhone('03001234567'))).toBe('03001234567');
    for (const bad of ['+923001234567;ext=1', '+923001234567,1', '*123#', '+92300#1234567', '12345', '+1234567890123456', '+92 300 abc 4567']) {
      expect(getDriverPhone(withPhone(bad))).toBeNull();
    }
  });
});
