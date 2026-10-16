import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import type { AppTheme } from '../../theme';
import type { PendingRideRequest } from '../../features/driver-requests/api';
import { DRIVER_REQUESTS_COPY as COPY } from '../../features/driver-requests/copy';
import type { RideRequestFeedView } from '../../features/driver-requests/hooks';
import { formatMoney } from '../../utils/format';
import { AddressPair, AppText, Badge, Button, IconButton, PersonCard } from '../ui';
import { t } from '../../i18n';

/** T-552: stops listed on the card (one line each); the rest are summed up in one row. */
export const REQUEST_CARD_MAX_STOPS = 2;

const formatKm = (value: number): string => (value < 10 ? value.toFixed(1) : String(Math.round(value)));

const paymentLabel = (method: string | null): string | null => {
  if (!method) return null;
  if (method === 'cash') return COPY.cash;
  return method.charAt(0).toUpperCase() + method.slice(1);
};

type CardProps = {
  request: PendingRideRequest;
  /** This request's accept is in flight. */
  accepting: boolean;
  /** Any accept is in flight (the guard also lives in the thunk). */
  disabled: boolean;
  onAccept: (rideId: number) => void;
  onReject: (rideId: number) => void;
  /**
   * T-552: the most height the card may take (the space above its bottom offset, below the
   * status bar). The addresses scroll when the card would be taller.
   */
  maxHeight?: number;
};

/**
 * One incoming request from GET /rides/pending (T-403) on the UI-R5 ride kit: rider PersonCard
 * (name + rating or "New rider"), the route as an AddressPair at driving size (T-552: with the
 * ride's stops, in order, between the pickup and the drop-off), fare and pickup metrics, and a
 * primary Accept (navy, not green). Only fields the server sent are shown. The sheet redesign
 * with the countdown ring is UI-R11.
 */
export const IncomingRequestCard: React.FC<CardProps> = ({ request, accepting, disabled, onAccept, onReject, maxHeight }) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const payment = paymentLabel(request.paymentMethod);
  // T-552: the ride's stops, in order, between the pickup and the drop-off: the first
  // REQUEST_CARD_MAX_STOPS on one line each, then one "+N more stops" row (up to 5 per ride).
  const stops = useMemo(() => {
    const shown = request.stops.slice(0, REQUEST_CARD_MAX_STOPS).map((stop, index) => ({
      address: stop.address,
      key: stop.id ?? index,
      testID: `incoming-request-stop-${index + 1}`,
    }));
    const more = request.stops.length - shown.length;
    if (more <= 0) return shown;
    return [
      ...shown,
      {
        address: COPY.moreStops(more),
        key: 'more',
        label: COPY.moreStopsLabel(shown.length + 1, request.stops.length),
        testID: 'incoming-request-more-stops',
      },
    ];
  }, [request.stops]);

  return (
    <View style={[styles.card, maxHeight !== undefined ? { maxHeight } : null]} testID="incoming-request-card">
      <View style={styles.header}>
        <AppText variant="h3" accessibilityRole="header" style={styles.flex}>
          {COPY.title}
        </AppText>
        <IconButton
          icon="close"
          variant="tonal"
          onPress={() => onReject(request.id)}
          disabled={disabled}
          accessibilityLabel={COPY.rejectA11y}
          testID="incoming-request-reject"
        />
      </View>

      <View style={styles.metrics}>
        {request.estimatedFare !== null && (
          <View style={styles.metric}>
            <AppText variant="numericL" testID="incoming-request-fare">
              {formatMoney(request.estimatedFare)}
            </AppText>
            {payment && (
              <AppText variant="caption" color="textSecondary">
                {payment}
              </AppText>
            )}
          </View>
        )}
        {request.isOffer && (
          // BE-83: the fare above is the passenger's offer; the app fare is shown for comparison.
          <View style={styles.metric} testID="incoming-request-offer">
            <Badge label={t('driverFare.offerBadge')} tone="info" />
            {request.serverFare !== null && (
              <AppText variant="caption" color="textSecondary" testID="incoming-request-server-fare">
                {t('driverFare.offerVsApp', { amount: formatMoney(request.serverFare) })}
              </AppText>
            )}
          </View>
        )}
        {request.estimatedDistanceKm !== null && (
          <View style={styles.metric}>
            <AppText variant="numeric" testID="incoming-request-distance">
              {`${formatKm(request.estimatedDistanceKm)} ${COPY.km}`}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {COPY.away}
            </AppText>
          </View>
        )}
        {request.estimatedPickupMin !== null && (
          <View style={styles.metric}>
            <AppText variant="numeric" testID="incoming-request-eta">
              {`${request.estimatedPickupMin} ${COPY.minutesShort}`}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {COPY.toPickup}
            </AppText>
          </View>
        )}
      </View>

      <ScrollView style={styles.addresses} bounces={false} testID="incoming-request-addresses">
        <AddressPair
          size="lg"
          labels
          numberOfLines={2}
          stopNumberOfLines={1}
          pickup={request.pickupAddress}
          stops={stops}
          dropoff={request.dropoffAddress}
          pickupTestID="incoming-request-pickup"
          dropoffTestID="incoming-request-dropoff"
        />
      </ScrollView>

      <PersonCard
        variant="plain"
        name={request.passengerFirstName}
        photoUri={request.passengerPhotoUrl}
        fallbackName={COPY.passengerFallback}
        rating={request.passengerRating}
        newRatingLabel={COPY.noRating}
        nameTestID="incoming-request-passenger"
        ratingTestID="incoming-request-rating"
      />

      <Button
        label={accepting ? COPY.accepting : COPY.accept}
        size="lg"
        haptic="impactLight"
        onPress={() => onAccept(request.id)}
        disabled={disabled}
        loading={accepting}
        testID="incoming-request-accept"
      />
    </View>
  );
};

type PanelProps = {
  view: RideRequestFeedView;
  /** T-552: passed to the card (see `CardProps.maxHeight`). */
  maxHeight?: number;
  acceptingId: number | null;
  onAccept: (rideId: number) => void;
  onReject: (rideId: number) => void;
  onRetry: () => void;
};

/** The request card, or the feed's loading, empty or error state (nothing while idle). */
export const RideRequestPanel: React.FC<PanelProps> = ({ view, maxHeight, acceptingId, onAccept, onReject, onRetry }) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (view.kind === 'idle') {
    return null;
  }
  if (view.kind === 'request') {
    return (
      <IncomingRequestCard
        request={view.request}
        accepting={acceptingId === view.request.id}
        disabled={acceptingId !== null}
        onAccept={onAccept}
        onReject={onReject}
        maxHeight={maxHeight}
      />
    );
  }
  return (
    <View style={[styles.card, styles.stateCard]} testID={`ride-requests-${view.kind}`}>
      {view.kind === 'loading' && <ActivityIndicator size="small" color={theme.colors.primary} />}
      <Text style={styles.stateText}>
        {view.kind === 'loading' ? COPY.loading : view.kind === 'empty' ? COPY.empty : view.message}
      </Text>
      {view.kind === 'error' && view.canRetry && (
        <TouchableOpacity onPress={onRetry} accessibilityRole="button" testID="ride-requests-retry">
          <Text style={styles.retry}>{COPY.retry}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.space[5],
      gap: theme.space[4],
      ...theme.elevation[3],
    },
    stateCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      paddingVertical: theme.space[4],
    },
    stateText: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      flex: 1,
    },
    retry: {
      ...theme.typography.buttonSmall,
      color: theme.colors.primaryText,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
    },
    flex: {
      flex: 1,
      minWidth: 0,
    },
    // T-552: only the addresses give way (scroll) when the card hits its max height.
    addresses: {
      flexGrow: 0,
      flexShrink: 1,
    },
    metrics: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-end',
      gap: theme.space[6],
    },
    metric: {
      gap: 2,
    },
  });

export default IncomingRequestCard;
