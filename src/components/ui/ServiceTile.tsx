import React, { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { borderWidth, componentTokens, radius, space } from '../../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { usePressScale } from './usePressScale';

/** Disc colour: `primary` (navy disc, `onPrimary` glyph) or `accent` (saffron disc, `onAccent` glyph). */
export type ServiceTileTone = 'primary' | 'accent';

export type ServiceTileProps = {
  icon: IconName;
  /** One line (`h3`). */
  title: string;
  /** Up to two lines (`bodySmall`, `textSecondary`); never truncated with the shipped copy. */
  subtitle: string;
  tone?: ServiceTileTone;
  /**
   * The service the field under the row books (Ride on passenger Home): `primarySoft` fill and a
   * 2pt `primary` border. Not a toggle: it does not move when another tile is pressed.
   */
  active?: boolean;
  onPress: () => void;
  /** The tile's full spoken name (not title + subtitle concatenated). */
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** Kit gallery only: draws the pressed fill without a touch. */
  previewPressed?: boolean;
  testID?: string;
};

const k = componentTokens.serviceTile;

/**
 * Service tile (DESIGN_SYSTEM §8.3 [UI-R20], passenger-home § Services S2/S3): radius `lg`, a 2pt
 * border on every tile (the inactive border equals its fill, so all tiles share one geometry),
 * 12 from the outer edge to the content, no shadow. Line 1: a 44 icon disc with a 28 glyph, 12,
 * the title; 8 below it the subtitle, start-aligned with the disc. 96 high at 1.0× text. Tiles
 * in a row stretch to the tallest one. Press: pressed fill and the 0.98 scale (§6.1, UI thread);
 * Reduce Motion: fill only. No haptic (not a commit, §6.11). Memoised: props are strings and
 * booleans, so a sheet drag or a map move never re-renders it.
 */
function ServiceTileBase({
  icon,
  title,
  subtitle,
  tone = 'primary',
  active = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  previewPressed = false,
  testID,
}: ServiceTileProps) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const [pressed, setPressed] = useState(false);
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const down = pressed || previewPressed;
  const fill = active ? (down ? c.primarySoftPressed : c.primarySoft) : down ? c.surfaceAltPressed : c.surfaceAlt;
  const border = active ? c.primary : fill;
  const accent = tone === 'accent';

  const pressIn = useCallback(() => {
    setPressed(true);
    onPressIn();
  }, [onPressIn]);
  const pressOut = useCallback(() => {
    setPressed(false);
    onPressOut();
  }, [onPressOut]);

  return (
    <Animated.View style={[styles.wrap, animatedStyle]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[styles.tile, { backgroundColor: fill, borderColor: border }]}
      >
        <View style={styles.line}>
          <View
            style={[styles.disc, { backgroundColor: accent ? c.accent : c.primary }]}
            testID={testID ? `${testID}-disc` : undefined}
          >
            <Icon name={icon} size={28} color={accent ? 'onAccent' : 'onPrimary'} />
          </View>
          <AppText variant="h3" numberOfLines={1} style={styles.title}>
            {title}
          </AppText>
        </View>
        <AppText variant="bodySmall" color="textSecondary" numberOfLines={2} style={styles.subtitle}>
          {subtitle}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

export const ServiceTile = memo(ServiceTileBase);

const styles = StyleSheet.create({
  wrap: { flex: 1, minWidth: 0 },
  tile: {
    flexGrow: 1,
    borderRadius: radius.lg,
    borderWidth: borderWidth.focus,
    // 12 from the outer edge: the 2pt border plus 10 inside it.
    padding: k.padding - borderWidth.focus,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: k.gap },
  disc: {
    width: k.disc,
    height: k.disc,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, minWidth: 0 },
  subtitle: { marginTop: space[2] },
});

export default ServiceTile;
