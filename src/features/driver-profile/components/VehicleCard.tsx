import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { componentTokens, radius, space } from '../../../theme';
import { AppText, Badge, Icon, ListGroup, ListItem, SkeletonListItem, vehicleIconName, type IconName } from '../../../components/ui';
import type { RemoteData } from '../../../core/api/useRemoteData';
import { DRIVER_PROFILE_COPY as COPY } from '../copy';
import { vehicleStatusBadge, vehicleTitle } from '../format';
import type { DriverVehicle } from '../types';

type Props = {
  vehicles: Pick<RemoteData<DriverVehicle[]>, 'data' | 'status' | 'reload'>;
  /** The account's vehicle type (profile `vehicle_type`): the glyph fallback before BE-126. */
  vehicleType?: string | null;
  testID?: string;
};

const k = componentTokens.listItem;
const d = componentTokens.documents;

/**
 * The row glyph: the vehicle's own type (BE-126); before that the account's type only when the
 * driver has exactly one vehicle, else a neutral steering wheel (never a car glyph on a bike).
 */
export const vehicleGlyph = (vehicle: DriverVehicle, count: number, accountType: string | null | undefined): IconName => {
  if (vehicle.vehicleType) return vehicleIconName(vehicle.vehicleType);
  return count === 1 ? vehicleIconName(accountType) : 'steering';
};

/** "2019 · White" (BE-126); null when neither is sent. */
const yearAndColour = (vehicle: DriverVehicle): string | null =>
  [vehicle.year !== null ? String(vehicle.year) : null, vehicle.color].filter(Boolean).join(' · ') || null;

function VehicleRow({ vehicle, icon, testID }: { vehicle: DriverVehicle; icon: IconName; testID: string }) {
  const { theme } = useAppTheme();
  const badge = vehicleStatusBadge(vehicle);
  const title = vehicleTitle(vehicle);
  const details = yearAndColour(vehicle);
  const reasonText =
    vehicle.status === 'rejected' ? (vehicle.rejectionReason ? COPY.vehicleReason(vehicle.rejectionReason) : COPY.vehicleNoReason) : null;
  const spoken = [
    title,
    details,
    vehicle.licensePlate ? COPY.plateA11y(vehicle.licensePlate) : COPY.noPlate,
    badge?.label,
    reasonText,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <View style={styles.row} accessible accessibilityLabel={spoken} testID={testID}>
      <View style={[styles.tile, { backgroundColor: theme.colors.surfaceAlt }]}>
        <Icon name={icon} color="textSecondary" testID={`${testID}-glyph-${icon}`} />
      </View>
      <View style={styles.text}>
        <AppText variant="title" numberOfLines={1}>
          {title}
        </AppText>
        {details ? (
          <AppText variant="bodySmall" color="textSecondary" numberOfLines={1}>
            {details}
          </AppText>
        ) : null}
        {vehicle.licensePlate ? (
          <View style={[styles.plate, { backgroundColor: theme.colors.surfaceAlt }]}>
            <AppText variant="numericSmall" numberOfLines={1} style={styles.plateText} testID={`${testID}-plate`}>
              {vehicle.licensePlate}
            </AppText>
          </View>
        ) : (
          <AppText variant="caption" color="textMuted" style={styles.noPlate}>
            {COPY.noPlate}
          </AppText>
        )}
        {reasonText ? (
          <AppText variant="bodySmall" color="danger" numberOfLines={3} style={styles.reason} testID={`${testID}-reason`}>
            {reasonText}
          </AppText>
        ) : null}
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Badge tone={badge.tone} label={badge.label} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * "Vehicle" group (T-507, T-514; UI-R17 driver-vehicle-documents.md §2.2): each registered
 * vehicle as make + model, the year and colour when BE-126 sends them, the plate as a chip, its
 * review Badge and a rejection's reason, from GET /profile/documents. Loading shows a skeleton
 * row, a failure a retry row, and no vehicle says so; nothing is invented. Not pressable: the
 * details change through support.
 */
export function VehicleCard({ vehicles, vehicleType, testID = 'driver-vehicle' }: Props) {
  const { data, status, reload } = vehicles;

  let rows: React.ReactNode;
  if (!data && status === 'failed') {
    rows = (
      <ListItem
        icon="networkError"
        title={COPY.vehicleFailed}
        value={COPY.retry}
        onPress={reload}
        accessibilityLabel={`${COPY.vehicleFailed}. ${COPY.retry}`}
        testID={`${testID}-error`}
      />
    );
  } else if (!data) {
    rows = (
      <View testID={`${testID}-loading`}>
        <SkeletonListItem />
      </View>
    );
  } else if (data.length === 0) {
    rows = <ListItem icon="carOff" title={COPY.noVehicle} subtitle={COPY.noVehicleBody} testID={`${testID}-empty`} />;
  } else {
    rows = data.map((vehicle) => (
      <VehicleRow
        key={vehicle.id}
        vehicle={vehicle}
        icon={vehicleGlyph(vehicle, data.length, vehicleType)}
        testID={`${testID}-${vehicle.id}`}
      />
    ));
  }

  return (
    <ListGroup title={COPY.vehicleGroup} inset="tile" testID={testID}>
      {rows}
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    minHeight: k.minHeight.two,
  },
  tile: { width: k.tile, height: k.tile, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, marginStart: space[4] },
  plate: {
    alignSelf: 'flex-start',
    minHeight: d.plateChipHeight,
    paddingHorizontal: space[2],
    borderRadius: radius.sm,
    justifyContent: 'center',
    marginTop: space[1],
    maxWidth: '100%',
  },
  plateText: { letterSpacing: d.plateLetterSpacing },
  noPlate: { marginTop: space[1] },
  reason: { marginTop: space[1] },
  badge: { marginStart: space[2], flexShrink: 0 },
});
