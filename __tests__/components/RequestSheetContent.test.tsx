/**
 * T-403/T-404 → UI-R11 (driver-incoming-request § Request sheet v2): the request sheet's content
 * (fare first, "You keep" from BE-84, metric strip, route with the T-552 stops, rider row), the
 * compact SE layout, the Decline + Accept footer with the countdown ring and the 409 taken / gone
 * states.
 */
import React from 'react';
import { Image } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import {
  RequestSheetContent,
  requestMetrics,
  shareLine,
} from '../../src/components/driver/request/RequestSheetContent';
import { RequestFooter, RequestGoneContent } from '../../src/components/driver/request/RequestParts';
import { makePendingRequest } from '../../test-utils/driverRequestFixtures';
import type { PendingRideRequest } from '../../src/features/driver-requests/api';

const noop = () => undefined;

const renderContent = (overrides: Partial<PendingRideRequest> = {}, { compact = false, moreCount = 0 } = {}) =>
  render(<RequestSheetContent request={makePendingRequest(overrides)} moreCount={moreCount} compact={compact} />);

describe('RequestSheetContent', () => {
  it('shows the server fields: fare, Cash, first name, rating, addresses, to pickup and away', () => {
    const { getByTestId, getByText, queryByText } = renderContent({
      estimatedFare: 412.5,
      estimatedDistanceKm: 2.36,
      estimatedPickupMin: 6,
    });
    expect(getByTestId('incoming-request-fare').props.children).toBe('Rs\u00A0412.50');
    getByText('Cash');
    expect(getByTestId('incoming-request-passenger').props.children).toBe('Ayesha');
    expect(getByTestId('incoming-request-rating').props.children).toBe('4.8');
    expect(getByTestId('incoming-request-pickup').props.children).toBe('Fake Pickup Street');
    expect(getByTestId('incoming-request-dropoff').props.children).toBe('Fake Dropoff Road');
    expect(getByTestId('incoming-request-eta').props.children).toBe('6 min');
    expect(getByTestId('incoming-request-distance').props.children).toBe('2.4 km');
    expect(getByTestId('incoming-request-eta-cell').props.accessibilityLabel).toBe('6 min to pickup');
    // R0 #2: no "New Ride Request" title; the tier badge leads.
    expect(queryByText('New Ride Request')).toBeNull();
    getByTestId('incoming-request-tier');
  });

  it('R2 #4: "You keep" from the server split; no rate → net only; no driver_net → hidden', () => {
    expect(shareLine({ driverNet: 362, commissionRate: 20 })).toBe('You keep Rs\u00A0362 · 20% commission');
    expect(shareLine({ driverNet: 362, commissionRate: 12.5 })).toBe('You keep Rs\u00A0362 · 12.5% commission');
    expect(shareLine({ driverNet: 362, commissionRate: null })).toBe('You keep Rs\u00A0362');
    expect(shareLine({ driverNet: null, commissionRate: 20 })).toBeNull();
    const { getByTestId, queryByTestId, rerender } = renderContent({
      driverNet: 362,
      commissionRate: 20,
    });
    expect(getByTestId('incoming-request-share').props.children).toBe('You keep Rs\u00A0362 · 20% commission');
    rerender(<RequestSheetContent request={makePendingRequest()} moreCount={0} compact={false} />);
    expect(queryByTestId('incoming-request-share')).toBeNull();
  });

  it('R2 #6: the strip shows only the values sent (trip distance, else trip minutes) and hides when none', () => {
    const cells = (o: Partial<PendingRideRequest>) => requestMetrics(makePendingRequest(o)).map(c => [c.key, c.value]);
    expect(cells({ tripDistanceKm: 7.84 })).toEqual([
      ['pickup', '3 min'],
      ['away', '1.2 km'],
      ['trip', '7.8 km'],
    ]);
    expect(cells({ estimatedPickupMin: null, tripDurationMin: 25 })).toEqual([
      ['away', '1.2 km'],
      ['trip', '25 min'],
    ]);
    const { queryByTestId } = renderContent({
      estimatedPickupMin: null,
      estimatedDistanceKm: null,
    });
    expect(queryByTestId('incoming-request-metrics')).toBeNull();
  });

  it('BE-83 offer: the offer badge and the app fare; "+N more" when more requests wait', () => {
    const { getByTestId, getByText } = renderContent(
      { isOffer: true, serverFare: 152, estimatedFare: 140 },
      { moreCount: 2 },
    );
    getByTestId('incoming-request-offer');
    getByText('Passenger offer');
    expect(getByTestId('incoming-request-server-fare').props.children).toBe('App fare Rs\u00A0152');
    expect(getByTestId('incoming-request-more').props).toBeTruthy();
    getByText('+2 more');
  });

  it('passenger count after the rating when more than one', () => {
    const { getByText } = renderContent({ passengerCount: 3 });
    getByText(' · 3 passengers');
  });

  it('T-552: lists the stops, in order, between the pickup and the drop-off', () => {
    const { getAllByText, getByTestId, getByText, queryByTestId } = renderContent({
      stops: [
        { id: 11, address: 'First Fake Stop', point: null },
        { id: 12, address: 'Second Fake Stop', point: null },
      ],
    });
    expect(getByTestId('incoming-request-stop-1').props.children).toBe('First Fake Stop');
    expect(getByTestId('incoming-request-stop-2').props.children).toBe('Second Fake Stop');
    getByText('Stop 1');
    getByText('Stop 2');
    expect(queryByTestId('incoming-request-stop-3')).toBeNull();
    expect(getAllByText(/^(Fake|First|Second)/).map(node => node.props.children)).toEqual([
      'Fake Pickup Street',
      'First Fake Stop',
      'Second Fake Stop',
      'Fake Dropoff Road',
    ]);
  });

  it('T-552: 5 long stops stay compact: two stops, "+3 more stops"; only the route scrolls', () => {
    const long = (n: number) => ({
      id: 30 + n,
      address: `Fake stop ${n}, a very long address that would wrap over several lines on a phone`,
      point: null,
    });
    const { getByTestId, queryByTestId, getByText } = renderContent({
      estimatedFare: 350,
      stops: [1, 2, 3, 4, 5].map(long),
    });
    getByTestId('incoming-request-fare');
    expect(getByTestId('incoming-request-stop-1').props.numberOfLines).toBe(1);
    expect(queryByTestId('incoming-request-stop-3')).toBeNull();
    expect(getByTestId('incoming-request-more-stops').props.children).toBe('+3 more stops');
    getByText('Stops 3–5');
    expect(getByTestId('incoming-request-pickup').props.numberOfLines).toBe(2);
    expect(getByTestId('incoming-request-addresses')).toBeTruthy();
  });

  it('T-556: exactly 3 stops lists the third; 4 collapse into "+2 more stops"', () => {
    const three = renderContent({
      stops: [1, 2, 3].map(n => ({ id: 40 + n, address: `Fake stop ${n}`, point: null })),
    });
    expect(three.getByTestId('incoming-request-stop-3').props.children).toBe('Fake stop 3');
    three.getByText('Stop 3');
    three.unmount();
    const four = renderContent({
      stops: [1, 2, 3, 4].map(n => ({ id: 50 + n, address: `Fake stop ${n}`, point: null })),
    });
    expect(four.getByTestId('incoming-request-more-stops').props.children).toBe('+2 more stops');
    four.getByText('Stops 3–4');
  });

  it("shows the passenger's photo (T-504)", () => {
    const { UNSAFE_getAllByType } = renderContent({
      passengerPhotoUrl: 'https://cdn.test/ayesha.jpg',
    });
    const sources = UNSAFE_getAllByType(Image).map(image => (image.props.source as { uri?: string }).uri);
    expect(sources).toContain('https://cdn.test/ayesha.jpg');
  });

  it('hides numbers the server did not send', () => {
    const { queryByTestId, getByText } = renderContent({
      estimatedFare: null,
      estimatedDistanceKm: null,
      estimatedPickupMin: null,
      passengerFirstName: null,
      passengerRating: null,
    });
    expect(queryByTestId('incoming-request-fare')).toBeNull();
    expect(queryByTestId('incoming-request-distance')).toBeNull();
    expect(queryByTestId('incoming-request-eta')).toBeNull();
    getByText('Passenger');
    getByText('New rider');
  });

  it('R2 compact (SE): rider in the header row, one-line addresses, offer comparison on the share line', () => {
    const { getByTestId } = renderContent(
      { driverNet: 300, commissionRate: 20, isOffer: true, serverFare: 152 },
      { compact: true },
    );
    getByTestId('incoming-request-rider-compact');
    expect(getByTestId('incoming-request-passenger').props.children).toBe('Ayesha');
    expect(getByTestId('incoming-request-pickup').props.numberOfLines).toBe(1);
    expect(getByTestId('incoming-request-share').props.children).toBe(
      'You keep Rs\u00A0300 · 20% commission · App fare Rs\u00A0152',
    );
  });
});

describe('RequestFooter', () => {
  it('Decline and Accept pass the ride id', () => {
    const onAccept = jest.fn();
    const onDecline = jest.fn();
    const { getByTestId, getByText } = render(
      <RequestFooter
        rideId={41}
        onAccept={onAccept}
        onDecline={onDecline}
        accepting={false}
        disabled={false}
        countdown={null}
        announceSeconds={null}
      />,
    );
    getByText('Decline');
    fireEvent.press(getByTestId('incoming-request-accept'));
    fireEvent.press(getByTestId('incoming-request-reject'));
    expect(onAccept).toHaveBeenCalledWith(41);
    expect(onDecline).toHaveBeenCalledWith(41);
    expect(getByTestId('incoming-request-reject').props.accessibilityLabel).toBe('Decline this ride request');
  });

  it('draws the countdown ring with the seconds left, and says them at 10 s / 5 s only', () => {
    const startedAt = Date.now();
    const { getByTestId, rerender } = render(
      <RequestFooter
        rideId={41}
        onAccept={noop}
        onDecline={noop}
        accepting={false}
        disabled={false}
        countdown={{ startedAt, durationMs: 20_000 }}
        announceSeconds={null}
      />,
    );
    expect(
      getByTestId('incoming-request-accept-countdown-seconds', {
        includeHiddenElements: true,
      }).props.children,
    ).toBe('20');
    expect(getByTestId('incoming-request-accept').props.accessibilityLabel).toBe('Accept');
    rerender(
      <RequestFooter
        rideId={41}
        onAccept={noop}
        onDecline={noop}
        accepting={false}
        disabled={false}
        countdown={{ startedAt, durationMs: 20_000 }}
        announceSeconds={5}
      />,
    );
    expect(getByTestId('incoming-request-accept').props.accessibilityLabel).toBe('Accept ride, 5 seconds left');
  });

  it('accepting: spinner instead of the ring, Decline disabled, a second press sends nothing', () => {
    const onAccept = jest.fn();
    const onDecline = jest.fn();
    const { getByTestId, queryByTestId, getByLabelText } = render(
      <RequestFooter
        rideId={41}
        onAccept={onAccept}
        onDecline={onDecline}
        accepting
        disabled
        countdown={{ startedAt: Date.now(), durationMs: 20_000, paused: true }}
        announceSeconds={null}
      />,
    );
    getByLabelText('Accepting…');
    expect(
      queryByTestId('incoming-request-accept-countdown', {
        includeHiddenElements: true,
      }),
    ).toBeNull();
    expect(getByTestId('incoming-request-accept').props.accessibilityState).toMatchObject({
      disabled: true,
      busy: true,
    });
    fireEvent.press(getByTestId('incoming-request-accept'));
    fireEvent.press(getByTestId('incoming-request-reject'));
    expect(onAccept).not.toHaveBeenCalled();
    expect(onDecline).not.toHaveBeenCalled();
  });
});

describe('RequestGoneContent (R5)', () => {
  it('taken and no longer available', () => {
    const { getByText, rerender } = render(<RequestGoneContent kind="taken" />);
    getByText('Another driver took this ride');
    rerender(<RequestGoneContent kind="gone" />);
    getByText('This ride is no longer available');
  });
});
