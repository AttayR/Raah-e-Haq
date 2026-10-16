import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import type { AppTheme } from '../../theme';
import { DRIVER_RIDE_COPY as COPY } from '../../features/driver-ride/copy';

/** The driver ride screen's "Ride cancelled" card with Done (moved out of DriverRideScreen). */
export function DriverRideCancelledCard({ onDone }: { onDone: () => void }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.card} testID="driver-ride-cancelled">
      <Text style={styles.cardTitle}>{COPY.cancelled}</Text>
      <Text style={styles.body}>{COPY.cancelledBody}</Text>
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
