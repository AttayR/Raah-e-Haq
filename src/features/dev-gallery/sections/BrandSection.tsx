import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, BrandBar, FareTag, PromoCard } from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, radius, space } from '../../../theme';
import { GallerySection } from './GallerySection';

const noop = () => {};

/**
 * UI-R21 brand moments (DESIGN_SYSTEM §1.7): BrandBar on the money hero fill and on the page,
 * FareTag in both kinds, and the image-less promo and invite cards. Light and dark come from the
 * gallery's appearance; the copy is gallery-only sample text.
 */
export function BrandSection() {
  const { theme } = useAppTheme();
  return (
    <GallerySection title={t('kitGallery.sectionBrand')} hint={t('kitGallery.brandHint')} testID="gallery-brand">
      <View style={[styles.hero, { backgroundColor: theme.colors.heroFill }]}>
        <BrandBar style={styles.heroBar} testID="gallery-brand-bar-hero" />
        <AppText variant="caption" color="heroTextMuted">
          {t('kitGallery.brandHeroLabel')}
        </AppText>
      </View>
      <BrandBar testID="gallery-brand-bar-page" />
      <View style={styles.row}>
        <FareTag kind="fixed" testID="gallery-fare-tag-fixed" />
        <FareTag kind="offer" testID="gallery-fare-tag-offer" />
      </View>
      <PromoCard
        kind="promo"
        title={t('kitGallery.brandPromoTitle')}
        description={t('kitGallery.brandPromoBody')}
        onPress={noop}
        testID="gallery-promo-card"
      />
      <PromoCard
        kind="invite"
        title={t('kitGallery.brandInviteTitle')}
        description={t('kitGallery.brandInviteBody')}
        onPress={noop}
        testID="gallery-invite-card"
      />
    </GallerySection>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.lg, padding: space[5] },
  heroBar: { marginBottom: componentTokens.brand.barGapHero },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
