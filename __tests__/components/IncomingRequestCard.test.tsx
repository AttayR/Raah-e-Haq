/** T-403/T-404: the driver's incoming request card and its loading / empty / error states. */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { IncomingRequestCard, RideRequestPanel } from '../../src/components/driver/IncomingRequestCard';
import { makePendingRequest } from '../../test-utils/driverRequestFixtures';

const noop = () => undefined;

describe('IncomingRequestCard', () => {
  it('shows the server fields: first name, rating, addresses, distance, ETA, fare and cash', () => {
    const { getByTestId, getByText } = render(
      <IncomingRequestCard
        request={makePendingRequest({ estimatedFare: 412.5, estimatedDistanceKm: 2.36, estimatedPickupMin: 6 })}
        accepting={false}
        disabled={false}
        onAccept={noop}
        onReject={noop}
      />,
    );
    expect(getByTestId('incoming-request-passenger').props.children).toBe('Ayesha');
    expect(getByTestId('incoming-request-rating').props.children).toBe('4.8');
    expect(getByTestId('incoming-request-pickup').props.children).toBe('Fake Pickup Street');
    expect(getByTestId('incoming-request-dropoff').props.children).toBe('Fake Dropoff Road');
    expect(getByTestId('incoming-request-fare').props.children).toBe('PKR 412.50');
    expect(getByTestId('incoming-request-distance').props.children).toBe('2.4 km');
    expect(getByTestId('incoming-request-eta').props.children).toBe('6 min');
    getByText('Cash');
  });

  it('hides numbers the server did not send', () => {
    const { queryByTestId, getByText } = render(
      <IncomingRequestCard
        request={makePendingRequest({
          estimatedFare: null,
          estimatedDistanceKm: null,
          estimatedPickupMin: null,
          passengerFirstName: null,
          passengerRating: null,
        })}
        accepting={false}
        disabled={false}
        onAccept={noop}
        onReject={noop}
      />,
    );
    expect(queryByTestId('incoming-request-fare')).toBeNull();
    expect(queryByTestId('incoming-request-distance')).toBeNull();
    expect(queryByTestId('incoming-request-eta')).toBeNull();
    getByText('Passenger');
    getByText('New rider');
  });

  it('accept and reject pass the ride id; both are disabled while an accept runs', () => {
    const onAccept = jest.fn();
    const onReject = jest.fn();
    const request = makePendingRequest({ id: 41 });
    const { getByTestId, rerender, getByText } = render(
      <IncomingRequestCard request={request} accepting={false} disabled={false} onAccept={onAccept} onReject={onReject} />,
    );
    fireEvent.press(getByTestId('incoming-request-accept'));
    fireEvent.press(getByTestId('incoming-request-reject'));
    expect(onAccept).toHaveBeenCalledWith(41);
    expect(onReject).toHaveBeenCalledWith(41);

    rerender(<IncomingRequestCard request={request} accepting disabled onAccept={onAccept} onReject={onReject} />);
    getByText('Accepting…');
    fireEvent.press(getByTestId('incoming-request-accept'));
    fireEvent.press(getByTestId('incoming-request-reject'));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledTimes(1);
  });
});

describe('RideRequestPanel', () => {
  const props = { acceptingId: null, onAccept: noop, onReject: noop };

  it('renders nothing while idle', () => {
    const { toJSON } = render(<RideRequestPanel {...props} view={{ kind: 'idle' }} onRetry={noop} />);
    expect(toJSON()).toBeNull();
  });

  it('loading, empty and error with retry', () => {
    const onRetry = jest.fn();
    const { getByText, rerender, queryByTestId, getByTestId } = render(
      <RideRequestPanel {...props} view={{ kind: 'loading' }} onRetry={onRetry} />,
    );
    getByText('Looking for ride requests…');
    rerender(<RideRequestPanel {...props} view={{ kind: 'empty' }} onRetry={onRetry} />);
    getByText('No ride requests nearby right now');
    rerender(
      <RideRequestPanel {...props} view={{ kind: 'error', message: 'Could not load ride requests', canRetry: true }} onRetry={onRetry} />,
    );
    getByText('Could not load ride requests');
    fireEvent.press(getByTestId('ride-requests-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    rerender(
      <RideRequestPanel {...props} view={{ kind: 'error', message: 'Go online to see ride requests.', canRetry: false }} onRetry={onRetry} />,
    );
    expect(queryByTestId('ride-requests-retry')).toBeNull();
  });

  it('shows the card for a request', () => {
    const { getByTestId } = render(
      <RideRequestPanel {...props} acceptingId={7} view={{ kind: 'request', request: makePendingRequest({ id: 7 }) }} onRetry={noop} />,
    );
    expect(getByTestId('incoming-request-accept').props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  });
});
