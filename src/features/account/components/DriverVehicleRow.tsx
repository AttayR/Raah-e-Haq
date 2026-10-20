import React from 'react';
import { Badge, ListGroup, ListItem, vehicleIconName } from '../../../components/ui';
import { t } from '../../../i18n';
import { vehicleGlyph } from '../../driver-profile/components/VehicleCard';
import type { DriverVehicle } from '../../driver-profile/types';
import { documentsNeedAction } from '../rules';

type Props = {
  /** GET /profile/documents vehicles; null while not loaded (the row then names the screen). */
  vehicles: DriverVehicle[] | null;
  vehicleType: string | null | undefined;
  licenceExpiry: string | null | undefined;
  onPress: () => void;
};

/** The vehicle the Profile names: the first approved one, else the first on file. */
export const profileVehicle = (vehicles: ReadonlyArray<DriverVehicle> | null): DriverVehicle | null =>
  vehicles?.find((vehicle) => vehicle.status === 'approved') ?? vehicles?.[0] ?? null;

/**
 * Driver Profile "Vehicle" (shared-profile §P5): one row to Vehicle & documents with the vehicle
 * glyph, "{make} {model}" and the plate. No licence number or expiry here (Vehicle & documents
 * shows them masked, UI-R17). "Action needed" replaces the chevron when anything was rejected or
 * the licence has expired.
 */
export function DriverVehicleRow({ vehicles, vehicleType, licenceExpiry, onPress }: Props) {
  const vehicle = profileVehicle(vehicles);
  const title = (vehicle && [vehicle.make, vehicle.model].filter(Boolean).join(' ')) || t('profile.vehicleFallback');
  const plate = vehicle?.licensePlate ?? undefined;
  const needsAction = documentsNeedAction(vehicles, licenceExpiry);
  const icon = vehicle ? vehicleGlyph(vehicle, vehicles?.length ?? 1, vehicleType) : vehicleIconName(vehicleType);
  return (
    <ListGroup title={t('profile.vehicleGroup')} testID="driver-profile-vehicle">
      <ListItem
        icon={icon}
        title={title}
        subtitle={plate}
        trailing={needsAction ? <Badge tone="warning" label={t('account.documentsAction')} /> : undefined}
        chevron={!needsAction}
        accessibilityLabel={[title, plate, needsAction ? t('account.documentsAction') : null].filter(Boolean).join(', ')}
        onPress={onPress}
        testID="driver-profile-vehicle-row"
      />
    </ListGroup>
  );
}
