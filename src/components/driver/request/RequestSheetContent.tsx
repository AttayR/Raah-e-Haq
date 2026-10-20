import React, { memo, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import type { PendingRideRequest } from '../../../features/driver-requests/api';
import { DRIVER_REQUESTS_COPY as COPY } from '../../../features/driver-requests/copy';
import { formatRate } from '../../../features/fare/format';
import { ParcelRequestInfo } from '../../../features/parcel/components/ParcelRequestInfo';
import { vehicleLabel } from '../../../features/ride-history/copy';
import { t } from '../../../i18n';
import { componentTokens, space } from '../../../theme';
import { formatDistance, formatDuration, formatMoney } from '../../../utils/format';
import {
  AcBadge,
  AddressPair,
  AppText,
  Avatar,
  Badge,
  Icon,
  MetricStrip,
  PersonCard,
  ScrollHairline,
  vehicleIconName,
  type MetricCell,
} from '../../ui';

/** T-552: stops listed on the sheet (one line each); the rest are summed up in one row. */
export const REQUEST_CARD_MAX_STOPS = 2;

/** The payment as the badge says it: "Cash", other methods title-cased as shipped. */
export const paymentLabel = (method: string | null): string | null => {
  if (!method) return null;
  if (method === 'cash') return COPY.cash;
  return method.charAt(0).toUpperCase() + method.slice(1);
};

/**
 * R2 #4: "You keep Rs 362 · 20% commission" from the server's BE-84 split, or null when the feed
 * sent no `driver_net` (never computed on the device).
 */
export const shareLine = (request: Pick<PendingRideRequest, 'driverNet' | 'commissionRate'>): string | null => {
  if (request.driverNet === null) return null;
  const net = formatMoney(request.driverNet);
  return request.commissionRate !== null
    ? COPY.youKeep(net, `${formatRate(request.commissionRate)}%`)
    : COPY.youKeepNoRate(net);
};

/** R2 #6: to pickup · away · trip, only the values the feed sent. */
export const requestMetrics = (request: PendingRideRequest): MetricCell[] => {
  const cells: MetricCell[] = [];
  if (request.estimatedPickupMin !== null) {
    const value = formatDuration(request.estimatedPickupMin);
    cells.push({
      key: 'pickup',
      value,
      label: COPY.metricToPickup,
      accessibilityLabel: COPY.metricToPickupA11y(value),
      testID: 'incoming-request-eta',
    });
  }
  if (request.estimatedDistanceKm !== null) {
    const value = formatDistance(request.estimatedDistanceKm);
    cells.push({
      key: 'away',
      value,
      label: COPY.metricAway,
      accessibilityLabel: COPY.metricAwayA11y(value),
      testID: 'incoming-request-distance',
    });
  }
  const trip =
    request.tripDistanceKm !== null
      ? formatDistance(request.tripDistanceKm)
      : request.tripDurationMin !== null
      ? formatDuration(request.tripDurationMin)
      : null;
  if (trip) {
    cells.push({
      key: 'trip',
      value: trip,
      label: COPY.metricTrip,
      accessibilityLabel: COPY.metricTripA11y(trip),
      testID: 'incoming-request-trip',
    });
  }
  return cells;
};

/** T-552 / T-556: the first stops on one line each, then one "+N more stops" row. */
const useStops = (stops: PendingRideRequest['stops']) =>
  useMemo(() => {
    const listed = stops.length <= REQUEST_CARD_MAX_STOPS + 1 ? stops.length : REQUEST_CARD_MAX_STOPS;
    const shown = stops.slice(0, listed).map((stop, index) => ({
      address: stop.address,
      key: stop.id ?? index,
      testID: `incoming-request-stop-${index + 1}`,
    }));
    const more = stops.length - shown.length;
    if (more <= 0) return shown;
    return [
      ...shown,
      {
        address: COPY.moreStops(more),
        key: 'more',
        label: COPY.moreStopsLabel(shown.length + 1, stops.length),
        testID: 'incoming-request-more-stops',
      },
    ];
  }, [stops]);

type Props = {
  request: PendingRideRequest;
  /** Requests waiting behind this one ("+2 more"). */
  moreCount: number;
  /** Window height under 700 (iPhone SE): the R2 compact layout. */
  compact: boolean;
};

/**
 * The request sheet's content (UI-R11, driver-incoming-request R2), fare first: header row
 * (tier / AC / Parcel badge, the BE-83 offer badge, "+N more"), the fare in `numericXL` with the
 * payment badge, "You keep …" (BE-84) and the app-fare comparison of an offer, the metric strip,
 * the route (T-552 stops; the only block that scrolls at the 70 % cap, with a hairline while
 * scrolled) and the rider row (no contact before accepting); the parcel block under it.
 * Compact (SE): `numericL` fare, 1-line addresses, the rider in the header row, the comparison
 * joined to the share line. Only fields the server sent are shown. Memoised on the request.
 */
function RequestSheetContentBase({ request, moreCount, compact }: Props) {
  const stops = useStops(request.stops);
  const scrollY = useSharedValue(0);
  const payment = paymentLabel(request.paymentMethod);
  const share = shareLine(request);
  const appFare =
    request.isOffer && request.serverFare !== null
      ? t('driverFare.offerVsApp', { amount: formatMoney(request.serverFare) })
      : null;
  const metrics = useMemo(() => requestMetrics(request), [request]);
  const tier = request.parcel ? null : request.vehicleType;
  const riderName = request.passengerFirstName || COPY.passengerFallback;
  const passengersSuffix =
    request.passengerCount !== null && request.passengerCount > 1 ? COPY.passengers(request.passengerCount) : null;

  return (
    <View style={styles.wrap} testID="incoming-request-card">
      <View style={styles.header}>
        <View style={styles.badges}>
          {request.parcel ? (
            <Badge label={t('parcel.badge')} tone="info" icon="parcel" testID="incoming-request-parcel-badge" />
          ) : tier === 'car_ac' ? (
            // BE-86: an AC ride (only drivers with an AC-approved car are offered it).
            <AcBadge testID="incoming-request-ac" />
          ) : tier ? (
            <Badge
              label={vehicleLabel(tier) ?? tier}
              tone="neutral"
              icon={vehicleIconName(tier)}
              testID="incoming-request-tier"
            />
          ) : null}
          {request.isOffer ? (
            // BE-83: the fare is the passenger's offer.
            <Badge label={t('driverFare.offerBadge')} tone="info" icon="fareOffer" testID="incoming-request-offer" />
          ) : null}
        </View>
        {compact ? (
          <View style={styles.compactRider} testID="incoming-request-rider-compact">
            <Avatar name={riderName} uri={request.passengerPhotoUrl} size={32} />
            <AppText variant="label" numberOfLines={1} style={styles.shrink} testID="incoming-request-passenger">
              {riderName}
            </AppText>
            <Icon name="star" size={16} color="ratingStar" />
            <AppText variant="numericSmall" testID="incoming-request-rating">
              {request.passengerRating !== null ? request.passengerRating.toFixed(1) : COPY.noRating}
            </AppText>
          </View>
        ) : null}
        {moreCount > 0 ? <Badge label={COPY.more(moreCount)} tone="neutral" testID="incoming-request-more" /> : null}
      </View>

      <View style={styles.fareRow}>
        {request.estimatedFare !== null ? (
          <AppText
            variant={compact ? 'numericL' : 'numericXL'}
            accessibilityRole="header"
            testID="incoming-request-fare"
          >
            {formatMoney(request.estimatedFare)}
          </AppText>
        ) : null}
        {payment ? <Badge label={payment} tone="neutral" icon="cash" testID="incoming-request-payment" /> : null}
      </View>

      {share || (compact && appFare) ? (
        <AppText variant="bodySmall" color="textSecondary" style={styles.share} testID="incoming-request-share">
          {[share, compact ? appFare : null].filter(Boolean).join(' · ')}
        </AppText>
      ) : null}
      {appFare && !compact ? (
        <AppText variant="caption" color="textSecondary" style={styles.appFare} testID="incoming-request-server-fare">
          {appFare}
        </AppText>
      ) : null}

      <View style={styles.block}>
        <MetricStrip cells={metrics} testID="incoming-request-metrics" />
      </View>

      <View style={styles.route}>
        <ScrollHairline scrollY={scrollY} />
        <ScrollView
          bounces={false}
          scrollEventThrottle={16}
          onScroll={e => {
            scrollY.value = e.nativeEvent.contentOffset.y;
          }}
          testID="incoming-request-addresses"
        >
          <AddressPair
            size="lg"
            labels
            numberOfLines={compact ? 1 : 2}
            stopNumberOfLines={1}
            pickup={request.pickupAddress}
            stops={stops}
            dropoff={request.dropoffAddress}
            pickupTestID="incoming-request-pickup"
            dropoffTestID="incoming-request-dropoff"
          />
        </ScrollView>
      </View>

      {compact ? null : (
        <View style={styles.block}>
          <PersonCard
            variant="plain"
            size="compact"
            name={request.passengerFirstName}
            photoUri={request.passengerPhotoUrl}
            fallbackName={COPY.passengerFallback}
            rating={request.passengerRating}
            newRatingLabel={COPY.noRating}
            ratingSuffix={passengersSuffix}
            nameTestID="incoming-request-passenger"
            ratingTestID="incoming-request-rating"
          />
        </View>
      )}
      {/* BE-88: what the parcel is and that the sender pays cash at the pickup. */}
      {request.parcel ? (
        <View style={styles.parcel}>
          <ParcelRequestInfo parcel={request.parcel} badge={false} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * R9: every 5 s poll maps the same request into a new object; the content draws again only when
 * what it shows changed (a small plain object, compared by value).
 */
const sameProps = (a: Props, b: Props): boolean =>
  a.moreCount === b.moreCount &&
  a.compact === b.compact &&
  (a.request === b.request || JSON.stringify(a.request) === JSON.stringify(b.request));

export const RequestSheetContent = memo(RequestSheetContentBase, sameProps);

const styles = StyleSheet.create({
  // Only the route gives way (scrolls) when the sheet hits its cap.
  wrap: { flexShrink: 1 },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[2],
    marginBottom: space[3],
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[2],
    flexGrow: 1,
    flexShrink: 1,
  },
  compactRider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    flexShrink: 1,
  },
  shrink: { flexShrink: 1 },
  fareRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  share: { marginTop: space[1] },
  appFare: { marginTop: componentTokens.requestSheet.lineGap },
  block: { marginTop: space[4] },
  route: { marginTop: space[4], flexShrink: 1 },
  parcel: { marginTop: space[3] },
});
