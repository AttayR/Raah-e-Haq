import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useDerivedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { AppText } from '../../components/ui/AppText';
import { useIsOffline } from '../../components/ui/Banner';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { NearbyDriversState } from '../../hooks/useNearbyDrivers';
import { t } from '../../i18n';
import { componentTokens, motion, radius } from '../../theme';
import { nearbyChipContent, type NearbyChipContent } from './chipText';
import type { NearbyFreshness } from './nearbyMotion';
import { nearbyChipCounts } from './selection';

const c = componentTokens.ride.nearbyChip;
const controls = componentTokens.mapControls;
/** The locate button's visual size: the chip sits on its baseline, centred on it (§4). */
const LOCATE_VISUAL = componentTokens.iconButton.floatingVisual;
/** From the sheet's top edge to the chip's bottom: locate's gap + half the size difference. */
const CHIP_BOTTOM_GAP = controls.sheetGap + (LOCATE_VISUAL - c.minHeight) / 2;
/** End room kept for the locate button and its gap (§4 max width). */
const END_ROOM = LOCATE_VISUAL + controls.edge + c.gap * 1.5;
/** §4: on SE-class widths at large text the "· N online" part drops first. */
const NARROW_WIDTH = 380;
const LARGE_FONT_SCALE = 1.15;

export type NearbyCountChipProps = {
  state: Pick<NearbyDriversState, 'status' | 'drivers' | 'counts'> & { retry?: () => void };
  freshness: NearbyFreshness;
  /** Choose ride: the selected tier. Home: null. */
  tier?: string | null;
  /** The sheet's visible height (`BottomSheet animatedHeight`), so the chip rides with it. */
  sheetHeight: SharedValue<number>;
  /** Hidden (fades out, `motion.fast`), e.g. while the sheet is at `full`. */
  hidden?: boolean;
  testID?: string;
};

const DotOrSpinner: React.FC<{ dot: NearbyChipContent['dot'] }> = ({ dot }) => {
  const { theme } = useAppTheme();
  if (dot === 'loading') {
    return <ActivityIndicator size="small" color={theme.colors.primaryText} style={styles.spinner} />;
  }
  if (dot === 'error') return null;
  return <View style={[styles.dot, { backgroundColor: dot === 'available' ? theme.colors.success : theme.colors.textMuted }]} />;
};

/**
 * The map count chip (T-586, map-vehicles.md §4): bottom-start on the map, centred on the locate
 * button and riding with the sheet. Home: "{n} drivers online near you"; Choose ride: "{n} {tier}
 * nearby · {online} online". Server counts when BE-116 sends them, else the list. Loading spinner,
 * error (tap retries, still no sooner than the 10 s floor), hidden offline. Announced only when
 * its category changes, not on every poll.
 */
export const NearbyCountChip: React.FC<NearbyCountChipProps> = ({ state, freshness, tier = null, sheetHeight, hidden = false, testID = 'nearby-drivers-status' }) => {
  const { theme } = useAppTheme();
  const reduced = useReducedMotion();
  const offline = useIsOffline();
  const { width, fontScale } = useWindowDimensions();
  const content = nearbyChipContent({
    status: state.status,
    failed: state.status === 'error' || freshness === 'gone',
    tier,
    counts: nearbyChipCounts(state.drivers, state.counts, tier),
  });

  const lastCategory = useRef<string | null>(null);
  const label = content ? [content.primary, content.secondary].filter(Boolean).join(' · ') : '';
  const category = content?.category ?? null;
  // Only a category change announces; the label is read from a ref when it does.
  const labelRef = useRef(label);
  labelRef.current = label;
  useEffect(() => {
    if (category === null) return;
    if (lastCategory.current !== null && lastCategory.current !== category) {
      AccessibilityInfo.announceForAccessibility(labelRef.current);
    }
    lastCategory.current = category;
  }, [category]);

  const visible = useDerivedValue(() => withTiming(hidden ? 0 : 1, { duration: reduced ? 0 : motion.fast.duration }), [hidden, reduced]);
  const rideStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
    transform: [{ translateY: -(sheetHeight.value + CHIP_BOTTOM_GAP) }],
  }));

  if (!content || offline) return null;
  const showSecondary = content.secondary !== null && !(width < NARROW_WIDTH && fontScale > LARGE_FONT_SCALE);
  const error = content.dot === 'error';
  const body = (
    <Animated.View
      key={label}
      entering={reduced ? undefined : FadeIn.duration(motion.fast.duration)}
      style={styles.row}
    >
      <DotOrSpinner dot={content.dot} />
      <AppText variant="label" color={error ? 'danger' : 'textPrimary'} numberOfLines={1} style={styles.primary}>
        {content.primary}
      </AppText>
      {showSecondary ? (
        <AppText variant="label" color="textSecondary" numberOfLines={1} style={styles.secondary}>
          {`· ${content.secondary}`}
        </AppText>
      ) : null}
    </Animated.View>
  );
  const chipStyle = [
    styles.chip,
    { maxWidth: width - controls.edge - END_ROOM, backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
  ];
  return (
    <Animated.View style={[styles.anchor, rideStyle]} pointerEvents={hidden ? 'none' : 'box-none'}>
      {error && state.retry ? (
        <Pressable
          testID={testID}
          onPress={state.retry}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={t('nearbyMap.retryHint')}
          hitSlop={(componentTokens.iconButton.target - c.minHeight) / 2}
          style={({ pressed }) => [chipStyle, pressed ? styles.pressed : null]}
        >
          {body}
        </Pressable>
      ) : (
        <View testID={testID} accessible accessibilityRole="text" accessibilityLabel={label} style={chipStyle}>
          {body}
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  anchor: { position: 'absolute', start: controls.edge, bottom: 0 },
  chip: {
    alignSelf: 'flex-start',
    minHeight: c.minHeight,
    justifyContent: 'center',
    paddingHorizontal: c.paddingHorizontal,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: c.gap },
  dot: { width: c.dot, height: c.dot, borderRadius: radius.pill },
  spinner: { width: c.spinner, height: c.spinner },
  // Numbers in tabular figures, so a count change does not shift the text.
  primary: { flexShrink: 1, fontVariant: ['tabular-nums'] },
  secondary: { flexShrink: 1, fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.85 },
});
