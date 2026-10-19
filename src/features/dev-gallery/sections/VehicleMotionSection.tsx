import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import SafeMapView from '../../../components/SafeMapView';
import { AppText, RouteLine, VEHICLE_MARKER_KINDS, VehicleMarker, VehicleMarkerGlyph } from '../../../components/ui';
import { t } from '../../../i18n';
import { radius, space } from '../../../theme';
import {
  GALLERY_LIVE_INTERVAL_MS,
  galleryBlockLoop,
  galleryLivePositions,
  galleryLiveRegion,
  galleryLiveVehicles,
} from '../fixtures/rideFixtures';
import { GallerySection } from './GallerySection';

const MAP_FRAME_HEIGHT = 420;

/**
 * T-517 evidence: the bike, rickshaw and car driving around a block from noisy fixture updates
 * every GALLERY_LIVE_INTERVAL_MS. They snap to the cased route, turn the corners with the road
 * and glide between updates (Reduce Motion: they jump). Below, the top-down glyphs in the
 * current map style (T-586: all six react-native-svg kinds) and the assigned look with its halo.
 * One interval, cleared on unmount.
 */
export function VehicleMotionSection() {
  const { theme } = useAppTheme();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(n => n + 1), GALLERY_LIVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
  const count = galleryLivePositions.length;
  return (
    <GallerySection title={t('kitGallery.sectionLiveVehicles')} hint={t('kitGallery.liveVehiclesHint')} testID="gallery-ride-live">
      <View style={[styles.map, { borderColor: theme.colors.border }]}>
        <SafeMapView style={StyleSheet.absoluteFill} initialRegion={galleryLiveRegion} customMapStyle={theme.mapStyle}>
          <RouteLine coordinates={galleryBlockLoop} drawOn={false} />
          {galleryLiveVehicles.map(v => (
            <VehicleMarker
              key={v.id}
              testID={`gallery-live-${v.id}`}
              vehicleType={v.vehicleType}
              coordinate={galleryLivePositions[(tick + v.offset) % count]}
              route={galleryBlockLoop}
              updateIntervalMs={GALLERY_LIVE_INTERVAL_MS}
              title={t(`kitGallery.liveVehicle_${v.id}`)}
            />
          ))}
        </SafeMapView>
      </View>
      <View style={[styles.tile, { backgroundColor: theme.colors.surfaceAlt }]}>
        {VEHICLE_MARKER_KINDS.map(kind => (
          <View key={kind} style={styles.glyph}>
            <VehicleMarkerGlyph vehicleType={kind} testID={`gallery-glyph-${kind}`} />
            <AppText variant="caption" color="textSecondary">
              {t(`kitGallery.liveVehicle_${kind}`)}
            </AppText>
          </View>
        ))}
        <View style={styles.glyph}>
          <VehicleMarkerGlyph vehicleType="car" assigned />
          <AppText variant="caption" color="textSecondary">
            {t('kitGallery.liveVehicleAssigned')}
          </AppText>
        </View>
      </View>
    </GallerySection>
  );
}

const styles = StyleSheet.create({
  map: { height: MAP_FRAME_HEIGHT, borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  tile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    padding: space[4],
    borderRadius: radius.lg,
    gap: space[3],
  },
  glyph: { alignItems: 'center', gap: space[1] },
});
