/**
 * T-304 (PAX-05): the passenger stage machine. Before T-304 the screen stayed on
 * "requesting" whatever the server said, and ended every final status with an Alert.
 */
import {
  advanceRideStage,
  canPassengerCancel,
  cancelledByOf,
  driverCardOf,
  fareSummaryOf,
  isDriverTrackable,
  rideStageOf,
} from '../../../src/features/active-ride/stage';
import { makeRide } from '../../../test-utils/rideFixtures';

describe('rideStageOf (BE-04 statuses)', () => {
  it('maps every server status to one passenger stage', () => {
    expect(rideStageOf('requested')).toBe('searching');
    expect(rideStageOf('accepted')).toBe('driver_en_route');
    expect(rideStageOf('arrived')).toBe('driver_arrived');
    expect(rideStageOf('started')).toBe('in_trip');
    expect(rideStageOf('completed')).toBe('completed');
    expect(rideStageOf('cancelled')).toBe('cancelled');
  });

  it('the passenger can cancel until the trip starts', () => {
    expect(canPassengerCancel('searching')).toBe(true);
    expect(canPassengerCancel('driver_arrived')).toBe(true);
    expect(canPassengerCancel('in_trip')).toBe(false);
    expect(canPassengerCancel('completed')).toBe(false);
  });
});

describe('isDriverTrackable (when to poll /rides/{id}/driver-location)', () => {
  it('only accepted, arrived or started with a driver', () => {
    for (const status of ['accepted', 'arrived', 'started'] as const) {
      expect(isDriverTrackable(makeRide({ status, driver_id: 5 }))).toBe(true);
    }
    for (const status of ['requested', 'completed', 'cancelled'] as const) {
      expect(isDriverTrackable(makeRide({ status, driver_id: 5 }))).toBe(false);
    }
    expect(isDriverTrackable(makeRide({ status: 'accepted', driver_id: undefined }))).toBe(false);
    expect(isDriverTrackable(null)).toBe(false);
  });
});

describe('advanceRideStage', () => {
  it('follows the status of one ride, keeping the same object when nothing changed', () => {
    const s1 = advanceRideStage(null, makeRide({ id: 1, status: 'requested' }));
    expect(s1).toEqual({ rideId: 1, stage: 'searching', notice: null });
    expect(advanceRideStage(s1, makeRide({ id: 1, status: 'requested' }))).toBe(s1);
    expect(advanceRideStage(s1, makeRide({ id: 1, status: 'arrived' }))).toEqual({ rideId: 1, stage: 'driver_arrived', notice: null });
    expect(advanceRideStage(s1, null)).toBeNull();
  });

  it('driver cancel in requeue mode: back to searching with a notice, not the end of the ride', () => {
    const accepted = advanceRideStage(null, makeRide({ id: 1, status: 'accepted', driver_id: 5 }));
    const requeued = advanceRideStage(accepted, makeRide({ id: 1, status: 'requested' }));
    expect(requeued).toEqual({ rideId: 1, stage: 'searching', notice: 'driver_cancelled' });
    // The notice stays while searching, and goes once a new driver accepts.
    expect(advanceRideStage(requeued, makeRide({ id: 1, status: 'requested' }))).toBe(requeued);
    expect(advanceRideStage(requeued, makeRide({ id: 1, status: 'accepted' }))?.notice).toBeNull();
  });

  it('a different ride starts without a notice', () => {
    const accepted = advanceRideStage(null, makeRide({ id: 1, status: 'accepted' }));
    expect(advanceRideStage(accepted, makeRide({ id: 2, status: 'requested' }))).toEqual({
      rideId: 2,
      stage: 'searching',
      notice: null,
    });
  });
});

describe('cancelledByOf', () => {
  it('reads cancellation_reason', () => {
    expect(cancelledByOf(makeRide({ cancellation_reason: 'passenger' }))).toBe('passenger');
    expect(cancelledByOf(makeRide({ cancellation_reason: 'driver' }))).toBe('driver');
    expect(cancelledByOf(makeRide({ cancellation_reason: 'system' }))).toBe('system');
    expect(cancelledByOf(makeRide({ cancellation_reason: null }))).toBe('system');
  });
});

describe('driverCardOf', () => {
  it('uses the server driver and vehicle (make, model, colour, plate)', () => {
    const ride = makeRide({
      driver: { id: 5, name: 'Ali', rating: 4.5 },
      vehicle: { id: 3, make: 'Suzuki', model: 'Alto', color: 'Silver', license_plate: 'LEB-77' },
    });
    expect(driverCardOf(ride)).toEqual({ name: 'Ali', rating: 4.5, vehicleName: 'Suzuki Alto', color: 'Silver', plate: 'LEB-77' });
  });

  it('invents nothing when fields are missing (no "Car", no rating for unrated)', () => {
    expect(driverCardOf(makeRide({ driver: { id: 5, name: '', rating: 0 }, vehicle: null }))).toEqual({
      name: null,
      rating: null,
      vehicleName: null,
      color: null,
      plate: null,
    });
  });
});

describe('fareSummaryOf', () => {
  it('uses total_fare and fare_breakdown from the server (decimal strings too)', () => {
    const wire = {
      total_fare: '310.00',
      payment_method: 'cash',
      fare_breakdown: { base: '50.00', distance: 200, time: 40, stops: 20, min_fare_adjustment: 0, total: 310 },
    };
    expect(fareSummaryOf(wire)).toEqual({
      total: 310,
      breakdown: { base: 50, distance: 200, time: 40, stops: 20, minFareAdjustment: 0 },
      paymentMethod: 'cash',
    });
  });

  it('no breakdown when the server sends none; null without a total', () => {
    expect(fareSummaryOf(makeRide({ total_fare: 190, fare_breakdown: null }))?.breakdown).toBeNull();
    expect(fareSummaryOf({ total_fare: null })).toBeNull();
  });
});
