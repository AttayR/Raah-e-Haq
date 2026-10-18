import React, { memo, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { Icon, RideMarker } from '../../../components/ui';
import { MapErrorBoundary } from '../../../components/MapErrorBoundary';
import { t } from '../../../i18n';
import { componentTokens, type MapStyleRule } from '../../../theme';
import type { RidePoint } from '../types';

const m = componentTokens.ride.staticMap;
/**
 * The receipt map has no use for city and district names, and Google centres the city name on
 * the city's point, often right on the pickup pin: hide those labels on this map only.
 */
const RECEIPT_STYLE_EXTRA: MapStyleRule[] = [
  { featureType: 'administrative.locality', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

/** One padding object (a new one per render is a native prop update). */
const MAP_PADDING = { top: m.edgeTop, right: m.edge, bottom: m.edge, left: m.edge };

/** The region that shows every point with some room around it; null without points. */
export const staticMapRegion = (points: ReadonlyArray<RidePoint>): Region | null => {
  if (points.length === 0) return null;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(m.minDelta, (maxLat - minLat) * m.padding),
    longitudeDelta: Math.max(m.minDelta, (maxLng - minLng) * m.padding),
  };
};

type Props = { pickup: RidePoint | null; dropoff: RidePoint | null };

/**
 * UI-R15 (shared-ride-details §1): the receipt's map, 180pt, full width, non-interactive (lite
 * mode on Android; no scroll, zoom, pitch or rotate on iOS; touches pass through), with the
 * pickup and drop-off pins, styled for the theme. One map, no extra requests: it uses the
 * points the ride already carries and draws no route (the ride has no stored route geometry).
 * Without points: a `surfaceAlt` block with the map glyph.
 */
export const RideStaticMap = memo(function RideStaticMap({ pickup, dropoff }: Props) {
  const { theme } = useAppTheme();
  const mapStyle = useMemo(() => [...theme.mapStyle, ...RECEIPT_STYLE_EXTRA], [theme.mapStyle]);
  const region = useMemo(
    () => staticMapRegion([pickup, dropoff].filter((p): p is RidePoint => p !== null)),
    [pickup, dropoff],
  );
  const fallback = (
    <View
      style={[styles.map, styles.fallback, { backgroundColor: theme.colors.surfaceAlt }]}
      accessible
      accessibilityLabel={t('ride.mapUnavailable')}
      testID="ride-details-map-fallback"
    >
      <Icon name="map" size={32} color="textMuted" />
    </View>
  );
  if (!region) return fallback;
  return (
    <View
      style={[styles.map, { backgroundColor: theme.mapBackground }]}
      pointerEvents="none"
      accessible
      accessibilityLabel={t('ride.routeMapA11y')}
      testID="ride-details-map"
    >
      <MapErrorBoundary fallback={fallback}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          customMapStyle={mapStyle}
          userInterfaceStyle={theme.mode}
          liteMode={Platform.OS === 'android'}
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          toolbarEnabled={false}
          showsPointsOfInterests={false}
          showsBuildings={false}
          showsCompass={false}
          loadingEnabled={false}
          moveOnMarkerPress={false}
          mapPadding={MAP_PADDING}
        >
          {pickup ? <RideMarker kind="pickup" coordinate={pickup} testID="ride-details-map-pickup" /> : null}
          {dropoff ? <RideMarker kind="dropoff" coordinate={dropoff} testID="ride-details-map-dropoff" /> : null}
        </MapView>
      </MapErrorBoundary>
    </View>
  );
});

const styles = StyleSheet.create({
  map: { width: '100%', height: m.height, overflow: 'hidden' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
