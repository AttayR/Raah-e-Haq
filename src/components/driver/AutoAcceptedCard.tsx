import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LatLng } from '../../features/driver-requests/api';
import { DRIVER_REQUESTS_COPY as COPY } from '../../features/driver-requests/copy';
import { distanceMeters } from '../../features/driver-location/throttle';
import type { RideResource } from '../../services/rideService';
import { formatDistance, formatDuration, formatMoney } from '../../utils/format';
import { t } from '../../i18n';
import { useScreenReaderEnabled } from '../../hooks/useScreenReaderEnabled';
import { space } from '../../theme';
import { AddressPair, AppText, Badge, Button, Icon, MetricStrip, type CountdownSpec, type MetricCell } from '../ui';

/** §7.3: untouched, the takeover moves on to the trip by itself after 5 s. */
export const AUTO_ACCEPTED_ADVANCE_MS = 5_000;

const toPoint = (lat: unknown, lng: unknown): LatLng | null => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return lat != null && lng != null && Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
};

/**
 * The takeover's 5 s advance (§7.3, SEC-33 item 9): calls `onGo` by itself after
 * AUTO_ACCEPTED_ADVANCE_MS and returns the countdown the Go to pickup ring draws. Not while a
 * screen reader is on (or not known yet), nor without a ride: that user may still be hearing the sheet, so there is no
 * ring and no timer. The timer is cleared on unmount.
 */
export function useAutoAcceptedAdvance(rideId: number | null, onGo: () => void): CountdownSpec | null {
  const onGoRef = useRef(onGo);
  onGoRef.current = onGo;
  const screenReader = useScreenReaderEnabled();
  const autoAdvance = screenReader === false;
  const [startedAt, setStartedAt] = useState<number | null>(null);
  useEffect(() => {
    if (!autoAdvance || rideId === null) {
      setStartedAt(null);
      return undefined;
    }
    setStartedAt(Date.now());
    const timer = setTimeout(() => onGoRef.current(), AUTO_ACCEPTED_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [rideId, autoAdvance]);
  return startedAt === null ? null : { startedAt, durationMs: AUTO_ACCEPTED_ADVANCE_MS };
}

type Props = {
  ride: RideResource;
  /** The driver's latest position, for the pickup distance; null before the first fix. */
  driverLocation: LatLng | null;
};

/**
 * "Ride accepted for you" (map-vehicles.md §7.3, restyled in UI-R11 R12 to the request sheet's
 * anatomy): `check-circle` + `h2` title, the fare `numericL` with the Cash badge, the metric strip
 * (how far the pickup is) and the pickup row. No Accept, Decline or offer countdown: the footer
 * is one Go to pickup (AutoAcceptedFooter). Cancelling later uses the normal to-pickup cancel.
 */
export function AutoAcceptedCard({ ride, driverLocation }: Props) {
  const fare = formatMoney(ride.total_fare);
  const { pickup_latitude: pickupLat, pickup_longitude: pickupLng } = ride;
  const eta = ride.eta && ride.eta.target === 'pickup' ? ride.eta : null;
  const etaMinutes = eta ? Number(eta.minutes) : null;
  const etaKm = eta ? Number(eta.distance_km) : null;
  const metrics = useMemo<MetricCell[]>(() => {
    const cells: MetricCell[] = [];
    // BE-128: the server's ETA to the pickup (never `estimated_arrival`, never guessed).
    if (etaMinutes !== null && Number.isFinite(etaMinutes)) {
      const value = formatDuration(etaMinutes);
      cells.push({
        key: 'pickup',
        value,
        label: COPY.metricToPickup,
        accessibilityLabel: COPY.metricToPickupA11y(value),
        testID: 'auto-accepted-eta',
      });
    }
    // Distance: the server's when it sent an ETA, else the shipped straight-line distance from the fix.
    const pickup = toPoint(pickupLat, pickupLng);
    const km =
      etaKm !== null && Number.isFinite(etaKm)
        ? etaKm
        : pickup && driverLocation
        ? distanceMeters(driverLocation, pickup) / 1000
        : null;
    if (km !== null) {
      const away = formatDistance(km);
      cells.push({
        key: 'away',
        value: away,
        label: COPY.metricAway,
        accessibilityLabel: COPY.metricAwayA11y(away),
        testID: 'auto-accepted-distance',
      });
    }
    return cells;
  }, [etaMinutes, etaKm, pickupLat, pickupLng, driverLocation]);
  const payment = ride.payment_method === 'cash' || !ride.payment_method ? COPY.cash : null;

  return (
    <View accessibilityLiveRegion="assertive" testID="auto-accepted-card">
      <View style={styles.header}>
        <Icon name="check" color="success" />
        <AppText variant="h2" accessibilityRole="header" style={styles.flex}>
          {t('autoAccept.takeoverTitle')}
        </AppText>
      </View>
      <View style={styles.fareRow}>
        {fare ? (
          <AppText variant="numericL" testID="auto-accepted-fare">
            {fare}
          </AppText>
        ) : null}
        {payment ? <Badge label={payment} tone="neutral" icon="cash" /> : null}
      </View>
      {metrics.length > 0 ? (
        <View style={styles.block}>
          <MetricStrip cells={metrics} testID="auto-accepted-metrics" />
        </View>
      ) : null}
      <View style={styles.block}>
        <AddressPair
          size="lg"
          labels
          numberOfLines={2}
          pickup={ride.pickup_address}
          dropoff={ride.dropoff_address}
          pickupTestID="auto-accepted-pickup"
          dropoffTestID="auto-accepted-dropoff"
        />
      </View>
    </View>
  );
}

/** R12 footer: one Go to pickup `lg primary` with the 5 s ring while it advances by itself. */
export function AutoAcceptedFooter({ onGo, countdown }: { onGo: () => void; countdown: CountdownSpec | null }) {
  return (
    <View style={styles.flex}>
      <Button
        label={t('autoAccept.takeoverGo')}
        size="lg"
        onPress={onGo}
        haptic="impactLight"
        countdown={countdown ?? undefined}
        testID="auto-accepted-go"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  fareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginTop: space[3],
  },
  block: { marginTop: space[4] },
  flex: { flex: 1, minWidth: 0 },
});

export default AutoAcceptedCard;
