/**
 * T-304: the in-ride panel shows one view per server stage: the completed summary with the
 * server total_fare and fare_breakdown (cash), who cancelled, and the real driver card.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import ActiveRidePanel from '../../../src/features/active-ride/components/ActiveRidePanel';
import { advanceRideStage, type PassengerRideStageState } from '../../../src/features/active-ride/stage';
import type { RideResource } from '../../../src/services/rideService';
import { makeRide } from '../../../test-utils/rideFixtures';

const stateOf = (ride: RideResource): PassengerRideStageState => {
  const state = advanceRideStage(null, ride);
  if (!state) throw new Error('no stage');
  return state;
};

const renderPanel = (ride: RideResource | null, stageState: PassengerRideStageState) => {
  const onCancel = jest.fn();
  const onDone = jest.fn();
  const utils = render(<ActiveRidePanel stageState={stageState} ride={ride} onCancel={onCancel} onDone={onDone} />);
  return { ...utils, onCancel, onDone };
};

describe('ActiveRidePanel', () => {
  it('searching: finding a driver, with Cancel', () => {
    const ride = makeRide({ status: 'requested' });
    const { getByText, getByTestId, onCancel } = renderPanel(ride, stateOf(ride));
    expect(getByText('Finding you a driver…')).toBeTruthy();
    fireEvent.press(getByTestId('active-ride-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('requeued: says the driver cancelled and that it is searching again', () => {
    const ride = makeRide({ status: 'requested' });
    const { getByText, queryByTestId } = renderPanel(ride, { rideId: ride.id, stage: 'searching', notice: 'driver_cancelled' });
    expect(getByText('Your driver cancelled. Finding you another driver…')).toBeTruthy();
    expect(queryByTestId('active-ride-done')).toBeNull();
  });

  it.each([
    ['accepted', 'Your driver is on the way', true],
    ['arrived', 'Your driver has arrived', true],
    ['started', 'Trip in progress', false],
  ] as const)('%s: title, the real driver card, cancel only before the trip', (status, title, cancellable) => {
    const ride = makeRide({
      status,
      driver_id: 5,
      driver: { id: 5, name: 'Ali', rating: 4.9 },
      vehicle: { id: 2, make: 'Honda', model: 'City', color: 'Grey', license_plate: 'LEC-9' },
    });
    const { getByText, getByTestId, queryByTestId } = renderPanel(ride, stateOf(ride));
    expect(getByText(title)).toBeTruthy();
    expect(getByTestId('driver-assigned-card')).toBeTruthy();
    expect(getByText('Honda City · Grey')).toBeTruthy();
    expect(getByText('Plate LEC-9')).toBeTruthy();
    expect(!!queryByTestId('active-ride-cancel')).toBe(cancellable);
  });

  it('completed: the server total and breakdown, cash, and Done', () => {
    const ride = makeRide({
      status: 'completed',
      total_fare: 310,
      distance_km: 8.4,
      duration_minutes: 21,
      payment_method: 'cash',
      fare_breakdown: { base: 50, distance: 200, time: 40, stops: 20, min_fare_adjustment: 0, total: 310 },
    });
    const { getByText, getByTestId, queryByTestId, onDone } = renderPanel(ride, stateOf(ride));
    expect(getByText('Ride completed')).toBeTruthy();
    expect(getByText('Rs 310')).toBeTruthy();
    expect(getByText('Distance (8.4 km)')).toBeTruthy();
    expect(getByText('Rs 200')).toBeTruthy();
    expect(getByText('Stops')).toBeTruthy();
    expect(getByText('Pay your driver in cash')).toBeTruthy();
    expect(queryByTestId('active-ride-cancel')).toBeNull();
    fireEvent.press(getByTestId('active-ride-done'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['passenger', 'You cancelled this ride.'],
    ['driver', 'Your driver cancelled this ride.'],
    ['system', 'This ride was cancelled.'],
  ])('cancelled by %s', (reason, text) => {
    const ride = makeRide({ status: 'cancelled', cancellation_reason: reason });
    const { getByText, getByTestId } = renderPanel(ride, stateOf(ride));
    expect(getByText(text)).toBeTruthy();
    expect(getByTestId('active-ride-done')).toBeTruthy();
  });
});
