import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AddressPair, AppText, Button, Card, Icon, vehicleIconName } from '../../../components/ui';
import { t } from '../../../i18n';
import { isParcelRide } from '../../parcel/api';
import type { PassengerRideStage } from '../stage';
import { readNumberOrNull } from '../../../core/api/read';
import type { RideResource } from '../../../services/rideService';
import { space } from '../../../theme';
import { formatMoney } from '../../../utils/format';
import { tierLabel } from '../../ride-history/copy';
import { ACTIVE_RIDE_COPY } from '../copy';

/** After this long without a driver the subtitle says it is still looking (passenger-finding-driver.md). */
export const FINDING_SLOW_AFTER_MS = 60_000;

/**
 * The booking the passenger just sent, shown while POST /rides is in flight (no ride yet) and to
 * keep the tier's server name once the ride exists (passenger-finding-driver.md "Creating").
 */
export type SearchDraft = {
  pickup: string;
  dropoff: string;
  stops: ReadonlyArray<string>;
  vehicleKey: string | null;
  vehicleName: string | null;
  /** The formatted fare that was requested (the offer, else the quote). */
  fare: string | null;
};

export type SearchingTrip = {
  pickup: string;
  dropoff: string;
  stops: ReadonlyArray<string>;
  vehicleKey: string | null;
  vehicleName: string | null;
  fare: string | null;
};

const stopAddresses = (ride: RideResource): string[] =>
  (Array.isArray(ride.stops) ? ride.stops : [])
    .filter((s) => s.status !== 'cancelled')
    .map((s) => (typeof s.address === 'string' ? s.address.trim() : ''))
    .filter((a) => a.length > 0);

/**
 * What the searching card shows: the ride's own addresses and fare once it exists (a relaunch
 * restores it without a draft), else the draft. The tier keeps the catalogue name the passenger
 * picked when it is the same tier.
 */
export const searchingTripOf = (ride: RideResource | null, draft: SearchDraft | null | undefined): SearchingTrip | null => {
  if (!ride) return draft ?? null;
  const fare = readNumberOrNull(ride.offered_fare) ?? readNumberOrNull(ride.total_fare);
  const sameTier = !!draft && draft.vehicleKey === ride.vehicle_type;
  return {
    pickup: ride.pickup_address,
    dropoff: ride.dropoff_address,
    stops: stopAddresses(ride),
    vehicleKey: ride.vehicle_type,
    vehicleName: (sameTier ? draft?.vehicleName : null) ?? tierLabel(ride.vehicle_type),
    fare: fare !== null ? formatMoney(fare) : sameTier ? (draft?.fare ?? null) : null,
  };
};

/**
 * "This usually takes under a minute.", then after a minute "Still looking. More drivers are
 * joining." One timer for the swap (no per-second re-render), counted from `requested_at`.
 */
export function FindingSubtitle({ requestedAt, testID = 'active-ride-subtitle' }: { requestedAt?: string | null; testID?: string }) {
  const [since] = useState(() => {
    const at = requestedAt ? Date.parse(requestedAt) : NaN;
    return Number.isFinite(at) ? Math.min(at, Date.now()) : Date.now();
  });
  const [slow, setSlow] = useState(() => Date.now() - since >= FINDING_SLOW_AFTER_MS);
  useEffect(() => {
    if (slow) return undefined;
    const timer = setTimeout(() => setSlow(true), Math.max(0, since + FINDING_SLOW_AFTER_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [slow, since]);
  return (
    <AppText variant="bodySmall" color="textSecondary" testID={testID}>
      {slow ? ACTIVE_RIDE_COPY.findingSlowMessage : ACTIVE_RIDE_COPY.findingMessage}
    </AppText>
  );
}

/**
 * The trip being searched for (passenger-finding-driver.md block 4): the Raah line with pickup,
 * stops and drop-off (one line each), a hairline, then the tier glyph and name with the fare and
 * "Cash" at the end.
 */
export function SearchingTripCard({ trip, testID = 'searching-trip-card' }: { trip: SearchingTrip; testID?: string }) {
  const { theme } = useAppTheme();
  return (
    <Card variant="outlined" testID={testID}>
      <AddressPair
        density="compact"
        pickup={trip.pickup}
        stops={trip.stops.map((address, i) => ({ address, key: i }))}
        dropoff={trip.dropoff}
        pickupTestID={`${testID}-pickup`}
        dropoffTestID={`${testID}-dropoff`}
      />
      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
      <View style={styles.row}>
        <Icon name={vehicleIconName(trip.vehicleKey)} size={24} color="textPrimary" />
        <AppText variant="body" numberOfLines={1} style={styles.flex} testID={`${testID}-vehicle`}>
          {trip.vehicleName ?? ''}
        </AppText>
        {trip.fare ? (
          <View style={styles.fare}>
            <AppText variant="numeric" testID={`${testID}-fare`}>
              {trip.fare}
            </AppText>
            <AppText variant="caption" color="textMuted">
              {ACTIVE_RIDE_COPY.cashLabel}
            </AppText>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * The passenger's cancel action: "Cancel delivery" for a parcel (T-579), "Cancel request" while
 * no driver has taken the ride (UI-R10, `lg`, the finding-driver sheet footer), else "Cancel ride".
 */
export const PassengerCancelButton: React.FC<{
  stage: PassengerRideStage;
  ride: RideResource | null;
  onPress: () => void;
  disabled?: boolean;
}> = ({ stage, ride, onPress, disabled = false }) => {
  const searching = stage === 'searching';
  return (
    <Button
      label={isParcelRide(ride) ? t('parcel.cancelDelivery') : searching ? ACTIVE_RIDE_COPY.cancelRequest : ACTIVE_RIDE_COPY.cancelRide}
      variant="destructiveSoft"
      size={searching ? 'lg' : 'md'}
      onPress={onPress}
      disabled={disabled}
      testID="active-ride-cancel"
    />
  );
};

const styles = StyleSheet.create({
  divider: { height: StyleSheet.hairlineWidth, marginVertical: space[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  flex: { flex: 1, minWidth: 0 },
  fare: { flexDirection: 'row', alignItems: 'baseline', gap: space[1] },
});
