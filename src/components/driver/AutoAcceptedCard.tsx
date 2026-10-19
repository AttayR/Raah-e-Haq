import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import type { AppTheme } from '../../theme';
import type { LatLng } from '../../features/driver-requests/api';
import { distanceMeters } from '../../features/driver-location/throttle';
import type { RideResource } from '../../services/rideService';
import { formatMoney } from '../../utils/format';
import { t } from '../../i18n';
import { useScreenReaderEnabled } from '../../hooks/useScreenReaderEnabled';
import { AddressPair, AppText, Button, Icon } from '../ui';

/** §7.3: untouched, the takeover moves on to the trip by itself after 5 s. */
export const AUTO_ACCEPTED_ADVANCE_MS = 5_000;

const toPoint = (lat: unknown, lng: unknown): LatLng | null => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return lat != null && lng != null && Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
};

const formatKm = (metres: number): string => {
  const km = metres / 1000;
  return km < 10 ? km.toFixed(1) : String(Math.round(km));
};

type Props = {
  ride: RideResource;
  /** The driver's latest position, for the pickup distance; null before the first fix. */
  driverLocation: LatLng | null;
  onGo: () => void;
};

/**
 * "Ride accepted for you" (map-vehicles.md §7.3, SEC-33 item 9): the auto-accepted ride's fare,
 * pickup and drop-off area and the pickup distance, with one "Go to pickup" button (no Accept,
 * Decline or countdown). It calls `onGo` by itself after AUTO_ACCEPTED_ADVANCE_MS (not while a
 * screen reader is on); the timer is cleared on unmount. Cancelling later uses the normal to-pickup cancel (strike rule).
 */
export function AutoAcceptedCard({ ride, driverLocation, onGo }: Props) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const onGoRef = useRef(onGo);
  onGoRef.current = onGo;

  // With VoiceOver/TalkBack on (or not known yet) it waits for "Go to pickup": a screen reader
  // user may still be hearing the card.
  const screenReader = useScreenReaderEnabled();
  const autoAdvance = screenReader === false;
  useEffect(() => {
    if (!autoAdvance) return undefined;
    const timer = setTimeout(() => onGoRef.current(), AUTO_ACCEPTED_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [ride.id, autoAdvance]);

  const pickup = toPoint(ride.pickup_latitude, ride.pickup_longitude);
  const away = pickup && driverLocation ? formatKm(distanceMeters(driverLocation, pickup)) : null;
  const fare = formatMoney(ride.total_fare);

  return (
    <View style={styles.card} accessibilityLiveRegion="assertive" testID="auto-accepted-card">
      <View style={styles.header}>
        <Icon name="check" color="success" />
        <AppText variant="h2" accessibilityRole="header" style={styles.flex}>
          {t('autoAccept.takeoverTitle')}
        </AppText>
      </View>
      <View style={styles.metrics}>
        {fare ? (
          <AppText variant="numericL" testID="auto-accepted-fare">
            {fare}
          </AppText>
        ) : null}
        {away ? (
          <AppText variant="bodySmall" color="textSecondary" testID="auto-accepted-distance">
            {t('autoAccept.takeoverAway', { km: away })}
          </AppText>
        ) : null}
      </View>
      <AddressPair
        size="lg"
        labels
        numberOfLines={2}
        pickup={ride.pickup_address}
        dropoff={ride.dropoff_address}
        pickupTestID="auto-accepted-pickup"
        dropoffTestID="auto-accepted-dropoff"
      />
      {autoAdvance ? (
        <AppText variant="caption" color="textSecondary" testID="auto-accepted-auto-hint">
          {t('autoAccept.takeoverAutoHint')}
        </AppText>
      ) : null}
      <Button label={t('autoAccept.takeoverGo')} size="lg" onPress={onGo} haptic="impactLight" testID="auto-accepted-go" />
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.space[5],
      gap: theme.space[4],
      ...theme.elevation[3],
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: theme.space[2] },
    metrics: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.space[4] },
    flex: { flex: 1, minWidth: 0 },
  });

export default AutoAcceptedCard;
