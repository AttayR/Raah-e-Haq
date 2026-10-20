/**
 * T-403/T-404: GET /rides/pending and POST /rides/{id}/assign-driver, and the request mapping.
 */
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import {
  driverRequestsApi,
  toPendingRideRequest,
  toPendingRideStops,
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
      passengerPhotoUrl: null,
      passengerRating: 4.8,
      estimatedDistanceKm: 1.24,
      estimatedPickupMin: 3,
      estimatedFare: 350,
      paymentMethod: 'cash',
      vehicleType: 'car',
      expiresAt: Date.parse('2026-10-09T10:00:00.000Z') + 10 * 60_000,
      isOffer: false,
      serverFare: null,
      stops: [],
      parcel: null,
      driverNet: null,
      commissionRate: null,
      commissionAmount: null,
      passengerCount: null,
      tripDistanceKm: null,
      tripDurationMin: null,
      offerSeconds: null,
    });
  });

  it('UI-R11: maps the BE-84 split, the trip size and passengers, and BE-128 meta.offer_seconds', () => {
    const page = toPendingRidesPage({
      success: true,
      data: [pendingRide({ driver_net: '362.00', commission_rate: '20.00', commission_amount: 88, distance_km: '7.84', duration_minutes: 25, passenger_count: 2 })],
      meta: { max_age_minutes: 10, offer_seconds: 30 },
    });
    expect(page.requests[0]).toMatchObject({
      driverNet: 362,
      commissionRate: 20,
      commissionAmount: 88,
      tripDistanceKm: 7.84,
      tripDurationMin: 25,
      passengerCount: 2,
      offerSeconds: 30,
    });
    expect(toPendingRidesPage({ success: true, data: [pendingRide()], meta: { offer_seconds: 0 } }).requests[0].offerSeconds).toBeNull();
    expect(toPendingRidesPage({ success: true, data: [pendingRide()] }).requests[0].offerSeconds).toBeNull();
  });

  it('T-552: lists the active stops in route order (QA 2026-10-16: the card showed none)', () => {
    const request = toPendingRideRequest(
      pendingRide({
        stops: [
          { id: 12, address: 'Second Fake Stop', latitude: '31.50', longitude: '74.35', stop_order: 2, status: 'active' },
          { id: 11, address: 'First Fake Stop', latitude: '31.49', longitude: '74.35', stop_order: 1, status: 'active' },
          { id: 13, address: 'Done Fake Stop', stop_order: 3, status: 'completed' },
          { id: 14, address: '  ', stop_order: 4, status: 'active' },
          'junk',
        ],
      }),
      10,
    );
    expect(request?.stops).toEqual([
      // UI-R11 R1: with their coordinates, for the numbered stop pins.
      { id: 11, address: 'First Fake Stop', point: { latitude: 31.49, longitude: 74.35 } },
      { id: 12, address: 'Second Fake Stop', point: { latitude: 31.5, longitude: 74.35 } },
    ]);
    expect(toPendingRideStops(undefined)).toEqual([]);
    expect(toPendingRideStops([{ address: 'No Id Stop' }])).toEqual([{ id: null, address: 'No Id Stop', point: null }]);
  });

  it('T-521 (BE-83): marks a passenger offer and keeps the app fare to compare', () => {
    const request = toPendingRideRequest(
      pendingRide({ is_offer: true, offered_fare: '170.00', server_fare: '152.00', estimated_fare: '170.00' }),
      10,
    );
    expect(request).toMatchObject({ isOffer: true, estimatedFare: 170, serverFare: 152 });
    // An offer flag without an offered fare is not shown as an offer.
    expect(toPendingRideRequest(pendingRide({ is_offer: true, offered_fare: null }), 10)?.isOffer).toBe(false);
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

  it('keeps the passenger photo from the minimal card (T-504)', () => {
    const request = toPendingRideRequest(
      pendingRide({ passenger: { id: 3, first_name: 'Ayesha', profile_image_url: 'https://cdn.test/p.jpg', rating: null } }),
      10,
    );
    expect(request?.passengerPhotoUrl).toBe('https://cdn.test/p.jpg');
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
