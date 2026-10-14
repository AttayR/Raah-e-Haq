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
    // T-524: make + model and the colour on separate lines (no break inside "make model · colour").
    expect(getByText('Honda City')).toBeTruthy();
    expect(getByText('Grey')).toBeTruthy();
    // UI-R5 PersonCard: the plate in its pill.
    expect(getByText('LEC-9')).toBeTruthy();
    expect(!!queryByTestId('active-ride-cancel')).toBe(cancellable);
  });

  describe('driver card (ported from the deleted DriverAssignedCard test, T-110 / BE-20 / T-304)', () => {
    const accepted = (overrides: Partial<RideResource> = {}) =>
      makeRide({
        status: 'accepted',
        driver_id: 5,
        driver: { id: 5, name: 'Ali', rating: 4.8 },
        vehicle: { id: 2, make: 'Toyota', model: 'Corolla', color: 'White', license_plate: 'LEA-1234' },
        ...overrides,
      });

    it('hides Call without a phone handler', () => {
      const ride = accepted();
      const { queryByTestId } = renderPanel(ride, stateOf(ride));
      expect(queryByTestId('driver-call-button')).toBeNull();
    });

    it('shows Call and calls the handler once when given', () => {
      const ride = accepted();
      const onCall = jest.fn();
      const { getByTestId } = render(
        <ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={jest.fn()} onDone={jest.fn()} onCall={onCall} />,
      );
      fireEvent.press(getByTestId('driver-call-button'));
      expect(onCall).toHaveBeenCalledTimes(1);
    });

    it('leaves out what the server did not send: no vehicle, plate or invented "Car"; unrated reads "New"', () => {
      const ride = accepted({ driver: { id: 5, name: 'Ali', rating: null }, vehicle: null });
      const { queryByTestId, queryByText, getByText } = renderPanel(ride, stateOf(ride));
      expect(getByText('Ali')).toBeTruthy();
      expect(queryByTestId('driver-vehicle')).toBeNull();
      expect(queryByTestId('driver-plate')).toBeNull();
      expect(getByText('New')).toBeTruthy();
      expect(queryByText(/Car/)).toBeNull();
      expect(queryByText(/ETA|\d+ min/)).toBeNull();
    });

    it('has no Message action outside a navigator', () => {
      const ride = accepted();
      const { queryByTestId, queryByText } = renderPanel(ride, stateOf(ride));
      expect(queryByTestId('ride-chat-button')).toBeNull();
      expect(queryByText('Message')).toBeNull();
    });
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
    expect(getByText('Distance · 8.4 km')).toBeTruthy();
    expect(getByText('Rs 200')).toBeTruthy();
    expect(getByText('Stops')).toBeTruthy();
    expect(getByText('Pay your driver in cash')).toBeTruthy();
    // T-311: the summary is the final fare (the booking price was only an estimate).
    expect(getByText('Final fare')).toBeTruthy();
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
