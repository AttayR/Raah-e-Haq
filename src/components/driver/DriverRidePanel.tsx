import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import type { AppTheme } from '../../theme';
import type { RideResource } from '../../services/rideService';
import { DRIVER_RIDE_COPY as COPY } from '../../features/driver-ride/copy';
import type { DriverRideAction } from '../../features/driver-ride/slice';
import { activeStops, type DriverRideStep } from '../../features/driver-ride/steps';

type Props = {
  ride: RideResource;
  step: DriverRideStep;
  pendingAction: DriverRideAction | null;
  /** The validated passenger phone, or null (no call button). */
  phone: string | null;
  /** True when there is somewhere to navigate to (a usable coordinate). */
  canNavigate: boolean;
  onCall: () => void;
  onNavigate: () => void;
  onArrived: () => void;
  onStart: () => void;
  onComplete: () => void;
  onCompleteStop: (stopId: number) => void;
  onCancel: () => void;
};

const TITLES: Partial<Record<DriverRideStep, string>> = {
  to_pickup: COPY.toPickup,
  at_pickup: COPY.atPickup,
  on_trip: COPY.onTrip,
};

/**
 * The live part of the driver ride screen (T-405): passenger, where to go, the stops and the
 * one next action for the current step (I've arrived → Start trip → Stop done… → Complete
 * trip). Cancel is offered only before the trip starts (BE-04).
 */
export const DriverRidePanel: React.FC<Props> = ({
  ride,
  step,
  pendingAction,
  phone,
  canNavigate,
  onCall,
  onNavigate,
  onArrived,
  onStart,
  onComplete,
  onCompleteStop,
  onCancel,
}) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const busy = pendingAction !== null;
  const userAction = pendingAction !== null && pendingAction !== 'refresh' && pendingAction !== 'restore';
  const stops = activeStops(ride);
  const nextStop = step === 'on_trip' ? stops[0] ?? null : null;
  const passengerName = ride.passenger?.name || COPY.passengerFallback;
  const rating = typeof ride.passenger?.rating === 'number' ? ride.passenger.rating : null;

  let primary: { label: string; onPress: () => void; testID: string } | null = null;
  if (step === 'to_pickup') primary = { label: COPY.arrived, onPress: onArrived, testID: 'driver-ride-arrived' };
  if (step === 'at_pickup') primary = { label: COPY.start, onPress: onStart, testID: 'driver-ride-start' };
  if (step === 'on_trip') {
    primary = nextStop
      ? { label: COPY.completeStop, onPress: () => onCompleteStop(nextStop.id), testID: 'driver-ride-complete-stop' }
      : { label: COPY.complete, onPress: onComplete, testID: 'driver-ride-complete' };
  }

  return (
    <View style={styles.card} testID="driver-ride-panel">
      <Text style={styles.title} accessibilityRole="header" testID="driver-ride-title">
        {TITLES[step] ?? COPY.unknown}
      </Text>

      <View style={styles.passengerRow}>
        <View style={styles.passengerInfo}>
          <Text style={styles.passengerName} testID="driver-ride-passenger">{passengerName}</Text>
          <View style={styles.ratingRow}>
            {rating !== null ? (
              <>
                <Icon name="star" size={14} color={theme.colors.ratingStar} />
                <Text style={styles.rating}>{rating.toFixed(1)}</Text>
              </>
            ) : (
              <Text style={styles.rating}>{COPY.noRating}</Text>
            )}
          </View>
        </View>
        {phone && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onCall}
            accessibilityRole="button"
            accessibilityLabel={COPY.callA11y}
            testID="driver-ride-call"
          >
            <Icon name="phone" size={20} color={theme.colors.primaryText} />
            <Text style={styles.iconButtonText}>{COPY.call}</Text>
          </TouchableOpacity>
        )}
        {canNavigate && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onNavigate}
            accessibilityRole="button"
            accessibilityLabel={COPY.navigateA11y}
            testID="driver-ride-navigate"
          >
            <Icon name="navigation" size={20} color={theme.colors.primaryText} />
            <Text style={styles.iconButtonText}>{COPY.navigate}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.addressRow}>
        <Icon name="trip-origin" size={16} color={theme.colors.pickupPin} />
        <View style={styles.addressText}>
          <Text style={styles.addressLabel}>{COPY.pickup}</Text>
          <Text style={styles.address} numberOfLines={2} testID="driver-ride-pickup">{ride.pickup_address}</Text>
        </View>
      </View>
      {stops.map((stop) => (
        <View key={stop.id} style={styles.addressRow} testID={`driver-ride-stop-${stop.id}`}>
          <Icon name="more-vert" size={16} color={theme.colors.stopPin} />
          <View style={styles.addressText}>
            <Text style={styles.addressLabel}>{nextStop?.id === stop.id ? COPY.nextStop : COPY.stop}</Text>
            <Text style={styles.address} numberOfLines={2}>{stop.address}</Text>
          </View>
        </View>
      ))}
      <View style={styles.addressRow}>
        <Icon name="place" size={16} color={theme.colors.dropoffPin} />
        <View style={styles.addressText}>
          <Text style={styles.addressLabel}>{COPY.dropoff}</Text>
          <Text style={styles.address} numberOfLines={2} testID="driver-ride-dropoff">{ride.dropoff_address}</Text>
        </View>
      </View>

      {primary && (
        <TouchableOpacity
          style={[styles.primaryButton, busy && styles.disabled]}
          onPress={primary.onPress}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy: userAction }}
          testID={primary.testID}
        >
          {userAction && <ActivityIndicator size="small" color={theme.colors.onPrimary} style={styles.spinner} />}
          <Text style={styles.primaryText}>{userAction ? COPY.working : primary.label}</Text>
        </TouchableOpacity>
      )}

      {(step === 'to_pickup' || step === 'at_pickup') && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          testID="driver-ride-cancel"
        >
          <Text style={[styles.cancelText, busy && styles.disabled]}>{COPY.cancel}</Text>
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
    title: {
      ...theme.typography.title,
      color: theme.colors.textPrimary,
      marginBottom: theme.space[3],
    },
    passengerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      marginBottom: theme.space[3],
    },
    passengerInfo: {
      flex: 1,
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
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    iconButton: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: theme.layout.touchTargetDriving,
      minHeight: theme.layout.touchTargetDriving,
      paddingHorizontal: theme.space[2],
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primarySoft,
    },
    iconButtonText: {
      ...theme.typography.caption,
      color: theme.colors.onPrimarySoft,
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
    primaryButton: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: theme.layout.touchTargetDriving,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
      marginTop: theme.space[3],
    },
    primaryText: {
      ...theme.typography.button,
      color: theme.colors.onPrimary,
    },
    spinner: {
      marginRight: theme.space[2],
    },
    cancelButton: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: theme.layout.touchTargetDriving,
      marginTop: theme.space[2],
    },
    cancelText: {
      ...theme.typography.buttonSmall,
      color: theme.colors.danger,
    },
    disabled: {
      opacity: 0.4,
    },
  });

export default DriverRidePanel;
