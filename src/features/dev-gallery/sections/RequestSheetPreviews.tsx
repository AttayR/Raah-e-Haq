import React, { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { RequestSheet } from '../../../components/driver/request/RequestSheet';
import { RequestSheetContent } from '../../../components/driver/request/RequestSheetContent';
import { RequestFooter, RequestGoneContent } from '../../../components/driver/request/RequestParts';
import type { PendingRideRequest } from '../../driver-requests/api';
import { componentTokens } from '../../../theme';
import { REQUEST_DECISION_SECONDS } from '../../driver-requests/countdown';

/**
 * Debug kit gallery (UI-R11 R11): the incoming request sheet over the map background, built from
 * the product components with API-shaped GET /rides/pending fixtures (fake local data), for
 * light/dark, SE and 1.3× screenshots without a live request. Product screens never import this.
 */
const noop = () => {};

const base: PendingRideRequest = {
  id: 9101,
  pickupAddress: 'Liberty Market, Gulberg III, Lahore',
  dropoffAddress: 'Emporium Mall, Abdul Haque Road, Johar Town, Lahore',
  pickup: null,
  dropoff: null,
  passengerFirstName: 'Ayesha',
  passengerPhotoUrl: null,
  passengerRating: 4.8,
  estimatedDistanceKm: 1.2,
  estimatedPickupMin: 3,
  estimatedFare: 452,
  paymentMethod: 'cash',
  vehicleType: 'car',
  expiresAt: null,
  isOffer: false,
  serverFare: null,
  stops: [],
  parcel: null,
  driverNet: 362,
  commissionRate: 20,
  commissionAmount: 90,
  passengerCount: 1,
  tripDistanceKm: 9.4,
  tripDurationMin: 28,
  offerSeconds: null,
};

const FIXTURES: Record<string, Partial<PendingRideRequest>> = {
  plain: {},
  stops: {
    stops: [
      { id: 1, address: 'Main Boulevard, Gulberg II, Lahore', point: null },
      { id: 2, address: 'Model Town Link Road, Lahore', point: null },
      { id: 3, address: 'Faisal Town, Lahore', point: null },
    ],
  },
  offer: { isOffer: true, estimatedFare: 420, serverFare: 452, driverNet: 336 },
  parcel: {
    vehicleType: 'parcel',
    parcel: { categoryLabel: 'Documents and papers', sizeLabel: 'Small (fits in a bag)', maxWeightKg: 2 },
  },
  ac: { vehicleType: 'car_ac', estimatedFare: 610, driverNet: 488 },
};

export function RequestSheetPreview({
  fixture = 'plain',
  secondsLeft = REQUEST_DECISION_SECONDS,
  state = 'offer',
}: {
  fixture?: keyof typeof FIXTURES;
  secondsLeft?: number;
  state?: 'offer' | 'taken';
}) {
  const { theme } = useAppTheme();
  const { height } = useWindowDimensions();
  const durationMs = REQUEST_DECISION_SECONDS * 1000;
  const [startedAt] = useState(() => Date.now() - (durationMs - secondsLeft * 1000));
  const request = { ...base, ...FIXTURES[fixture] };
  return (
    <View style={[styles.fill, { backgroundColor: theme.mapBackground }]}>
      <RequestSheet
        visible
        contentKey={state}
        footer={
          state === 'offer' ? (
            <RequestFooter
              rideId={request.id}
              onAccept={noop}
              onDecline={noop}
              accepting={false}
              disabled={false}
              countdown={{ startedAt, durationMs, paused: true }}
              announceSeconds={null}
            />
          ) : null
        }
      >
        {state === 'offer' ? (
          <RequestSheetContent
            request={request}
            moreCount={fixture === 'stops' ? 2 : 0}
            compact={height < componentTokens.requestSheet.compactWindowHeight}
          />
        ) : (
          <RequestGoneContent kind="taken" />
        )}
      </RequestSheet>
    </View>
  );
}

export const REQUEST_SHEET_PREVIEWS: Array<[string, () => React.ReactElement]> = [
  ['screen-request', () => <RequestSheetPreview />],
  ['screen-request-stops', () => <RequestSheetPreview fixture="stops" />],
  ['screen-request-offer', () => <RequestSheetPreview fixture="offer" />],
  ['screen-request-parcel', () => <RequestSheetPreview fixture="parcel" />],
  ['screen-request-ac', () => <RequestSheetPreview fixture="ac" />],
  ['screen-request-ring-10', () => <RequestSheetPreview secondsLeft={10} />],
  ['screen-request-ring-3', () => <RequestSheetPreview secondsLeft={3} />],
  ['screen-request-taken', () => <RequestSheetPreview state="taken" />],
];

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
