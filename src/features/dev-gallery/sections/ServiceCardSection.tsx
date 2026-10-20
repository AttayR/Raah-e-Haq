import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip, ServiceCard } from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, space } from '../../../theme';
import { GallerySection } from './GallerySection';

const noop = () => {};

/**
 * UI-R20b ServiceCard (passenger-home V2) and the Chip variants (V5): the Home service row (Ride
 * and Parcel, equal entry points), both pressed fills, then the outline chips Home uses next to
 * the filled default. Light and dark come from the gallery's appearance.
 */
export function ServiceCardSection() {
  return (
    <GallerySection title={t('kitGallery.sectionServiceCards')} hint={t('kitGallery.serviceCardHint')} testID="gallery-service-cards">
      <View style={styles.row}>
        <ServiceCard
          kind="ride"
          title={t('home.serviceRideTitle')}
          accessibilityLabel={t('home.serviceRideA11y')}
          onPress={noop}
          testID="gallery-service-ride"
        />
        <ServiceCard
          kind="parcel"
          title={t('home.serviceParcelTitle')}
          accessibilityLabel={t('home.serviceParcelA11y')}
          onPress={noop}
          testID="gallery-service-parcel"
        />
      </View>
      <View style={styles.row}>
        <ServiceCard kind="ride" previewPressed title={t('home.serviceRideTitle')} accessibilityLabel={t('home.serviceRideA11y')} onPress={noop} />
        <ServiceCard kind="parcel" previewPressed title={t('home.serviceParcelTitle')} accessibilityLabel={t('home.serviceParcelA11y')} onPress={noop} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip variant="outline" icon="home" label={t('kitGallery.chipHome')} onPress={noop} />
        <Chip variant="outline" icon="add" tone="primary" label={t('savedPlaces.addShort')} onPress={noop} />
        <Chip variant="outline" icon="locationOff" iconColor="warning" label={t('home.turnOnLocation')} onPress={noop} />
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip icon="home" label={t('kitGallery.chipHome')} onPress={noop} />
        <Chip icon="add" tone="primary" label={t('savedPlaces.addShort')} onPress={noop} />
        <Chip icon="work" label={t('kitGallery.chipWork')} onPress={noop} />
      </ScrollView>
    </GallerySection>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', gap: componentTokens.serviceCard.rowGap, marginBottom: space[2] },
  chips: { flexDirection: 'row', gap: space[2], marginBottom: space[2] },
});
