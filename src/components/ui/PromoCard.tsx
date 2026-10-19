import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { componentTokens, radius, space } from '../../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

const b = componentTokens.brand;

/** `promo`: an offer (tag glyph). `invite`: the Invite code card (gift glyph). */
export type PromoCardKind = 'promo' | 'invite';

export type PromoCardProps = {
  kind?: PromoCardKind;
  title: string;
  description?: string;
  /** A third, quieter line (e.g. the validity date), `caption` `textMuted`. */
  meta?: string;
  /** Extra content under the text (the invite code row). */
  children?: React.ReactNode;
  /** Without it the card is not pressable. */
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Image-less promo / invite card (DESIGN_SYSTEM §1.7 M5, §5.30, UI-R21): `accentSoft` fill in both
 * modes (`accentSoftPressed` while pressed), a leading 40 `accent` disc with a 24 `onAccent` glyph,
 * then the title (`title` `textPrimary`) and description (`bodySmall` `textSecondary`). The disc is
 * the card's one saffron element; the words never are.
 */
export function PromoCard({
  kind = 'promo',
  title,
  description,
  meta,
  children,
  onPress,
  accessibilityLabel,
  style,
  testID,
}: PromoCardProps) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const content = (
    <>
      <View style={[styles.disc, { backgroundColor: c.accent }]} testID={testID ? `${testID}-disc` : undefined}>
        <Icon name={kind === 'invite' ? 'gift' : 'promo'} size={b.promoGlyph} color="onAccent" />
      </View>
      <View style={styles.text}>
        <AppText variant="title" numberOfLines={2}>
          {title}
        </AppText>
        {description ? (
          <AppText variant="bodySmall" color="textSecondary" numberOfLines={2}>
            {description}
          </AppText>
        ) : null}
        {meta ? (
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {meta}
          </AppText>
        ) : null}
        {children}
      </View>
    </>
  );
  const label = accessibilityLabel ?? [title, description].filter(Boolean).join('. ');

  if (!onPress) {
    return (
      <View testID={testID} accessible accessibilityLabel={label} style={[styles.card, { backgroundColor: c.accentSoft }, style]}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? c.accentSoftPressed : c.accentSoft }, style]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: b.promoMinHeight,
    borderRadius: radius.lg,
    padding: b.promoPadding,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: b.promoGap,
  },
  disc: {
    width: b.promoDisc,
    height: b.promoDisc,
    borderRadius: b.promoDisc / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0, gap: space[1] },
});
