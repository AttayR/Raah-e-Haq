import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import type { AppTheme } from '../../theme';
import { DRIVER_RIDE_COPY as COPY } from '../../features/driver-ride/copy';
import { t } from '../../i18n';
import type { ParcelView } from '../../features/parcel/types';

/**
 * What the card says: T-563, a parcel the driver refused at the pickup (or one cancelled) says
 * so, instead of the generic "no longer assigned to you".
 */
export const driverCancelledCopy = (parcel: Pick<ParcelView, 'refusalReason'> | null): { title: string; body: string } => {
  if (!parcel) return { title: COPY.cancelled, body: COPY.cancelledBody };
  return parcel.refusalReason
    ? { title: t('parcel.driverRefusedTitle'), body: t('parcel.driverRefusedBody') }
    : { title: t('parcel.driverCancelledTitle'), body: t('parcel.driverCancelledBody') };
};

/** The driver ride screen's "Ride cancelled" card with Done (moved out of DriverRideScreen). */
export function DriverRideCancelledCard({ onDone, parcel = null }: { onDone: () => void; parcel?: Pick<ParcelView, 'refusalReason'> | null }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const copy = driverCancelledCopy(parcel);
  return (
    <View style={styles.card} testID="driver-ride-cancelled">
      <Text style={styles.cardTitle} accessibilityRole="header" testID="driver-ride-cancelled-title">
        {copy.title}
      </Text>
      <Text style={styles.body} testID="driver-ride-cancelled-body">
        {copy.body}
      </Text>
      <TouchableOpacity style={styles.doneButton} onPress={onDone} accessibilityRole="button" testID="driver-ride-done">
        <Text style={styles.doneText}>{COPY.done}</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.space[5],
      ...theme.elevation[3],
    },
    cardTitle: {
      ...theme.typography.title,
      color: theme.colors.textPrimary,
      marginBottom: theme.space[2],
    },
    body: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    doneButton: {
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: theme.layout.touchTargetDriving,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
      marginTop: theme.space[4],
    },
    doneText: {
      ...theme.typography.button,
      color: theme.colors.onPrimary,
    },
  });
