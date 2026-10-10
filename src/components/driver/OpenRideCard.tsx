import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import type { AppTheme } from '../../theme';
import type { RideResource } from '../../services/rideService';
import { DRIVER_RIDE_COPY as COPY } from '../../features/driver-ride/copy';
import { rideStep, type DriverRideStep } from '../../features/driver-ride/steps';

type Props = {
  ride: RideResource;
  onOpen: () => void;
};

const STEP_LABELS: Partial<Record<DriverRideStep, string>> = {
  to_pickup: COPY.toPickup,
  at_pickup: COPY.atPickup,
  on_trip: COPY.onTrip,
  summary: COPY.summary,
  cancelled: COPY.cancelled,
};

/** The Map's way back to the ride in progress (T-405): the step and one "Open ride" button. */
export const OpenRideCard: React.FC<Props> = ({ ride, onOpen }) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card} testID="open-ride-card">
      <View style={styles.text}>
        <Text style={styles.overline}>{COPY.rideInProgress}</Text>
        <Text style={styles.title} testID="open-ride-step">{STEP_LABELS[rideStep(ride)] ?? COPY.unknown}</Text>
        <Text style={styles.passenger} numberOfLines={1}>
          {ride.passenger?.name || COPY.passengerFallback}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={COPY.openRideA11y}
        testID="open-ride-button"
      >
        <Text style={styles.buttonText}>{COPY.openRide}</Text>
        <Icon name="chevron-right" size={20} color={theme.colors.onPrimary} />
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.space[4],
      ...theme.elevation[3],
    },
    text: {
      flex: 1,
    },
    overline: {
      ...theme.typography.overline,
      color: theme.colors.textMuted,
    },
    title: {
      ...theme.typography.title,
      color: theme.colors.textPrimary,
    },
    passenger: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: theme.layout.touchTargetDriving,
      paddingHorizontal: theme.space[4],
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
    },
    buttonText: {
      ...theme.typography.button,
      color: theme.colors.onPrimary,
    },
  });

export default OpenRideCard;
