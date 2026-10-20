/**
 * T-302 / BE-58 / BE-05: the vehicle list comes from GET /public/vehicle-types and each
 * option is priced by one POST /rides/estimate (matched on vehicle_type). Before, the screen
 * listed hardcoded economy/comfort/premium options priced with local multipliers on a
 * client-side 50 + 25/km fare.
 */
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import {
  buildEstimateBody,
  fetchFareEstimates,
  fetchVehicleTypes,
  normalizeFareEstimates,
  type FareEstimates,
} from '../../../src/features/ride-booking/api';
import { formatFare, quoteBreakdown, toVehicleOptions } from '../../../src/features/ride-booking/vehicleOptions';
import { fareBreakdownRows } from '../../../src/components/ui/ride/FareBreakdown';
import { envelope } from '../../../test-utils/rideFixtures';

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
});

const fareBasis = { currency: 'PKR', base_fare: 50, per_km: 25, per_min: 2, min_fare: 100, per_stop: 20 };
const catalogue = [
  { key: 'car', label: 'Car', capacity: 4, icon: 'car', fare: fareBasis },
  { key: 'bike', label: 'Bike', capacity: 1, icon: 'bike', fare: fareBasis },
  { key: 'rickshaw', label: 'Rickshaw', capacity: 3, icon: 'rickshaw', fare: fareBasis },
  { key: 'van', label: 'Van', capacity: 7, icon: 'van', fare: fareBasis },
];

const quote = (vehicle_type: string, fare: number) => ({
  vehicle_type,
  label: vehicle_type,
  capacity: 1,
  icon: vehicle_type,
  distance_km: 6.4,
  duration_min: 14,
  fare,
  currency: 'PKR',
  breakdown: { base: 50, distance: fare - 78, time: 28, stops: 0, min_fare_adjustment: 0 },
});

const estimateData = {
  currency: 'PKR',
  payment_method: 'cash',
  distance_km: 6.4,
  duration_min: 14,
  source: 'haversine',
  estimates: [quote('car', 260), quote('bike', 120), quote('van', 410)],
};

describe('GET /public/vehicle-types', () => {
  it('returns the catalogue keys and labels, dropping unknown keys', async () => {
    mock.onGet('/public/vehicle-types').reply(200, envelope([...catalogue, { key: 'economy', label: 'Economy' }]));

    const { types, notice } = await fetchVehicleTypes();

    expect(notice).toBeNull();
    expect(types.map((t) => t.key)).toEqual(['car', 'bike', 'rickshaw', 'van']);
    expect(types[0]).toEqual({ key: 'car', label: 'Car', capacity: 4 });
  });

  it('rejects on failure so the screen can show the error state', async () => {
    mock.onGet('/public/vehicle-types').networkError();
    await expect(fetchVehicleTypes()).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('POST /rides/estimate', () => {
  const route = {
    pickup: { latitude: 31.52, longitude: 74.35 },
    dropoff: { latitude: 31.47, longitude: 74.27 },
    stops: [{ latitude: 31.5, longitude: 74.3 }],
  };

  it('sends coordinates only (stops with stop_order), no vehicle_type, and reads every quote', async () => {
    mock.onPost('/rides/estimate').reply(200, envelope(estimateData));

    const result = await fetchFareEstimates(route);

    expect(mock.history.post).toHaveLength(1);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      pickup: { latitude: 31.52, longitude: 74.35 },
      dropoff: { latitude: 31.47, longitude: 74.27 },
      stops: [{ latitude: 31.5, longitude: 74.3, stop_order: 1 }],
    });
    expect(result.distance_km).toBe(6.4);
    expect(result.estimates.map((e) => [e.vehicle_type, e.fare])).toEqual([
      ['car', 260],
      ['bike', 120],
      ['van', 410],
    ]);
  });

  it('leaves stops out when there are none', () => {
    expect(buildEstimateBody({ ...route, stops: [] })).not.toHaveProperty('stops');
  });
});

describe('vehicle options and fare breakdown', () => {
  const estimates: FareEstimates = {
    distance_km: 6.4,
    duration_min: 14,
    estimates: estimateData.estimates.map((e) => ({
      vehicle_type: e.vehicle_type as 'car' | 'bike' | 'van',
      fare: e.fare,
      currency: 'PKR',
      breakdown: { ...e.breakdown, booking_fee: 0 },
      offer_band: null,
      fare_policy: null,
    })),
    fare_notice: null,
  };
  const types = catalogue.map(({ key, label, capacity }) => ({ key: key as 'car', label, capacity }));

  it('prices each catalogue option from its own estimate; a type without a quote is unavailable', () => {
    const options = toVehicleOptions(types, estimates);

    expect(options.map((o) => [o.id, o.name, o.fare, o.unavailable])).toEqual([
      ['car', 'Car', 'Rs\u00A0260', false],
      ['bike', 'Bike', 'Rs\u00A0120', false],
      ['rickshaw', 'Rickshaw', null, true],
      ['van', 'Van', 'Rs\u00A0410', false],
    ]);
    // UI-R5: no emoji artwork; the card picks an MDI glyph from the key.
    expect(JSON.stringify(options)).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(options.map((o) => o.id)).not.toContain('economy');
  });

  it('shows no prices (and nothing "unavailable") while the estimate is not in', () => {
    expect(toVehicleOptions(types, null).every((o) => o.fare === null && !o.unavailable)).toBe(true);
  });

  it('the breakdown is the server one and adds up to the quoted fare', () => {
    const car = estimates.estimates[0];
    const rows = fareBreakdownRows(quoteBreakdown(car), { distanceKm: estimates.distance_km, durationMin: estimates.duration_min });

    expect(rows.map(({ label, value }) => ({ label, value }))).toEqual([
      { label: 'Base fare', value: 'Rs\u00A050' },
      { label: 'Distance · 6.4 km', value: 'Rs\u00A0182' },
      { label: 'Time · 14 min', value: 'Rs\u00A028' },
    ]);
    expect(50 + 182 + 28).toBe(car.fare);
    expect(formatFare(car.fare, car.currency)).toBe('Rs\u00A0260');
  });

  it('lists stops and a minimum-fare top-up only when the server charged them', () => {
    const rows = fareBreakdownRows(
      quoteBreakdown({
        vehicle_type: 'bike',
        fare: 100,
        currency: 'PKR',
        breakdown: { base: 30, distance: 20, time: 10, stops: 20, min_fare_adjustment: 20, booking_fee: 0 },
        offer_band: null,
        fare_policy: null,
      }),
      { distanceKm: estimates.distance_km, durationMin: estimates.duration_min },
    );
    expect(rows.map((r) => r.label)).toEqual(['Base fare', 'Distance · 6.4 km', 'Time · 14 min', 'Stops', 'Minimum fare adjustment']);
  });
});

describe('T-521: fare notice, offer band, fare policy and booking fee', () => {
  const band = { min: 130, max: 180, step: 10, server_fare: 152, down_percent: 20, up_percent: 20 };
  const policy = {
    fees_enabled: true,
    free_wait_min: 3,
    wait_per_min: 3,
    max_wait_billed_minutes: 15,
    cancel_fee: 50,
    free_cancel_minutes: 5,
    no_show_wait_minutes: 5,
  };

  it('reads the band, the terms, the booking fee and the estimate notice', () => {
    const data = normalizeFareEstimates({
      ...estimateData,
      fare_notice: { percent: 10, note: 'Fares updated for fuel prices', effective_from: '2026-10-14T12:00:00+00:00' },
      estimates: [{ ...quote('car', 152), offer_band: band, fare_policy: policy, breakdown: { base: 100, distance: 30, time: 12, stops: 0, min_fare_adjustment: 0, booking_fee: 10 } }],
    });
    const car = data.estimates[0];
    expect(data.fare_notice).toEqual({ percent: 10, note: 'Fares updated for fuel prices', effectiveFrom: '2026-10-14T12:00:00+00:00' });
    expect(car.offer_band).toEqual({ min: 130, max: 180, step: 10, serverFare: 152 });
    expect(car.fare_policy).toMatchObject({ feesEnabled: true, freeWaitMin: 3, waitPerMin: 3, cancelFee: 50, freeCancelMinutes: 5 });
    expect(car.breakdown.booking_fee).toBe(10);
    expect(fareBreakdownRows(quoteBreakdown(car)).map((r) => r.label)).toContain('Booking fee');
  });

  it('treats offers off (null band), a band without the server fare inside, and no notice as absent', () => {
    const data = normalizeFareEstimates({
      ...estimateData,
      estimates: [
        { ...quote('car', 152), offer_band: null },
        { ...quote('bike', 120), offer_band: { ...band, server_fare: 500 } },
      ],
    });
    expect(data.fare_notice).toBeNull();
    expect(data.estimates.map((e) => e.offer_band)).toEqual([null, null]);
  });

  it('GET /public/vehicle-types returns meta.fare_notice with the types', async () => {
    mock.onGet('/public/vehicle-types').reply(200, {
      success: true,
      data: catalogue,
      meta: { fare_notice: { percent: 10, note: 'Fares updated for fuel prices', effective_from: null } },
    });
    const { types, notice } = await fetchVehicleTypes();
    expect(types).toHaveLength(4);
    expect(notice?.note).toBe('Fares updated for fuel prices');
  });
});
