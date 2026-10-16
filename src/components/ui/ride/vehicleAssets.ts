import type { ImageSourcePropType } from 'react-native';
import type { ColorMode } from '../../../theme';

/**
 * Top-down vehicle marker art (T-517, §5.21): one north-up PNG per vehicle kind and map style,
 * @1x/@2x/@3x, made by `scripts/generate-vehicle-markers.js` from the theme tokens. Rerun the
 * script after a token change (a test fails until then).
 */
export type VehicleMarkerKind = 'car' | 'bike' | 'rickshaw';

export const VEHICLE_MARKER_KINDS: ReadonlyArray<VehicleMarkerKind> = ['car', 'bike', 'rickshaw'];

const SOURCES: Record<VehicleMarkerKind, Record<ColorMode, ImageSourcePropType>> = {
  car: {
    light: require('../../../assets/vehicles/car-light.png'),
    dark: require('../../../assets/vehicles/car-dark.png'),
  },
  bike: {
    light: require('../../../assets/vehicles/bike-light.png'),
    dark: require('../../../assets/vehicles/bike-dark.png'),
  },
  rickshaw: {
    light: require('../../../assets/vehicles/rickshaw-light.png'),
    dark: require('../../../assets/vehicles/rickshaw-dark.png'),
  },
};

/**
 * The marker kind for a backend vehicle type key (`car`, `bike`, `rickshaw`, `van`; see
 * VEHICLE_TYPE_KEYS). `van` and anything unknown or missing draw the car.
 */
export const vehicleMarkerKind = (vehicleType: string | null | undefined): VehicleMarkerKind => {
  const key = typeof vehicleType === 'string' ? vehicleType.trim().toLowerCase() : '';
  // BE-88: a parcel delivery is carried by bike.
  if (key === 'parcel') return 'bike';
  return key === 'bike' || key === 'rickshaw' ? key : 'car';
};

export const vehicleMarkerSource = (kind: VehicleMarkerKind, mode: ColorMode): ImageSourcePropType =>
  SOURCES[kind][mode];
