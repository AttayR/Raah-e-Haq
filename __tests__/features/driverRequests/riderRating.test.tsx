/**
 * T-414: the driver saw "★ 0.0" for every passenger. The server sends `passenger.rating`
 * (users.rating), which defaults to 0.00 until ratings exist (BE-07). Zero means "not rated
 * yet": the request card and the ride panel say "New rider" instead.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { riderRating } from '../../../src/features/driver-requests/rating';
import { toPendingRideRequest } from '../../../src/features/driver-requests/api';
import { IncomingRequestCard } from '../../../src/components/driver/IncomingRequestCard';
import { DriverRidePanel } from '../../../src/components/driver/DriverRidePanel';
import { pendingRide } from '../../../test-utils/driverRequestFixtures';
import { makeRide } from '../../../test-utils/rideFixtures';
import type { RideResource } from '../../../src/services/rideService';

const noop = () => undefined;

describe('riderRating', () => {
  it('keeps a real 1–5 star rating, decimal strings included', () => {
    expect(riderRating(4.8)).toBe(4.8);
    expect(riderRating('4.50')).toBe(4.5);
    expect(riderRating(1)).toBe(1);
    expect(riderRating(5)).toBe(5);
  });

  it('treats zero (the unrated default), missing and out-of-range values as no rating', () => {
    expect(riderRating(0)).toBeNull();
    expect(riderRating('0.00')).toBeNull();
    expect(riderRating(null)).toBeNull();
    expect(riderRating(undefined)).toBeNull();
    expect(riderRating('')).toBeNull();
    expect(riderRating('abc')).toBeNull();
    expect(riderRating(-1)).toBeNull();
    expect(riderRating(7)).toBeNull();
    expect(riderRating(Number.NaN)).toBeNull();
  });
});

describe('driver request card (GET /rides/pending)', () => {
  it.each([0, '0.00'])('an unrated passenger (%p) maps to no rating and the card says "New rider"', (rating) => {
    const request = toPendingRideRequest(pendingRide({ passenger: { id: 3, name: 'Ayesha', rating } }), 10);
    expect(request?.passengerRating).toBeNull();
    const { queryByTestId, getByText, queryByText } = render(
      <IncomingRequestCard request={request!} accepting={false} disabled={false} onAccept={noop} onReject={noop} />,
    );
    expect(queryByTestId('incoming-request-rating')).toBeNull();
    getByText('New rider');
    expect(queryByText('0.0')).toBeNull();
  });
});

describe('driver ride panel', () => {
  const renderPanel = (passenger: RideResource['passenger']) =>
    render(
      <DriverRidePanel
        ride={makeRide({ id: 41, status: 'accepted', passenger })}
        step="to_pickup"
        pendingAction={null}
        canCall={false}
        canNavigate={false}
        onCall={noop}
        onNavigate={noop}
        onArrived={noop}
        onStart={noop}
        onComplete={noop}
        onCompleteStop={noop}
        onCancel={noop}
      />,
    );

  it('says "New rider" for an unrated passenger, not 0.0', () => {
    const { getByText, queryByText } = renderPanel({ id: 9, name: 'Ayesha', rating: 0 });
    getByText('New rider');
    expect(queryByText('0.0')).toBeNull();
  });

  it('shows a real rating with one decimal', () => {
    const { getByText, queryByText } = renderPanel({ id: 9, name: 'Ayesha', rating: 4.8 });
    getByText('4.8');
    expect(queryByText('New rider')).toBeNull();
  });
});
