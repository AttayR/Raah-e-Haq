import React from 'react';
import { Circle } from 'react-native-maps';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import type { LatLng } from '../../../features/driver-requests/api';

/** map-vehicles.md §7.3: fill `primary` 6 %, stroke 1 pt `primary` 24 % dashed 6/4. */
export const PICKUP_CIRCLE = { fillAlpha: 0.06, strokeAlpha: 0.24, strokeWidth: 1, dash: [6, 4] } as const;

/** `#rrggbb` with an alpha suffix (`#rrggbbaa`); any other colour is returned as is. */
export const withAlpha = (color: string, alpha: number): string =>
  /^#[0-9a-f]{6}$/i.test(color)
    ? `${color}${Math.round(Math.min(1, Math.max(0, alpha)) * 255)
        .toString(16)
        .padStart(2, '0')}`
    : color;

type Props = {
  center: LatLng;
  /** The driver's auto-accept max pickup distance (server value). */
  radiusKm: number;
};

/**
 * The real max-pickup circle while auto-accept is on (T-587, §7.3), centred on the driver's
 * vehicle. Decorative: the camera never refits for it.
 */
export function PickupRangeCircle({ center, radiusKm }: Props) {
  const { theme } = useAppTheme();
  const primary = theme.colors.primary;
  return (
    <Circle
      center={center}
      radius={radiusKm * 1000}
      fillColor={withAlpha(primary, PICKUP_CIRCLE.fillAlpha)}
      strokeColor={withAlpha(primary, PICKUP_CIRCLE.strokeAlpha)}
      strokeWidth={PICKUP_CIRCLE.strokeWidth}
      lineDashPattern={[...PICKUP_CIRCLE.dash]}
      testID="drive-pickup-circle"
    />
  );
}
