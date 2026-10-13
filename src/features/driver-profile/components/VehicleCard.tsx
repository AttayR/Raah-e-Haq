import React from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '../../../theme';
import { Badge, ListGroup, ListItem, SkeletonText, vehicleIconName } from '../../../components/ui';
import type { RemoteData } from '../../../core/api/useRemoteData';
import { DRIVER_PROFILE_COPY as COPY } from '../copy';
import { vehiclePlate, vehicleStatusBadge, vehicleTitle } from '../format';
import type { DriverVehicle } from '../types';

type Props = {
  vehicles: RemoteData<DriverVehicle[]>;
  /** The account's vehicle type (profile `vehicle_type`): picks the row glyph. */
  vehicleType?: string | null;
  testID?: string;
};

/**
 * "Vehicle" group (T-507, T-514): each registered vehicle as make + model, plate and its review
 * status, from GET /profile/documents. Loading shows a skeleton row, a failure a retry row, and
 * no vehicle says so; nothing is invented.
 */
export function VehicleCard({ vehicles, vehicleType, testID = 'driver-vehicle' }: Props) {
  const { data, status, reload } = vehicles;
  const icon = vehicleIconName(vehicleType);

  let rows: React.ReactNode;
  if (!data && status === 'failed') {
    rows = (
      <ListItem
        icon="warning"
        title={COPY.vehicleFailed}
        value={COPY.retry}
        onPress={reload}
        accessibilityLabel={`${COPY.vehicleFailed}. ${COPY.retry}`}
        testID={`${testID}-error`}
      />
    );
  } else if (!data) {
    return (
      <ListGroup title={COPY.vehicleGroup} testID={testID}>
        <View style={styles.loading} testID={`${testID}-loading`}>
          <SkeletonText lines={2} />
        </View>
      </ListGroup>
    );
  } else if (data.length === 0) {
    rows = <ListItem icon={icon} title={COPY.noVehicle} testID={`${testID}-empty`} />;
  } else {
    rows = data.map((vehicle) => {
      const badge = vehicleStatusBadge(vehicle);
      return (
        <ListItem
          key={vehicle.id}
          icon={icon}
          title={vehicleTitle(vehicle)}
          subtitle={vehiclePlate(vehicle)}
          trailing={badge ? <Badge tone={badge.tone} label={badge.label} /> : undefined}
          accessibilityLabel={[vehicleTitle(vehicle), vehiclePlate(vehicle), badge?.label].filter(Boolean).join(', ')}
          testID={`${testID}-${vehicle.id}`}
        />
      );
    });
  }

  return (
    <ListGroup title={COPY.vehicleGroup} testID={testID}>
      {rows}
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  loading: { padding: space[4] },
});
