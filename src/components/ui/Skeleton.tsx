import React, { useEffect, useState } from 'react';
import { I18nManager, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { t } from '../../i18n';
import { componentTokens, motionPatterns, radius, space, textStyles, type TextStyleName } from '../../theme';
import { toEasing } from './easing';

export type SkeletonShape = 'text' | 'pill' | 'card' | 'block';

export type SkeletonProps = {
  width?: DimensionValue;
  /** Explicit height; `text` blocks default to the text style's line height − 6. */
  height?: number;
  /** `text` (radius 8), `pill` (avatars, chips), `card` (radius 16) or `block` (radius 12). */
  shape?: SkeletonShape;
  /** Text style a `text` block stands in for (height = its line height − 6). Default `body`. */
  textVariant?: TextStyleName;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const radiusFor: Record<SkeletonShape, number> = {
  text: radius.sm,
  pill: radius.pill,
  card: radius.lg,
  block: radius.md,
};

const shimmer = motionPatterns.skeletonShimmer;
/** Opacity of each fifth of the shimmer band: soft edges, full in the middle. */
const BAND_STEPS = [0.25, 0.6, 1, 0.6, 0.25];
const shimmerEasing = toEasing(shimmer.easing);

/**
 * Skeleton block (DESIGN_SYSTEM §5.18): `surfaceAlt` fill with a `skeletonHighlight` band 40% wide
 * sweeping start→end in 1200 ms, linear, forever. Reduced motion: static blocks, no shimmer.
 * Decorative: wrap a screen's skeleton in `SkeletonGroup`, which carries the "Loading" label.
 */
export function Skeleton({ width = '100%', height, shape = 'text', textVariant = 'body', style, testID }: SkeletonProps) {
  const { theme } = useAppTheme();
  const reduce = useReducedMotion();
  const [blockWidth, setBlockWidth] = useState(0);
  const progress = useSharedValue(0);
  const animate = !reduce && blockWidth > 0;

  useEffect(() => {
    if (!animate) {
      return undefined;
    }
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, { duration: shimmer.duration, easing: shimmerEasing }), -1, false);
    return () => cancelAnimation(progress);
  }, [animate, progress]);

  const band = blockWidth * shimmer.bandWidthRatio;
  // The band is anchored at `start`; in RTL it sweeps the other way (reading direction).
  const direction = I18nManager.isRTL ? -1 : 1;
  const bandStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: direction * (-band + progress.value * (blockWidth + band)) }],
  }));

  const resolvedHeight = height ?? textStyles[textVariant].lineHeight - componentTokens.skeleton.textInset;
  return (
    <View
      testID={testID}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      onLayout={event => setBlockWidth(event.nativeEvent.layout.width)}
      style={[
        styles.block,
        { width, height: resolvedHeight, borderRadius: radiusFor[shape], backgroundColor: theme.colors.surfaceAlt },
        style,
      ]}
    >
      {animate ? (
        <Animated.View
          testID={testID ? `${testID}-shimmer` : undefined}
          style={[styles.band, { width: band }, bandStyle]}
        >
          {/* Five stepped bands fake a soft gradient highlight without a gradient library. */}
          {BAND_STEPS.map((opacity, i) => (
            <View key={i} style={[styles.bandStep, { opacity, backgroundColor: theme.colors.skeletonHighlight }]} />
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Wraps a skeleton layout: one "Loading" element for screen readers, busy state, testID. */
export function SkeletonGroup({
  children,
  style,
  testID,
  accessibilityLabel,
}: React.PropsWithChildren<{ style?: StyleProp<ViewStyle>; testID?: string; accessibilityLabel?: string }>) {
  return (
    <View
      testID={testID}
      style={style}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? t('kit.loadingA11y')}
      accessibilityState={{ busy: true }}
    >
      {children}
    </View>
  );
}

/** Lines of text; the last one is shorter so a paragraph reads as a paragraph. */
export function SkeletonText({
  lines = 2,
  textVariant = 'body',
  lastLineWidth = '60%',
}: {
  lines?: number;
  textVariant?: TextStyleName;
  lastLineWidth?: DimensionValue;
}) {
  const gap = componentTokens.skeleton.textInset;
  return (
    <View style={{ gap }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} textVariant={textVariant} width={i === lines - 1 && lines > 1 ? lastLineWidth : '100%'} />
      ))}
    </View>
  );
}

/**
 * Skeleton of a ListItem with the same height as the real row (72 two-line, 56 one-line) so
 * nothing jumps when content arrives. `leading`: 40 tile, Avatar circle or none.
 */
export function SkeletonListItem({
  leading = 'tile',
  lines = 2,
}: {
  leading?: 'tile' | 'avatar' | 'none';
  lines?: 1 | 2;
}) {
  const k = componentTokens.listItem;
  return (
    <View style={[styles.row, { minHeight: lines === 2 ? k.minHeight.two : k.minHeight.one }]}>
      {leading !== 'none' ? (
        <Skeleton width={k.tile} height={k.tile} shape={leading === 'avatar' ? 'pill' : 'block'} />
      ) : null}
      <View style={styles.rowText}>
        <Skeleton width="70%" textVariant="body" />
        {lines === 2 ? <Skeleton width="45%" textVariant="bodySmall" /> : null}
      </View>
    </View>
  );
}

/**
 * Loading state of a list screen (§12.6): `rows` skeleton rows, optionally under a card-shaped
 * hero (balance, earnings), inside one "Loading" element.
 */
export function SkeletonList({
  rows = 6,
  leading = 'tile',
  heroHeight,
  testID,
}: {
  rows?: number;
  leading?: 'tile' | 'avatar' | 'none';
  /** Height of a hero card above the rows (e.g. the wallet balance card). */
  heroHeight?: number;
  testID?: string;
}) {
  return (
    <SkeletonGroup testID={testID} style={styles.list}>
      {heroHeight ? <SkeletonCard height={heroHeight} style={styles.hero} /> : null}
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonListItem key={i} leading={leading} />
      ))}
    </SkeletonGroup>
  );
}

/** A card-shaped placeholder of a given height (content cards, hero cards). */
export function SkeletonCard({ height = 120, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  return <Skeleton shape="card" height={height} style={style} />;
}

const styles = StyleSheet.create({
  block: { overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, start: 0, flexDirection: 'row' },
  bandStep: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[4],
  },
  // Same rhythm as SkeletonText: inset 6 + 2.
  rowText: { flex: 1, gap: componentTokens.skeleton.textInset + 2 },
  list: { paddingTop: space[2] },
  hero: { marginHorizontal: space[4], marginBottom: space[3] },
});
