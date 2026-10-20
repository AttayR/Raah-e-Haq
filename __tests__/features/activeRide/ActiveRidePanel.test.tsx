/**
 * T-304: the in-ride panel shows one view per server stage: the completed summary with the
 * server total_fare and fare_breakdown (cash), who cancelled, and the real driver card.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import ActiveRidePanel, { ActiveRideDoneButton, isPassengerRideFinished } from '../../../src/features/active-ride/components/ActiveRidePanel';
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
  it('searching (UI-R10): title, the trip card from the ride, no progress segments, Cancel request', () => {
    const ride = makeRide({ status: 'requested', offered_fare: '210', vehicle_type: 'rickshaw', requested_at: new Date().toISOString() });
    const { getByText, getByTestId, queryByTestId, onCancel } = renderPanel(ride, stateOf(ride));
    expect(getByText('Finding you a driver')).toBeTruthy();
    expect(getByText('This usually takes under a minute.')).toBeTruthy();
    expect(getByTestId('searching-trip-card-pickup')).toHaveTextContent('Fake Pickup Street');
    expect(getByTestId('searching-trip-card-dropoff')).toHaveTextContent('Fake Dropoff Road');
    expect(getByTestId('searching-trip-card-vehicle')).toHaveTextContent('Rickshaw');
    // The passenger's offer (BE-83), else the quote.
    expect(getByTestId('searching-trip-card-fare')).toHaveTextContent('Rs 210');
    expect(queryByTestId('active-ride-progress')).toBeNull();
    expect(getByTestId('active-ride-cancel')).toHaveTextContent('Cancel request');
    fireEvent.press(getByTestId('active-ride-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('searching while POST /rides runs: the card comes from the draft, with the server tier name', () => {
    const draft = {
      pickup: 'Liberty Market',
      dropoff: 'Emporium Mall',
      stops: ['Model Town'],
      vehicleKey: 'car_ac',
      vehicleName: 'Comfort AC',
      fare: 'Rs 340',
    };
    const { getByTestId, getByText } = render(
      <ActiveRidePanel stageState={{ rideId: null, stage: 'searching', notice: null }} ride={null} onCancel={jest.fn()} draft={draft} />,
    );
    expect(getByTestId('searching-trip-card-vehicle')).toHaveTextContent('Comfort AC');
    expect(getByTestId('searching-trip-card-fare')).toHaveTextContent('Rs 340');
    expect(getByText('Model Town')).toBeTruthy();
  });

  it('searching: after a minute the subtitle says it is still looking (one timer)', () => {
    jest.useFakeTimers({ now: new Date('2026-10-19T10:00:30Z') });
    try {
      const ride = makeRide({ status: 'requested', requested_at: '2026-10-19T10:00:00Z' });
      const { getByText } = renderPanel(ride, stateOf(ride));
      expect(getByText('This usually takes under a minute.')).toBeTruthy();
      act(() => {
        jest.advanceTimersByTime(30_000);
      });
      expect(getByText('Still looking. More drivers are joining.')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('the inline searching bar can move to the sheet edge (the booking sheet draws it)', () => {
    const ride = makeRide({ status: 'requested' });
    const { queryByTestId, rerender } = renderPanel(ride, stateOf(ride));
    rerender(<ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={jest.fn()} inlineSearchingBar={false} />);
    expect(queryByTestId('active-ride-searching-bar')).toBeNull();
  });

  it('requeued: says the driver cancelled and that it is searching again', () => {
    const ride = makeRide({ status: 'requested' });
    const { getByText, queryByTestId } = renderPanel(ride, { rideId: ride.id, stage: 'searching', notice: 'driver_cancelled' });
    expect(getByText("Your driver cancelled. We're asking other drivers nearby.")).toBeTruthy();
    expect(queryByTestId('active-ride-done')).toBeNull();
  });

  it.each([
    // UI-R12 status sentences (PA2, PT2).
    ['accepted', 'Driver is on the way', true],
    ['arrived', 'Your driver is here', true],
    ['started', 'Heading to Fake Dropoff Road', false],
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

    it('[T-520] shows the ride PIN with "Share this PIN with your driver" only while the server sends it', () => {
      const ride = accepted({ pin: '0427', pin_required: true });
      const { getByTestId, rerender, queryByTestId } = renderPanel(ride, stateOf(ride));
      expect(getByTestId('ride-pin-card-hint').props.children).toBe('Share this PIN with your driver');
      const started = accepted({ status: 'started', pin: undefined });
      rerender(<ActiveRidePanel stageState={stateOf(started)} ride={started} onCancel={jest.fn()} onDone={jest.fn()} />);
      expect(queryByTestId('ride-pin-card')).toBeNull();
    });

    it('[T-520] Call waits while the masked call is requested', () => {
      const ride = accepted();
      const onCall = jest.fn();
      const { getByTestId, getByText } = render(
        <ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={jest.fn()} onDone={jest.fn()} onCall={onCall} calling />,
      );
      expect(getByText('Connecting…')).toBeTruthy();
      expect(getByTestId('driver-call-button').props.accessibilityState).toMatchObject({ disabled: true });
    });

    it('hides Call without a call handler (no contact.can_call)', () => {
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

  it('completed (UI-R12 receipt): the server total in the money card, Fare details expands the breakdown, Done', () => {
    const ride = makeRide({
      status: 'completed',
      total_fare: 310,
      distance_km: 8.4,
      duration_minutes: 21,
      payment_method: 'cash',
      fare_breakdown: { base: 50, distance: 200, time: 40, stops: 20, min_fare_adjustment: 0, total: 310 },
    });
    const { getByText, getByTestId, queryByTestId, onDone } = renderPanel(ride, stateOf(ride));
    expect(getByText("You've arrived")).toBeTruthy();
    expect(getByTestId('receipt-amount')).toHaveTextContent('Rs 310');
    expect(getByText('Pay your driver in cash')).toBeTruthy();
    // PR2 block 4: the breakdown is collapsed until "Fare details" is tapped.
    expect(queryByTestId('ride-fare-breakdown')).toBeNull();
    fireEvent.press(getByTestId('receipt-fare-details'));
    expect(getByText('Distance · 8.4 km')).toBeTruthy();
    expect(getByText('Rs 200')).toBeTruthy();
    expect(getByText('Stops')).toBeTruthy();
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

  it('T-564: without onDone (booking map) the panel leaves Done to the sheet footer', () => {
    const ride = makeRide({ status: 'completed' });
    const { queryByTestId } = render(<ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={jest.fn()} />);
    expect(queryByTestId('active-ride-done')).toBeNull();
    const onPress = jest.fn();
    const footer = render(<ActiveRideDoneButton onPress={onPress} />);
    fireEvent.press(footer.getByTestId('active-ride-done'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(footer.getByText('Done')).toBeTruthy();
  });

  it.each([
    ['completed', true],
    ['cancelled', true],
    ['in_trip', false],
    ['searching', false],
    [null, false],
  ] as const)('isPassengerRideFinished(%s) is %s', (stage, finished) => {
    expect(isPassengerRideFinished(stage)).toBe(finished);
  });
});
