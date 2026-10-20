/**
 * T-556 (QA 2026-10-16: one "Stop done" tap ignored): the ride screen re-reads the ride every
 * ~8 s, and while that read ran the panel disabled its step button, so a tap in that window did
 * nothing. A background read no longer disables the step (the slice lets the step take over);
 * the driver's own step in flight still shows loading and takes no second tap.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { expandTripSheet } from '../../test-utils/tripSheet';
import { DriverTripSheet } from '../../src/features/driver-ride/trip/DriverTripSheet';
import type { DriverRideAction } from '../../src/features/driver-ride/slice';
import type { RideStopResource } from '../../src/services/rideService';
import { makeRide } from '../../test-utils/rideFixtures';

const noop = () => undefined;

const stop: RideStopResource = {
  id: 5,
  ride_id: 41,
  address: 'Fake stop, Lahore',
  latitude: 31.52,
  longitude: 74.35,
  stop_order: 1,
  status: 'active',
  status_label: 'Active',
  status_color: 'blue',
  created_at: '2026-10-16T10:00:00Z',
  updated_at: '2026-10-16T10:00:00Z',
};

const renderPanel = (pendingAction: DriverRideAction | null, onCompleteStop: (id: number) => void) =>
  render(
    <DriverTripSheet onDone={() => undefined} onRatingChange={() => undefined}
      ride={makeRide({ id: 41, status: 'started', stops: [stop] })}
      step="on_trip"
      pendingAction={pendingAction}
      canCall={false}
      canNavigate={false}
      onCall={noop}
      onNavigate={noop}
      onArrived={noop}
      onStart={noop}
      onComplete={noop}
      onCompleteStop={onCompleteStop}
      onCancel={noop}
    />,
  );

describe('DriverRidePanel "Stop done" during a background read (T-556)', () => {
  it.each(['refresh', 'restore'] as const)('a tap while a %s runs reaches the flow', (read) => {
    const onCompleteStop = jest.fn();
    const { getByTestId } = renderPanel(read, onCompleteStop);
    const button = getByTestId('driver-ride-complete-stop');
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: false }));
    fireEvent.press(button);
    expect(onCompleteStop).toHaveBeenCalledWith(5);
  });

  it("the driver's own step in flight shows loading and takes no second tap", () => {
    const onCompleteStop = jest.fn();
    const { getByTestId } = renderPanel('stop', onCompleteStop);
    const button = getByTestId('driver-ride-complete-stop');
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true, busy: true }));
    fireEvent.press(button);
    expect(onCompleteStop).not.toHaveBeenCalled();
  });
});

/**
 * T-557: Cancel and "Passenger didn't come" were disabled for the background read too, so a tap
 * in that window did nothing. They now only open the confirm sheet, during a read as well; the
 * driver's own request in flight still disables them.
 */
const renderPickup = (
  pendingAction: DriverRideAction | null,
  handlers: { onCancel?: () => void; onNoShow?: () => void },
  step: 'to_pickup' | 'at_pickup',
) => {
  const view = render(
    <DriverTripSheet onDone={() => undefined} onRatingChange={() => undefined}
      ride={makeRide({ id: 41, status: step === 'to_pickup' ? 'accepted' : 'arrived' })}
      step={step}
      pendingAction={pendingAction}
      canCall={false}
      canNavigate={false}
      onCall={noop}
      onNavigate={noop}
      onArrived={noop}
      onStart={noop}
      onComplete={noop}
      onCompleteStop={noop}
      onCancel={handlers.onCancel ?? noop}
      onNoShow={handlers.onNoShow}
    />,
  );
  // TS8: Cancel is the last item of the details, reachable once the sheet is expanded.
  expandTripSheet();
  return view;
};

describe('DriverRidePanel Cancel / No-show during a background read (T-557)', () => {
  it.each(['refresh', 'restore'] as const)('Cancel opens the confirm sheet while a %s runs', (read) => {
    const onCancel = jest.fn();
    const { getByTestId } = renderPickup(read, { onCancel }, 'to_pickup');
    const button = getByTestId('driver-ride-cancel');
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: false }));
    fireEvent.press(button);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it.each(['refresh', 'restore'] as const)('"Passenger didn\'t come" opens the confirm sheet while a %s runs', (read) => {
    const onNoShow = jest.fn();
    const { getByTestId } = renderPickup(read, { onNoShow }, 'at_pickup');
    fireEvent.press(getByTestId('driver-ride-no-show'));
    expect(onNoShow).toHaveBeenCalledTimes(1);
  });

  it.each(['cancel', 'arrived'] as const)('both stay disabled while the driver\'s own %s runs', (own) => {
    const onCancel = jest.fn();
    const onNoShow = jest.fn();
    const toPickup = renderPickup(own, { onCancel }, 'to_pickup');
    fireEvent.press(toPickup.getByTestId('driver-ride-cancel'));
    toPickup.unmount();
    const atPickup = renderPickup(own, { onNoShow }, 'at_pickup');
    fireEvent.press(atPickup.getByTestId('driver-ride-no-show'));
    expect(onCancel).not.toHaveBeenCalled();
    expect(onNoShow).not.toHaveBeenCalled();
  });
});
