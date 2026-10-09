/**
 * T-302 (PAX-02/04/15/23): the POST /rides body. Before, PassengerMapScreen sent
 * passenger_id: 11, 'Pickup Location' / 'Destination Location', no stops, and the unmapped
 * vehicle id (economy/comfort/premium), so every non-bike booking got a 422.
 */
import {
  BUILD_ERRORS,
  buildRideRequest,
  coordinateLabel,
  withAddresses,
} from '../../../src/features/ride-booking/buildRideRequest';

const pickup = { latitude: 31.5204, longitude: 74.3587, address: 'Liberty Market, Lahore' };
const dropoff = { latitude: 31.4697, longitude: 74.2728, address: 'Johar Town, Lahore' };

describe('buildRideRequest', () => {
  it('sends the real addresses and coordinates, the catalogue key, and no passenger_id or service_level', () => {
    const result = buildRideRequest({ pickup, dropoff, vehicleType: 'car' });

    expect(result).toEqual({
      ok: true,
      request: {
        pickup_address: 'Liberty Market, Lahore',
        dropoff_address: 'Johar Town, Lahore',
        pickup_latitude: 31.5204,
        pickup_longitude: 74.3587,
        dropoff_latitude: 31.4697,
        dropoff_longitude: 74.2728,
        vehicle_type: 'car',
      },
    });
    const body = result.ok ? result.request : {};
    expect(body).not.toHaveProperty('passenger_id');
    expect(body).not.toHaveProperty('service_level');
    expect(JSON.stringify(body)).not.toMatch(/Pickup Location|Destination Location/);
  });

  it.each(['car', 'bike', 'rickshaw', 'van'])('passes the %s key through unchanged', (key) => {
    const result = buildRideRequest({ pickup, dropoff, vehicleType: key });
    expect(result.ok && result.request.vehicle_type).toBe(key);
  });

  it.each(['economy', 'comfort', 'premium', '', undefined, null])('refuses %p (not a server vehicle type)', (key) => {
    expect(buildRideRequest({ pickup, dropoff, vehicleType: key })).toEqual({ ok: false, error: BUILD_ERRORS.vehicle });
  });

  it('includes stops in the order added, with stop_order 1..n and their addresses', () => {
    const result = buildRideRequest({
      pickup,
      dropoff,
      vehicleType: 'bike',
      stops: [
        { latitude: 31.51, longitude: 74.34, address: 'Gulberg' },
        { latitude: 31.49, longitude: 74.3, address: 'Model Town' },
      ],
    });

    expect(result.ok && result.request.stops).toEqual([
      { address: 'Gulberg', latitude: 31.51, longitude: 74.34, stop_order: 1 },
      { address: 'Model Town', latitude: 31.49, longitude: 74.3, stop_order: 2 },
    ]);
  });

  it('includes passenger count and trimmed instructions when given, and leaves empty ones out', () => {
    const withExtras = buildRideRequest({
      pickup,
      dropoff,
      vehicleType: 'van',
      passengerCount: 4,
      specialInstructions: '  Gate 2  ',
    });
    expect(withExtras.ok && withExtras.request).toMatchObject({ passenger_count: 4, special_instructions: 'Gate 2' });

    const blank = buildRideRequest({ pickup, dropoff, vehicleType: 'van', specialInstructions: '   ' });
    expect(blank.ok && blank.request).not.toHaveProperty('special_instructions');
    expect(blank.ok && blank.request).not.toHaveProperty('passenger_count');
  });

  it('refuses a point without an address, a missing point, too many stops or a bad count', () => {
    expect(buildRideRequest({ pickup: { ...pickup, address: '  ' }, dropoff, vehicleType: 'car' })).toEqual({
      ok: false,
      error: BUILD_ERRORS.address,
    });
    expect(buildRideRequest({ pickup, dropoff: null, vehicleType: 'car' })).toEqual({ ok: false, error: BUILD_ERRORS.route });
    expect(
      buildRideRequest({ pickup, dropoff, vehicleType: 'car', stops: Array.from({ length: 6 }, () => pickup) }),
    ).toEqual({ ok: false, error: BUILD_ERRORS.stops });
    expect(buildRideRequest({ pickup, dropoff, vehicleType: 'car', passengerCount: 9 })).toEqual({
      ok: false,
      error: BUILD_ERRORS.passengers,
    });
  });

  it('caps an address at the server limit (255)', () => {
    const result = buildRideRequest({ pickup: { ...pickup, address: 'x'.repeat(300) }, dropoff, vehicleType: 'car' });
    expect(result.ok && result.request.pickup_address).toHaveLength(255);
  });
});

describe('withAddresses (map-tapped points)', () => {
  it('geocodes points without an address, keeps named ones, and falls back to coordinates', async () => {
    const tapped = { latitude: 31.5, longitude: 74.3 };
    const unnamed = { latitude: 31.4, longitude: 74.2 };
    const reverse = jest.fn(async (lat: number) => (lat === 31.5 ? 'Mall Road, Lahore' : null));

    const [a, b, c, d] = await withAddresses([pickup, tapped, unnamed, null], reverse);

    expect(a).toBe(pickup);
    expect(b).toEqual({ ...tapped, address: 'Mall Road, Lahore' });
    expect(c).toEqual({ ...unnamed, address: coordinateLabel(unnamed) });
    expect(c?.address).toBe('31.40000, 74.20000');
    expect(d).toBeNull();
    expect(reverse).toHaveBeenCalledTimes(2);
  });

  it('a geocoding failure still gives a real (coordinate) address', async () => {
    const [p] = await withAddresses([{ latitude: 1, longitude: 2 }], async () => {
      throw new Error('offline');
    });
    expect(p?.address).toBe('1.00000, 2.00000');
  });
});
