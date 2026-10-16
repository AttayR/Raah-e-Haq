/**
 * T-556 (QA 2026-10-16: one "Stop done" tap ignored): the ride screen re-reads the ride every
 * ~8 s, and while that read ran the panel disabled its step button, so a tap in that window did
 * nothing. A background read no longer disables the step (the slice lets the step take over);
 * the driver's own step in flight still shows loading and takes no second tap.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { DriverRidePanel } from '../../src/components/driver/DriverRidePanel';
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
    <DriverRidePanel
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
