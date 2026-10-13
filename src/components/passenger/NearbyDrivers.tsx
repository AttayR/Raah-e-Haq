import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MAPS_CONFIG from '../../config/mapsConfig';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { VehicleMarker } from '../ui/VehicleMarker';
import type { NearbyDriver } from '../../services/rideService';
import { MAX_FONT_SIZE_MULTIPLIER, radius, space, textStyles } from '../../theme';
import type { NearbyDriversState } from '../../hooks/useNearbyDrivers';

/** Marker callout text. Rating 0 means unrated, so it is left out. */
export const nearbyDriverDescription = (driver: NearbyDriver): string =>
  [
    driver.vehicle_type,
    driver.rating > 0 ? `${driver.rating.toFixed(1)}★` : null,
    `~${driver.estimated_arrival_min} min`,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');

/**
 * Map markers for GET /rides/nearby-drivers (DESIGN_SYSTEM 5.21): each driver's vehicle type drawn
 * top-down at 60% (T-517), not generic pins and not animated. Keys are the opaque per-viewer ids
 * (BE-20). The endpoint sends no heading, so they face north.
 */
export const NearbyDriverMarkers: React.FC<{ drivers: NearbyDriver[] }> = ({ drivers }) => (
  <>
    {drivers.map(driver => (
      <VehicleMarker
        key={driver.id}
        testID={`nearby-driver-${driver.id}`}
        coordinate={driver.location}
        title={MAPS_CONFIG.MARKERS.driver.title}
        description={nearbyDriverDescription(driver)}
        vehicleType={driver.vehicle_type}
        muted
      />
    ))}
  </>
);

const statusText = (state: NearbyDriversState): string | null => {
  if (state.status === 'loading') return 'Finding drivers nearby…';
  if (state.status === 'error') return state.error ?? 'Could not load nearby drivers.';
  if (state.status === 'ready') {
    const n = state.drivers.length;
    if (n === 0) return 'No drivers nearby right now';
    return n === 1 ? '1 driver nearby' : `${n} drivers nearby`;
  }
  return null;
};

/** Loading / error / empty / count line for the nearby drivers on the map. */
export const NearbyDriversStatus: React.FC<{ state: NearbyDriversState }> = ({ state }) => {
  const { theme } = useAppTheme();
  const text = statusText(state);
  if (!text) return null;
  const color = state.status === 'error' ? theme.colors.danger : theme.colors.textPrimary;
  return (
    <View
      testID="nearby-drivers-status"
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      style={[styles.chip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
    >
      {state.status === 'loading' && <ActivityIndicator size="small" color={theme.colors.primaryText} />}
      <Text style={[styles.text, { color }]} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}>
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: 32,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { ...textStyles.label, flexShrink: 1 },
});
