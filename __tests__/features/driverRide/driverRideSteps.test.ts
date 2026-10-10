/**
 * T-405: the pure helpers of the driver ride screen (status → step, stops, directions URL,
 * passenger phone, the server's fare summary).
 */
import {
  activeStops,
  getPassengerPhone,
  isRestorableDriverRide,
  mapsDirectionsUrl,
  navigationTarget,
  nextActiveStop,
  rideStep,
  toRideSummary,
} from '../../../src/features/driver-ride/steps';
import type { RideResource, RideStopResource } from '../../../src/services/rideService';
import { makeRide } from '../../../test-utils/rideFixtures';

const makeStop = (overrides: Partial<RideStopResource>): RideStopResource => ({
  id: 1,
  ride_id: 41,
  address: 'Fake Stop Lane',
  latitude: 31.5,
  longitude: 74.32,
  stop_order: 1,
  status: 'active',
  status_label: 'Active',
  status_color: 'blue',
  created_at: '2026-10-09T10:00:00Z',
  updated_at: '2026-10-09T10:00:00Z',
  ...overrides,
});

const passenger = (phone: string | undefined) => ({ id: 9, name: 'Fake', phone: phone as string });

describe('rideStep', () => {
  it('maps the BE-04 statuses to the driver steps', () => {
    expect(rideStep(makeRide({ status: 'accepted' }))).toBe('to_pickup');
    expect(rideStep(makeRide({ status: 'arrived' }))).toBe('at_pickup');
    expect(rideStep(makeRide({ status: 'started' }))).toBe('on_trip');
    expect(rideStep(makeRide({ status: 'completed' }))).toBe('summary');
    expect(rideStep(makeRide({ status: 'cancelled' }))).toBe('cancelled');
    // A driver cancel in requeue mode puts the ride back to requested: no longer ours.
    expect(rideStep(makeRide({ status: 'requested' }))).toBe('cancelled');
    expect(rideStep(null)).toBe('unknown');
  });

  it('restores only rides the driver still has work on', () => {
    expect(isRestorableDriverRide(makeRide({ status: 'accepted' }))).toBe(true);
    expect(isRestorableDriverRide(makeRide({ status: 'arrived' }))).toBe(true);
    expect(isRestorableDriverRide(makeRide({ status: 'started' }))).toBe(true);
    expect(isRestorableDriverRide(makeRide({ status: 'completed' }))).toBe(false);
    expect(isRestorableDriverRide(makeRide({ status: 'cancelled' }))).toBe(false);
    expect(isRestorableDriverRide(makeRide({ status: 'requested' }))).toBe(false);
  });
});

describe('stops', () => {
  const ride = makeRide({
    status: 'started',
    stops: [
      makeStop({ id: 3, stop_order: 3 }),
      makeStop({ id: 1, stop_order: 1, status: 'completed' }),
      makeStop({ id: 2, stop_order: 2 }),
      makeStop({ id: 4, stop_order: 4, status: 'cancelled' }),
    ],
  });

  it('lists the active stops in route order and picks the next one', () => {
    expect(activeStops(ride).map((stop) => stop.id)).toEqual([2, 3]);
    expect(nextActiveStop(ride)?.id).toBe(2);
    expect(nextActiveStop(makeRide({ stops: [makeStop({ status: 'completed' })] }))).toBeNull();
  });

  it('navigates to the pickup, then each stop, then the drop-off', () => {
    expect(navigationTarget(makeRide({ status: 'accepted' }))).toMatchObject({
      kind: 'pickup',
      coordinate: { latitude: 31.52, longitude: 74.35 },
    });
    expect(navigationTarget(makeRide({ status: 'arrived' }))?.kind).toBe('pickup');
    expect(navigationTarget(ride)).toMatchObject({ kind: 'stop', address: 'Fake Stop Lane' });
    expect(navigationTarget(makeRide({ status: 'started' }))).toMatchObject({
      kind: 'dropoff',
      coordinate: { latitude: 31.48, longitude: 74.3 },
    });
    expect(navigationTarget(makeRide({ status: 'completed' }))).toBeNull();
  });

  it('reads decimal-string coordinates and drops unusable ones', () => {
    const decimal = makeRide({
      status: 'accepted',
      pickup_latitude: '31.52000000' as unknown as number,
      pickup_longitude: '74.35000000' as unknown as number,
    });
    expect(navigationTarget(decimal)?.coordinate).toEqual({ latitude: 31.52, longitude: 74.35 });
    const broken = makeRide({ status: 'accepted', pickup_latitude: 'x' as unknown as number });
    expect(navigationTarget(broken)).toBeNull();
  });
});

describe('mapsDirectionsUrl', () => {
  const point = { latitude: 31.52, longitude: 74.35 };

  it('uses Apple Maps on iOS', () => {
    expect(mapsDirectionsUrl(point, 'ios')).toBe('http://maps.apple.com/?daddr=31.52%2C74.35&dirflg=d');
  });

  it('uses Google Maps on Android', () => {
    expect(mapsDirectionsUrl(point, 'android')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=31.52%2C74.35&travelmode=driving',
    );
  });
});

describe('getPassengerPhone', () => {
  it('returns a compact number only while the driver has the ride', () => {
    expect(getPassengerPhone(makeRide({ status: 'accepted', passenger: passenger('+92 300-0000000') }))).toBe(
      '+923000000000',
    );
    expect(getPassengerPhone(makeRide({ status: 'started', passenger: passenger('03000000000') }))).toBe('03000000000');
    expect(getPassengerPhone(makeRide({ status: 'completed', passenger: passenger('03000000000') }))).toBeNull();
    expect(getPassengerPhone(makeRide({ status: 'accepted', passenger: passenger(undefined) }))).toBeNull();
  });

  it('never returns text that is not a phone number', () => {
    expect(getPassengerPhone(makeRide({ status: 'accepted', passenger: passenger('call me at noon') }))).toBeNull();
    expect(getPassengerPhone(makeRide({ status: 'accepted', passenger: passenger('123') }))).toBeNull();
  });
});

describe('toRideSummary', () => {
  it('parses the server decimals, preferring the breakdown total', () => {
    const ride = makeRide({
      status: 'completed',
      total_fare: '410.00' as unknown as number,
      driver_earnings: '328.00' as unknown as number,
      distance_km: '6.20' as unknown as number,
      duration_minutes: 18,
      fare_breakdown: { base: 50, distance: '210.5', time: '54', stops: 25, min_fare_adjustment: 0, total: '410.00' },
    });
    expect(toRideSummary(ride)).toEqual({
      totalFare: 410,
      driverEarnings: 328,
      distanceKm: 6.2,
      durationMinutes: 18,
      paymentMethod: 'cash',
      breakdown: { base: 50, distance: 210.5, time: 54, stops: 25, minFareAdjustment: 0 },
    });
  });

  it('keeps missing numbers null instead of inventing them', () => {
    const ride = { ...makeRide({ status: 'completed' }), total_fare: null, driver_earnings: undefined } as unknown as RideResource;
    const summary = toRideSummary({ ...ride, fare_breakdown: null });
    expect(summary.totalFare).toBeNull();
    expect(summary.driverEarnings).toBeNull();
    expect(summary.breakdown).toBeNull();
  });
});
