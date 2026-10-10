import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import type { AppTheme } from '../../theme';
import type { RideResource } from '../../services/rideService';
import { DRIVER_RIDE_COPY as COPY } from '../../features/driver-ride/copy';
import { formatAmount, toRideSummary } from '../../features/driver-ride/steps';

type Props = {
  ride: RideResource;
  onDone: () => void;
};

const money = (value: number): string => `${COPY.currency} ${formatAmount(value)}`;

/**
 * The completed trip (T-405): the fare, its parts and the driver's earnings exactly as the
 * server computed them on POST /rides/{id}/complete. Payments are cash only (B-08), so the
 * driver collects the total from the passenger. Nothing here is computed on the device.
 */
export const DriverRideSummary: React.FC<Props> = ({ ride, onDone }) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const summary = toRideSummary(ride);
  const isCash = summary.paymentMethod === null || summary.paymentMethod === 'cash';
  const rows: Array<{ key: string; label: string; value: number | null }> = summary.breakdown
    ? [
        { key: 'base', label: COPY.base, value: summary.breakdown.base },
        { key: 'distance', label: COPY.distance, value: summary.breakdown.distance },
        { key: 'time', label: COPY.time, value: summary.breakdown.time },
        { key: 'stops', label: COPY.stopsFare, value: summary.breakdown.stops },
        { key: 'min', label: COPY.minFareAdjustment, value: summary.breakdown.minFareAdjustment },
      ].filter((row) => row.value !== null && row.value > 0)
    : [];

  return (
    <View style={styles.card} testID="driver-ride-summary">
      <Text style={styles.title} accessibilityRole="header">{COPY.summary}</Text>

      {summary.totalFare !== null && (
        <View style={styles.totalBlock}>
          <Text style={styles.label}>{COPY.totalFare}</Text>
          <Text style={styles.total} testID="driver-ride-total">{money(summary.totalFare)}</Text>
          <Text style={styles.collect} testID="driver-ride-collect">
            {isCash ? COPY.collectCash : `${COPY.collectOther} ${summary.paymentMethod}`}
          </Text>
        </View>
      )}

      {(summary.distanceKm !== null || summary.durationMinutes !== null) && (
        <Text style={styles.metrics} testID="driver-ride-metrics">
          {[
            summary.distanceKm !== null ? `${summary.distanceKm} ${COPY.km}` : null,
            summary.durationMinutes !== null ? `${summary.durationMinutes} ${COPY.minutes}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      )}

      {rows.map((row) => (
        <View key={row.key} style={styles.row} testID={`driver-ride-breakdown-${row.key}`}>
          <Text style={styles.rowLabel}>{row.label}</Text>
          <Text style={styles.rowValue}>{money(row.value ?? 0)}</Text>
        </View>
      ))}

      {summary.driverEarnings !== null && (
        <View style={[styles.row, styles.earningsRow]}>
          <Text style={styles.earningsLabel}>{COPY.yourEarnings}</Text>
          <Text style={styles.earnings} testID="driver-ride-earnings">{money(summary.driverEarnings)}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.doneButton} onPress={onDone} accessibilityRole="button" testID="driver-ride-done">
        <Text style={styles.doneText}>{COPY.done}</Text>
      </TouchableOpacity>
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
    totalBlock: {
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    label: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    total: {
      ...theme.typography.numericXL,
      color: theme.colors.textPrimary,
    },
    collect: {
      ...theme.typography.label,
      color: theme.colors.success,
    },
    metrics: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.space[3],
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: theme.space[1],
    },
    rowLabel: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    rowValue: {
      ...theme.typography.numericSmall,
      color: theme.colors.textPrimary,
    },
    earningsRow: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      marginTop: theme.space[2],
      paddingTop: theme.space[2],
    },
    earningsLabel: {
      ...theme.typography.bodyStrong,
      color: theme.colors.textPrimary,
    },
    earnings: {
      ...theme.typography.numeric,
      color: theme.colors.success,
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

export default DriverRideSummary;
