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
  type FareEstimates,
} from '../../../src/features/ride-booking/api';
import { fareBreakdownRows, formatFare, toVehicleOptions } from '../../../src/features/ride-booking/vehicleOptions';
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

    const types = await fetchVehicleTypes();

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
      breakdown: e.breakdown,
    })),
  };
  const types = catalogue.map(({ key, label, capacity }) => ({ key: key as 'car', label, capacity }));

  it('prices each catalogue option from its own estimate; a type without a quote shows no price', () => {
    const options = toVehicleOptions(types, estimates);

    expect(options.map((o) => [o.id, o.name, o.price])).toEqual([
      ['car', 'Car', 'Rs 260'],
      ['bike', 'Bike', 'Rs 120'],
      ['rickshaw', 'Rickshaw', '—'],
      ['van', 'Van', 'Rs 410'],
    ]);
    expect(options.find((o) => o.id === 'bike')?.icon).toBe('🏍️');
    expect(options.map((o) => o.id)).not.toContain('economy');
  });

  it('shows no prices while the estimate is not in', () => {
    expect(toVehicleOptions(types, null).every((o) => o.price === '—')).toBe(true);
  });

  it('the breakdown is the server one and adds up to the quoted fare', () => {
    const car = estimates.estimates[0];
    const rows = fareBreakdownRows(car, estimates);

    expect(rows).toEqual([
      { label: 'Base fare', value: 'Rs 50' },
      { label: 'Distance (6.4 km)', value: 'Rs 182' },
      { label: 'Time (14 min)', value: 'Rs 28' },
    ]);
    expect(50 + 182 + 28).toBe(car.fare);
    expect(formatFare(car.fare, car.currency)).toBe('Rs 260');
  });

  it('lists stops and a minimum-fare top-up only when the server charged them', () => {
    const rows = fareBreakdownRows(
      { vehicle_type: 'bike', fare: 100, currency: 'PKR', breakdown: { base: 30, distance: 20, time: 10, stops: 20, min_fare_adjustment: 20 } },
      estimates,
    );
    expect(rows.map((r) => r.label)).toEqual(['Base fare', 'Distance (6.4 km)', 'Time (14 min)', 'Stops', 'Minimum fare adjustment']);
  });
});
