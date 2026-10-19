import React from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { PromoCard } from '../../../components/ui/PromoCard';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { layout, space } from '../../../theme';
import type { HomeOffer } from '../types';

type Props = { offers: HomeOffer[]; onPressOffer?: (offer: HomeOffer) => void };

/** Max card width so tablets and landscape keep a readable card. */
const MAX_CARD_WIDTH = 360;

/**
 * Promo cards (DESIGN_SYSTEM 5.30, image-less variant; UI-R21 §1.7 M5 kit PromoCard): card width
 * = window − 48 so the next card peeks, horizontal snap. Hidden when there are no offers.
 */
export const OffersRow: React.FC<Props> = ({ offers, onPressOffer }) => {
  const { width } = useWindowDimensions();
  if (offers.length === 0) return null;
  const cardWidth = Math.min(width - layout.gutter * 3, MAX_CARD_WIDTH);

  return (
    <View style={styles.section} testID="home-offers">
      <View style={styles.header}>
        <SectionHeader title="Offers" />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + space[3]}
        decelerationRate="fast"
        contentContainerStyle={styles.track}
      >
        {offers.map((offer) => (
          <PromoCard
            key={offer.id}
            kind="promo"
            title={offer.title}
            description={offer.description}
            meta={`Valid until ${offer.validUntil}`}
            accessibilityLabel={`${offer.title}. ${offer.description}`}
            onPress={onPressOffer ? () => onPressOffer(offer) : undefined}
            style={{ width: cardWidth }}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  section: { gap: space[2] },
  header: { paddingHorizontal: layout.gutter },
  track: { paddingHorizontal: layout.gutter, gap: space[3] },
});

export default OffersRow;
