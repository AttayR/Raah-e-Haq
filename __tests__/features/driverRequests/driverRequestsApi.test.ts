/**
 * T-403/T-404: GET /rides/pending and POST /rides/{id}/assign-driver, and the request mapping.
 */
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import {
  driverRequestsApi,
  toPendingRideRequest,
  toPendingRidesPage,
} from '../../../src/features/driver-requests/api';
import { pendingRide } from '../../../test-utils/driverRequestFixtures';

describe('toPendingRideRequest', () => {
  it('maps the server fields (decimal strings, first name, rating) and the expiry', () => {
    const request = toPendingRideRequest(pendingRide(), 10);
    expect(request).toEqual({
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
      expiresAt: Date.parse('2026-10-09T10:00:00.000Z') + 10 * 60_000,
    });
  });

  it('leaves unknown numbers null instead of inventing them', () => {
    const request = toPendingRideRequest(
      pendingRide({ estimated_fare: null, estimated_distance: undefined, passenger: { id: 3, name: null, rating: null } }),
      null,
    );
    expect(request).toMatchObject({
      estimatedFare: null,
      estimatedDistanceKm: null,
      passengerFirstName: null,
      passengerRating: null,
      expiresAt: null,
    });
  });

  it('drops entries without an id or an address', () => {
    expect(toPendingRideRequest(pendingRide({ id: 'x' }), 10)).toBeNull();
    expect(toPendingRideRequest(pendingRide({ pickup_address: '' }), 10)).toBeNull();
    expect(toPendingRideRequest(null, 10)).toBeNull();
    expect(toPendingRidesPage({ success: true, data: [pendingRide(), { id: 0 }] }).requests).toHaveLength(1);
  });
});

describe('driverRequestsApi', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => mock.restore());

  it('listPending calls GET /rides/pending with the location fallback and no driver_id', async () => {
    mock.onGet('/rides/pending').reply(200, {
      success: true,
      data: [pendingRide()],
      meta: { radius_km: 5, vehicle_types: ['car'], location_source: 'request', max_age_minutes: 10 },
    });
    const page = await driverRequestsApi.listPending({ latitude: 31.5, longitude: 74.3 });

    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].url).toBe('/rides/pending');
    expect(mock.history.get[0].params).toEqual({ latitude: 31.5, longitude: 74.3 });
    expect(page.requests[0]).toMatchObject({ id: 7, estimatedFare: 350 });
    expect(page.requests[0].expiresAt).toBe(Date.parse('2026-10-09T10:00:00Z') + 600_000);
  });

  it('listPending sends no params when the location is unknown', async () => {
    mock.onGet('/rides/pending').reply(200, { success: true, data: [], meta: {} });
    await driverRequestsApi.listPending(null);
    expect(mock.history.get[0].params).toBeUndefined();
  });

  it('a 409 carries error.code and a 429 carries retry_after', async () => {
    mock.onGet('/rides/pending').replyOnce(409, {
      success: false,
      message: 'Go online to see ride requests',
      error: { code: 'DRIVER_NOT_AVAILABLE', message: 'Go online to see ride requests' },
    });
    await expect(driverRequestsApi.listPending(null)).rejects.toMatchObject({
      status: 409,
      code: 'DRIVER_NOT_AVAILABLE',
    });

    mock.onGet('/rides/pending').replyOnce(429, { success: false, code: 'rate_limited', retry_after: 12 });
    await expect(driverRequestsApi.listPending(null)).rejects.toMatchObject({
      kind: 'rate_limited',
      retryAfter: 12,
    });
  });

  it('accept posts to assign-driver with no body', async () => {
    mock.onPost('/rides/7/assign-driver').reply(200, { success: true, data: { id: 7, status: 'accepted' } });
    await expect(driverRequestsApi.accept(7)).resolves.toMatchObject({ id: 7, status: 'accepted' });
    expect(mock.history.post[0].data).toBeUndefined();
  });
});
