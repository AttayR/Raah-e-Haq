import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { componentTokens, type SemanticColorName } from '../../theme';
import { Icon, type IconName } from './Icon';

const k = componentTokens.illustration;

/** The small badge on the disc: saffron (the brand accent) or `dangerFill` for a refusal. */
export type IllustrationBadgeTone = 'accent' | 'danger';

const badgeTones: Record<IllustrationBadgeTone, { fill: SemanticColorName; glyph: SemanticColorName }> = {
  accent: { fill: 'accent', glyph: 'onAccent' },
  danger: { fill: 'dangerFill', glyph: 'onPrimary' },
};

export type IllustrationProps = {
  /** Main glyph (64, `onPrimarySoft`) on the 128 `primarySoft` disc. */
  icon: IconName;
  /** Optional 48 badge on the bottom-end of the disc (clock, cross, pin). */
  badge?: { icon: IconName; tone?: IllustrationBadgeTone };
  /** `compact` (120 box, 96 disc, 48 glyph, 36 badge) for short windows (iPhone SE). */
  size?: 'regular' | 'compact';
  /** Colour behind the illustration, used for the badge ring. Default `background`. */
  ring?: SemanticColorName;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Duotone illustration (DESIGN_SYSTEM §4 "Illustrations", UI-R8): navy glyph on a navy-50 disc with
 * an optional saffron badge, built from MDI glyphs so it follows the theme and needs no bitmap.
 * Used only on account status, permission prompts and state screens. Decorative: hidden from
 * screen readers (the title next to it carries the meaning).
 */
export function Illustration({ icon, badge, size = 'regular', ring: ringColor = 'background', style, testID }: IllustrationProps) {
  const { theme } = useAppTheme();
  const compact = size === 'compact';
  const box = compact ? k.compactBox : k.box;
  const disc = compact ? k.compactDisc : k.disc;
  const tone = badgeTones[badge?.tone ?? 'accent'];
  const ring = compact ? k.compactBadgeRing : k.badgeRing;
  const badgeBox = (compact ? k.compactBadge : k.badge) + ring * 2;
  return (
    <View
      style={[{ width: box, height: box }, styles.box, style]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <View
        style={[
          styles.disc,
          { width: disc, height: disc, borderRadius: disc / 2, backgroundColor: theme.colors.primarySoft },
        ]}
      >
        <Icon name={icon} size={compact ? k.compactGlyph : k.glyph} color="onPrimarySoft" />
      </View>
      {badge ? (
        <View
          testID={testID ? `${testID}-badge` : undefined}
          style={[
            styles.badge,
            {
              width: badgeBox,
              height: badgeBox,
              borderRadius: badgeBox / 2,
              borderWidth: ring,
              backgroundColor: theme.colors[tone.fill],
              borderColor: theme.colors[ringColor],
              // Bottom-end of the disc, overlapping its edge.
              end: (box - disc) / 2 - ring,
              bottom: (box - disc) / 2 - ring,
            },
          ]}
        >
          <Icon name={badge.icon} size={compact ? k.compactBadgeGlyph : k.badgeGlyph} color={tone.glyph} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  disc: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
