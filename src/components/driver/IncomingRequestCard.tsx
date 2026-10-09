import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import type { AppTheme } from '../../theme';
import type { PendingRideRequest } from '../../features/driver-requests/api';
import { DRIVER_REQUESTS_COPY as COPY } from '../../features/driver-requests/copy';
import type { RideRequestFeedView } from '../../features/driver-requests/hooks';

const formatAmount = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);

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
};

/** One incoming request from GET /rides/pending (T-403). Only fields the server sent are shown. */
export const IncomingRequestCard: React.FC<CardProps> = ({ request, accepting, disabled, onAccept, onReject }) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const payment = paymentLabel(request.paymentMethod);

  return (
    <View style={styles.card} testID="incoming-request-card">
      <View style={styles.header}>
        <Text style={styles.title}>{COPY.title}</Text>
        <TouchableOpacity
          onPress={() => onReject(request.id)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={COPY.rejectA11y}
          testID="incoming-request-reject"
          hitSlop={8}
        >
          <Icon name="close" size={24} color={theme.colors.danger} />
        </TouchableOpacity>
      </View>

      <View style={styles.passengerRow}>
        <Text style={styles.passengerName} testID="incoming-request-passenger">
          {request.passengerFirstName ?? COPY.passengerFallback}
        </Text>
        <View style={styles.ratingRow}>
          {request.passengerRating !== null ? (
            <>
              <Icon name="star" size={16} color={theme.colors.ratingStar} />
              <Text style={styles.rating} testID="incoming-request-rating">
                {request.passengerRating.toFixed(1)}
              </Text>
            </>
          ) : (
            <Text style={styles.rating}>{COPY.noRating}</Text>
          )}
        </View>
      </View>

      <View style={styles.addressRow}>
        <Icon name="trip-origin" size={16} color={theme.colors.pickupPin} />
        <View style={styles.addressText}>
          <Text style={styles.addressLabel}>{COPY.pickup}</Text>
          <Text style={styles.address} numberOfLines={2} testID="incoming-request-pickup">
            {request.pickupAddress}
          </Text>
        </View>
      </View>
      <View style={styles.addressRow}>
        <Icon name="place" size={16} color={theme.colors.dropoffPin} />
        <View style={styles.addressText}>
          <Text style={styles.addressLabel}>{COPY.dropoff}</Text>
          <Text style={styles.address} numberOfLines={2} testID="incoming-request-dropoff">
            {request.dropoffAddress}
          </Text>
        </View>
      </View>

      <View style={styles.metrics}>
        {request.estimatedFare !== null && (
          <View>
            <Text style={styles.fare} testID="incoming-request-fare">
              {`${COPY.currency} ${formatAmount(request.estimatedFare)}`}
            </Text>
            {payment && <Text style={styles.metricLabel}>{payment}</Text>}
          </View>
        )}
        {request.estimatedDistanceKm !== null && (
          <View>
            <Text style={styles.metric} testID="incoming-request-distance">
              {`${formatKm(request.estimatedDistanceKm)} ${COPY.km}`}
            </Text>
            <Text style={styles.metricLabel}>{COPY.away}</Text>
          </View>
        )}
        {request.estimatedPickupMin !== null && (
          <View>
            <Text style={styles.metric} testID="incoming-request-eta">
              {`${request.estimatedPickupMin} ${COPY.minutesShort}`}
            </Text>
            <Text style={styles.metricLabel}>{COPY.toPickup}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.acceptButton, disabled && styles.acceptButtonDisabled]}
        onPress={() => onAccept(request.id)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled, busy: accepting }}
        testID="incoming-request-accept"
      >
        {accepting && <ActivityIndicator size="small" color={theme.colors.onSuccess} style={styles.spinner} />}
        <Text style={styles.acceptText}>{accepting ? COPY.accepting : COPY.accept}</Text>
      </TouchableOpacity>
    </View>
  );
};

type PanelProps = {
  view: RideRequestFeedView;
  acceptingId: number | null;
  onAccept: (rideId: number) => void;
  onReject: (rideId: number) => void;
  onRetry: () => void;
};

/** The request card, or the feed's loading, empty or error state (nothing while idle). */
export const RideRequestPanel: React.FC<PanelProps> = ({ view, acceptingId, onAccept, onReject, onRetry }) => {
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
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    title: {
      ...theme.typography.title,
      color: theme.colors.textPrimary,
    },
    passengerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    passengerName: {
      ...theme.typography.bodyStrong,
      color: theme.colors.textPrimary,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1],
    },
    rating: {
      ...theme.typography.label,
      color: theme.colors.textSecondary,
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.space[2],
      marginBottom: theme.space[2],
    },
    addressText: {
      flex: 1,
    },
    addressLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    address: {
      ...theme.typography.bodySmall,
      color: theme.colors.textPrimary,
    },
    metrics: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: theme.space[2],
      marginBottom: theme.space[4],
    },
    fare: {
      ...theme.typography.numericL,
      color: theme.colors.success,
    },
    metric: {
      ...theme.typography.numeric,
      color: theme.colors.textPrimary,
    },
    metricLabel: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    acceptButton: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: theme.layout.touchTargetDriving,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.success,
    },
    acceptButtonDisabled: {
      opacity: 0.4,
    },
    spinner: {
      marginRight: theme.space[2],
    },
    acceptText: {
      ...theme.typography.button,
      color: theme.colors.onSuccess,
    },
  });

export default IncomingRequestCard;
