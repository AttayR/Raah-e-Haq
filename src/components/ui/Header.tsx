import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { t } from '../../i18n';
import { componentTokens, motion, space } from '../../theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';
import type { IconName } from './Icon';

export type HeaderAction = {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
};

export type HeaderProps = {
  /** `standard` (pushed screens), `large` (tab roots), `overlay` (map screens). §5.2 [v1.1]. */
  variant?: 'standard' | 'large' | 'overlay';
  title?: string;
  /** Leading back (or close) button. Omit on tab roots. */
  onBack?: () => void;
  /** `back` (default; chevron on iOS, arrow on Android) or `close` (modal flows). */
  backIcon?: 'back' | 'close';
  backLabel?: string;
  /** Up to two trailing IconButtons (§5.2). Ignored when `trailingText` is set. */
  actions?: HeaderAction[];
  /** One trailing text action ("Mark all read"). */
  trailingText?: { label: string; onPress: () => void; accessibilityLabel?: string; testID?: string };
  /** From `useHeaderScroll()`: fades the hairline in after 4pt and collapses the large title. */
  scrollY?: SharedValue<number>;
  /** Bar fill: `surface` (default) or `background`, matching the screen until scrolled. */
  tone?: 'surface' | 'background';
  /**
   * `large` only (UI-R15): the `h1` title sits in the 56 bar itself instead of under an empty bar,
   * and does not collapse. For tab roots whose controls (segments, filters) stay pinned under the
   * header, so the content starts high on the first screen.
   */
  inlineTitle?: boolean;
  /** Overlay only: top of the floating controls. Default `insets.top + 8`. */
  overlayTop?: number;
  /** The back button gets `${testID}-back`. */
  testID?: string;
};

const h = componentTokens.header;

/**
 * Scroll state for a Header: pass `scrollY` to the Header and `onScroll` to `Screen scroll` (or
 * any Reanimated `Animated.ScrollView` / `Animated.FlatList`).
 */
export function useHeaderScroll() {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.value = event.contentOffset.y;
    },
  });
  return { scrollY, onScroll };
}

/** Large-title height (h1 line height + 4 top + 8 bottom) used for the collapse range. */
export const LARGE_TITLE_COLLAPSE = 34 + h.largeTitleTop + space[2];

const clamp01 = (v: number) => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};

/** Opacity of the collapsed bar title: 0 until 60% of the collapse range, 1 once past it. */
export const barTitleOpacity = (scrollY: number): number => {
  'worklet';
  const start = LARGE_TITLE_COLLAPSE * 0.6;
  return clamp01((scrollY - start) / (LARGE_TITLE_COLLAPSE - start));
};

/** Opacity of the large `h1` title: fades out across the collapse range. */
export const largeTitleOpacity = (scrollY: number): number => {
  'worklet';
  return clamp01(1 - scrollY / LARGE_TITLE_COLLAPSE);
};

/**
 * The one Header (DESIGN_SYSTEM §5.2 v1.1, §8.2):
 * - `standard`: 56 bar, back at x=4 (glyph edge at 16), title `title` left-aligned at x=56 on both
 *   platforms, ≤2 trailing IconButtons or one text action; bottom hairline fades in on scroll.
 * - `large`: 56 bar with no title until scrolled; the `h1` title sits at x=16, 4 below the bar.
 *   Without `scrollY` the large title is static. With it, the screen puts `<HeaderLargeTitle>`
 *   as the first scroll child and the bar title fades in as that scrolls under the bar
 *   (iOS large-title behaviour, same on Android).
 * - `overlay`: no bar; a floating back/close at x=16, y=insets.top+8 and an optional floating
 *   trailing action. Never an opaque band behind the status bar on a map.
 * The Header never adds the top inset itself except `overlay`: `Screen edges={['top']}` pads it.
 */
export function Header({
  variant = 'standard',
  title,
  onBack,
  backIcon = 'back',
  backLabel,
  actions = [],
  trailingText,
  scrollY,
  tone = 'surface',
  overlayTop,
  inlineTitle = false,
  testID,
}: HeaderProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const fallback = useSharedValue(0);
  const y = scrollY ?? fallback;
  const inline = variant === 'large' && inlineTitle;
  const collapsible = variant === 'large' && !!scrollY && !inline;

  const hairlineVisible = useDerivedValue(() =>
    withTiming(y.value > h.hairlineScrollThreshold ? 1 : 0, { duration: motion.fast.duration }),
  );
  const hairlineStyle = useAnimatedStyle(() => ({ opacity: hairlineVisible.value }));
  const barTitleStyle = useAnimatedStyle(() => ({
    opacity: collapsible
      ? barTitleOpacity(y.value)
      : 1,
  }));

  const backButton = onBack ? (
    <IconButton
      icon={backIcon}
      variant={variant === 'overlay' ? 'floating' : 'plain'}
      onPress={onBack}
      accessibilityLabel={backLabel ?? (backIcon === 'close' ? t('common.close') : t('common.back'))}
      testID={testID ? `${testID}-back` : undefined}
    />
  ) : null;

  const trailing = trailingText ? (
    <TextAction {...trailingText} />
  ) : (
    actions.slice(0, 2).map(action => (
      <IconButton
        key={action.accessibilityLabel}
        icon={action.icon}
        variant={variant === 'overlay' ? 'floating' : 'plain'}
        onPress={action.onPress}
        accessibilityLabel={action.accessibilityLabel}
        testID={action.testID}
      />
    ))
  );

  if (variant === 'overlay') {
    return (
      <View
        pointerEvents="box-none"
        style={[styles.overlay, { top: overlayTop ?? insets.top + h.overlayControlTopOffset }]}
        testID={testID}
      >
        <View>{backButton}</View>
        <View style={styles.trailing}>{trailing}</View>
      </View>
    );
  }

  const fill = tone === 'background' ? theme.colors.background : theme.colors.surface;
  const showBarTitle = variant === 'standard' || collapsible;

  return (
    <View style={{ backgroundColor: fill }} testID={testID}>
      <View style={[styles.bar, !onBack && styles.barNoBack]}>
        {backButton}
        <Animated.View style={[styles.titleSlot, onBack ? styles.titleAfterBack : null, barTitleStyle]}>
          {inline && title ? (
            <AppText variant="h1" numberOfLines={1} accessibilityRole="header" testID={testID ? `${testID}-title` : undefined}>
              {title}
            </AppText>
          ) : showBarTitle && title ? (
            <AppText
              variant="title"
              numberOfLines={1}
              accessibilityRole="header"
              // The collapsed copy duplicates the large title; only one is read.
              accessibilityElementsHidden={collapsible}
              importantForAccessibility={collapsible ? 'no-hide-descendants' : 'auto'}
            >
              {title}
            </AppText>
          ) : null}
        </Animated.View>
        <View style={styles.trailing}>{trailing}</View>
      </View>
      {variant === 'large' && !scrollY && !inline && title ? <HeaderLargeTitle title={title} /> : null}
      <Animated.View
        style={[
          styles.hairline,
          { backgroundColor: theme.colors.border, height: theme.borderWidth.hairline },
          hairlineStyle,
        ]}
      />
    </View>
  );
}

/** The `h1` title of a `large` Header; put it first in the scroll content when collapsing. */
export function HeaderLargeTitle({ title, scrollY }: { title: string; scrollY?: SharedValue<number> }) {
  const fallback = useSharedValue(0);
  const y = scrollY ?? fallback;
  const style = useAnimatedStyle(() => ({
    opacity: largeTitleOpacity(y.value),
  }));
  return (
    <Animated.View style={[styles.largeTitle, style]}>
      <AppText variant="h1" accessibilityRole="header" numberOfLines={2}>
        {title}
      </AppText>
    </Animated.View>
  );
}

function TextAction({
  label,
  onPress,
  accessibilityLabel,
  testID,
}: NonNullable<HeaderProps['trailingText']>) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={styles.textAction}
      testID={testID}
    >
      {({ pressed }) => (
        <AppText variant="buttonSmall" color="primaryText" numberOfLines={1} style={pressed ? styles.pressed : null}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: h.barHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingStart: h.backButtonStart,
    paddingEnd: space[1],
  },
  barNoBack: { paddingStart: h.largeTitleStart },
  // Back button (4 + 40 visual) + 12 = text at x=56.
  titleSlot: { flex: 1, minWidth: 0 },
  titleAfterBack: { marginStart: h.titleStart - h.backButtonStart - componentTokens.iconButton.visual },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  textAction: { minHeight: componentTokens.iconButton.target, paddingHorizontal: space[3], justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  hairline: { width: '100%' },
  largeTitle: {
    paddingHorizontal: h.largeTitleStart,
    paddingTop: h.largeTitleTop,
    paddingBottom: space[2],
  },
  overlay: {
    position: 'absolute',
    start: h.overlayControlStart,
    end: h.overlayControlStart,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
