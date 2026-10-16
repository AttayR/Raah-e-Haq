/** T-403/T-404: the driver's incoming request card and its loading / empty / error states. */
import React from 'react';
import { Image } from 'react-native';
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
    expect(getByTestId('incoming-request-fare').props.children).toBe('Rs 412.50');
    expect(getByTestId('incoming-request-distance').props.children).toBe('2.4 km');
    expect(getByTestId('incoming-request-eta').props.children).toBe('6 min');
    getByText('Cash');
  });

  it('T-552: lists the stops, in order, between the pickup and the drop-off', () => {
    const { getAllByText, getByTestId, getByText, queryByTestId } = render(
      <IncomingRequestCard
        request={makePendingRequest({
          stops: [
            { id: 11, address: 'First Fake Stop' },
            { id: 12, address: 'Second Fake Stop' },
          ],
        })}
        accepting={false}
        disabled={false}
        onAccept={noop}
        onReject={noop}
      />,
    );
    expect(getByTestId('incoming-request-stop-1').props.children).toBe('First Fake Stop');
    expect(getByTestId('incoming-request-stop-2').props.children).toBe('Second Fake Stop');
    getByText('Stop 1');
    getByText('Stop 2');
    expect(queryByTestId('incoming-request-stop-3')).toBeNull();
    // Rendered order: pickup, stop 1, stop 2, drop-off.
    expect(getAllByText(/^(Fake|First|Second)/).map((node) => node.props.children)).toEqual([
      'Fake Pickup Street',
      'First Fake Stop',
      'Second Fake Stop',
      'Fake Dropoff Road',
    ]);
  });

  it('T-552: 5 long stops stay compact: two stops, "+3 more stops", header, fare and Accept kept, height bounded', () => {
    const long = (n: number) => ({ id: 30 + n, address: `Fake stop ${n}, a very long address that would wrap over several lines on a phone` });
    const { getByTestId, queryByTestId, getByText } = render(
      <IncomingRequestCard
        request={makePendingRequest({ estimatedFare: 350, stops: [1, 2, 3, 4, 5].map(long) })}
        accepting={false}
        disabled={false}
        onAccept={noop}
        onReject={noop}
        maxHeight={420}
      />,
    );
    getByTestId('incoming-request-reject');
    getByText('New Ride Request');
    getByTestId('incoming-request-fare');
    getByTestId('incoming-request-accept');
    expect(getByTestId('incoming-request-stop-1').props.numberOfLines).toBe(1);
    expect(getByTestId('incoming-request-stop-2').props.numberOfLines).toBe(1);
    expect(queryByTestId('incoming-request-stop-3')).toBeNull();
    expect(getByTestId('incoming-request-more-stops').props.children).toBe('+3 more stops');
    getByText('Stops 3–5');
    // Pickup and drop-off keep two lines.
    expect(getByTestId('incoming-request-pickup').props.numberOfLines).toBe(2);
    // The card is bounded and only the addresses scroll.
    expect(getByTestId('incoming-request-card').props.style).toEqual(expect.arrayContaining([{ maxHeight: 420 }]));
    expect(getByTestId('incoming-request-addresses')).toBeTruthy();
  });

  it('T-556: exactly 3 stops lists the third address instead of "+1 more stop"', () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <IncomingRequestCard
        request={makePendingRequest({
          stops: [1, 2, 3].map(n => ({ id: 40 + n, address: `Fake stop ${n}` })),
        })}
        accepting={false}
        disabled={false}
        onAccept={noop}
        onReject={noop}
      />,
    );
    expect(getByTestId('incoming-request-stop-3').props.children).toBe('Fake stop 3');
    expect(getByTestId('incoming-request-stop-3').props.numberOfLines).toBe(1);
    getByText('Stop 3');
    expect(queryByTestId('incoming-request-more-stops')).toBeNull();
  });

  it('T-556: 4 stops collapse the two hidden ones into "+2 more stops"', () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <IncomingRequestCard
        request={makePendingRequest({
          stops: [1, 2, 3, 4].map(n => ({ id: 50 + n, address: `Fake stop ${n}` })),
        })}
        accepting={false}
        disabled={false}
        onAccept={noop}
        onReject={noop}
      />,
    );
    expect(queryByTestId('incoming-request-stop-3')).toBeNull();
    expect(getByTestId('incoming-request-more-stops').props.children).toBe('+2 more stops');
    getByText('Stops 3–4');
  });

  it("shows the passenger's photo from the request card (T-504)", () => {
    const { UNSAFE_getAllByType } = render(
      <IncomingRequestCard
        request={makePendingRequest({ passengerPhotoUrl: 'https://cdn.test/ayesha.jpg' })}
        accepting={false}
        disabled={false}
        onAccept={noop}
        onReject={noop}
      />,
    );
    const sources = UNSAFE_getAllByType(Image).map((image) => (image.props.source as { uri?: string }).uri);
    expect(sources).toContain('https://cdn.test/ayesha.jpg');
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
    const { getByTestId, rerender, getByLabelText } = render(
      <IncomingRequestCard request={request} accepting={false} disabled={false} onAccept={onAccept} onReject={onReject} />,
    );
    fireEvent.press(getByTestId('incoming-request-accept'));
    fireEvent.press(getByTestId('incoming-request-reject'));
    expect(onAccept).toHaveBeenCalledWith(41);
    expect(onReject).toHaveBeenCalledWith(41);

    rerender(<IncomingRequestCard request={request} accepting disabled onAccept={onAccept} onReject={onReject} />);
    // UI-R5: the kit Button keeps its width and shows a spinner; the label stays the accessible name.
    getByLabelText('Accepting…');
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
