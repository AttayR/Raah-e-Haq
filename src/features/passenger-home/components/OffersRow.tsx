import React from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Icon } from '../../../components/ui/Icon';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText } from '../../../components/ui/AppText';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { layout, radius, saffron, space } from '../../../theme';
import type { HomeOffer } from '../types';

type Props = { offers: HomeOffer[]; onPressOffer?: (offer: HomeOffer) => void };

/** Max card width so tablets and landscape keep a readable card. */
const MAX_CARD_WIDTH = 360;

/**
 * Promo cards (DESIGN_SYSTEM 5.30, image-less variant): card width = window − 48 so the next
 * card peeks, horizontal snap. Hidden when there are no offers.
 */
export const OffersRow: React.FC<Props> = ({ offers, onPressOffer }) => {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  if (offers.length === 0) return null;
  const cardWidth = Math.min(width - layout.gutter * 3, MAX_CARD_WIDTH);
  const dark = theme.mode === 'dark';
  const fill = dark ? theme.colors.surfaceAlt : saffron[50];
  const iconColor = dark ? saffron[500] : saffron[700];

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
          <Pressable
            key={offer.id}
            accessibilityRole="button"
            accessibilityLabel={`${offer.title}. ${offer.description}`}
            disabled={!onPressOffer}
            onPress={() => onPressOffer?.(offer)}
            style={({ pressed }) => [styles.card, { width: cardWidth, backgroundColor: fill }, pressed ? styles.pressed : null]}
          >
            <Icon name="promo" size={24} tint={iconColor} />
            <View style={styles.cardText}>
              <AppText variant="title" numberOfLines={2}>
                {offer.title}
              </AppText>
              <AppText variant="bodySmall" color="textSecondary" numberOfLines={2}>
                {offer.description}
              </AppText>
              <AppText variant="caption" color="textMuted" numberOfLines={1}>
                {`Valid until ${offer.validUntil}`}
              </AppText>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  section: { gap: space[2] },
  header: { paddingHorizontal: layout.gutter },
  track: { paddingHorizontal: layout.gutter, gap: space[3] },
  card: {
    minHeight: 120,
    borderRadius: radius.lg,
    padding: space[4],
    flexDirection: 'row',
    gap: space[3],
  },
  cardText: { flex: 1, gap: space[1] },
  pressed: { opacity: 0.9 },
});

export default OffersRow;
