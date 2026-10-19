import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ServiceTile } from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, space } from '../../../theme';
import { GallerySection } from './GallerySection';

const noop = () => {};

/**
 * UI-R20 ServiceTile (DESIGN_SYSTEM §8.3, passenger-home § Services S2/S3): the Home service row
 * (Ride active + Parcel), both pressed fills, and a two-line subtitle in a narrow tile. Light and
 * dark come from the gallery's appearance.
 */
export function ServiceTileSection() {
  return (
    <GallerySection title={t('kitGallery.sectionServiceTiles')} hint={t('kitGallery.serviceTileHint')} testID="gallery-service-tiles">
      <View style={styles.row}>
        <ServiceTile
          icon="rides"
          tone="primary"
          active
          title={t('home.serviceRideTitle')}
          subtitle={t('home.serviceRideSub')}
          accessibilityLabel={t('home.serviceRideA11y')}
          onPress={noop}
          testID="gallery-service-ride"
        />
        <ServiceTile
          icon="parcel"
          tone="accent"
          title={t('home.serviceParcelTitle')}
          subtitle={t('home.serviceParcelSub')}
          accessibilityLabel={t('home.serviceParcelA11y')}
          onPress={noop}
          testID="gallery-service-parcel"
        />
      </View>
      <View style={styles.row}>
        <ServiceTile
          icon="rides"
          tone="primary"
          active
          previewPressed
          title={t('home.serviceRideTitle')}
          subtitle={t('kitGallery.serviceTilePressed')}
          accessibilityLabel={t('home.serviceRideA11y')}
          onPress={noop}
        />
        <ServiceTile
          icon="parcel"
          tone="accent"
          previewPressed
          title={t('home.serviceParcelTitle')}
          subtitle={t('kitGallery.serviceTilePressed')}
          accessibilityLabel={t('home.serviceParcelA11y')}
          onPress={noop}
        />
      </View>
      <View style={styles.row}>
        <ServiceTile
          icon="parcel"
          tone="accent"
          title={t('home.serviceParcelTitle')}
          subtitle={t('kitGallery.serviceTileLongSub')}
          accessibilityLabel={t('home.serviceParcelA11y')}
          onPress={noop}
          testID="gallery-service-two-lines"
        />
        {/* Half a row wide, like a Home tile, so the longer subtitle wraps. */}
        <View style={styles.spacer} />
      </View>
    </GallerySection>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', gap: componentTokens.serviceTile.rowGap, marginBottom: space[2] },
  spacer: { flex: 1 },
});
