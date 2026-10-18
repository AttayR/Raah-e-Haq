/**
 * T-569: on a parcel ride the person on the driver's ride panel is the sender, not a passenger.
 * Call / Message accessibility labels, the fallback name, the no-show button and the cancel /
 * no-show sheet say "sender"; a normal ride keeps "passenger".
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DriverRidePanel } from '../../src/components/driver/DriverRidePanel';
import { CancelReasonSheet } from '../../src/components/driver/CancelReasonSheet';
import { makeRide } from '../../test-utils/rideFixtures';

const noop = () => undefined;

const renderPanel = (vehicleType: string) =>
  render(
    <DriverRidePanel
      ride={makeRide({ id: 41, status: 'arrived', vehicle_type: vehicleType, passenger: undefined })}
      step="at_pickup"
      pendingAction={null}
      canCall
      canNavigate={false}
      onCall={noop}
      onMessage={noop}
      onNavigate={noop}
      onArrived={noop}
      onStart={noop}
      onComplete={noop}
      onCompleteStop={noop}
      onCancel={noop}
      onNoShow={noop}
    />,
  );

describe('driver ride panel wording on a parcel ride (T-569)', () => {
  it('Call / Message, the fallback name, the title and the no-show button say "sender"', () => {
    renderPanel('parcel');
    expect(screen.getByTestId('driver-ride-call').props.accessibilityLabel).toBe('Call the sender');
    expect(screen.getByTestId('driver-ride-message').props.accessibilityLabel).toBe('Message the sender');
    expect(screen.getByText('Sender')).toBeTruthy();
    expect(screen.queryByText('Passenger')).toBeNull();
    expect(screen.getByTestId('driver-ride-title').props.children).toBe('Waiting for the sender');
    expect(screen.getByTestId('driver-ride-no-show').props.accessibilityLabel).toBe("Sender didn't come");
  });

  it('a normal ride keeps "passenger"', () => {
    renderPanel('car');
    expect(screen.getByTestId('driver-ride-call').props.accessibilityLabel).toBe('Call the passenger');
    expect(screen.getByTestId('driver-ride-message').props.accessibilityLabel).toBe('Message the passenger');
    expect(screen.getByText('Passenger')).toBeTruthy();
    expect(screen.getByTestId('driver-ride-title').props.children).toBe('Waiting for the passenger');
    expect(screen.getByTestId('driver-ride-no-show').props.accessibilityLabel).toBe("Passenger didn't come");
  });
});

describe('cancel / no-show sheet on a parcel ride (T-569)', () => {
  it('"Sender didn\'t come": sender title, hint, fee and note', () => {
    const onSubmit = jest.fn();
    render(<CancelReasonSheet visible parcel mode="no_show" noShowFee={50} submitting={false} onSubmit={onSubmit} onClose={jest.fn()} />);
    screen.getByText("Sender didn't come?");
    screen.getByText('You waited at the pickup, so no strike is recorded. The sender sees this note.');
    screen.getByText('The sender is charged the Rs 50 no-show fee. Your share shows in your wallet once it is credited.');
    fireEvent.press(screen.getByTestId('cancel-reason-submit'));
    expect(onSubmit).toHaveBeenCalledWith('The sender did not come to the pickup.');
  });

  it('a cancel says the sender sees the reason; the pointer names "Sender didn\'t come"', () => {
    render(<CancelReasonSheet visible parcel noShowAvailable submitting={false} onSubmit={jest.fn()} onClose={jest.fn()} />);
    screen.getByText('The sender will see this reason.');
    screen.getByText('You waited long enough at the pickup, so this cancel records no strike. Use "Sender didn\'t come" next time.');
    expect(screen.getByTestId('cancel-reason-input').props.placeholder).toBe('For example: the sender is not at the pickup');
  });
});
