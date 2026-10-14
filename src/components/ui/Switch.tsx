import React, { useContext, useEffect } from 'react';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { haptics } from '../../core/haptics';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { componentTokens, layout, motion, radius } from '../../theme';
import { DimmedContext } from './dimmed';
import { timing } from './easing';

export type SwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Required: the row label it toggles ("Sound alerts"). */
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
};

const k = componentTokens.switch;
/** Thumb travel: track width − thumb − both insets. */
const TRAVEL = k.trackWidth - k.thumb - k.inset * 2;

/**
 * The one switch style app-wide (DESIGN_SYSTEM §5.9), drawn by the kit (not the native control):
 * 51×31 pill track, `borderStrong` off / `primary` on, 27 `onPrimary` thumb (white in both modes),
 * disabled at the shared 0.4 opacity (once: not again inside a disabled ListItem), `selection` haptic on toggle, centred in a 64×44 target.
 *
 * Why not the native Switch: on iOS 26 the UISwitch draws a ~63-wide liquid-glass control while
 * RN lays it out (and paints `ios_backgroundColor` as a view background) at 51×31, so the painted
 * track sat offset behind the control and showed as a slab behind disabled switches. Drawing the
 * switch here gives the same size, colours and states on every iOS version and on Android.
 */
export function Switch({
  value,
  onValueChange,
  accessibilityLabel,
  disabled = false,
  testID,
}: SwitchProps) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const reduced = useReducedMotion();
  const parentDimmed = useContext(DimmedContext);
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    const target = value ? 1 : 0;
    progress.value = reduced ? target : withTiming(target, timing(motion.fast));
  }, [value, reduced, progress]);

  // The `primary` fill fades in over the `borderStrong` track (opacity only, on the UI thread).
  const fillStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  // The thumb starts at the leading edge (right in RTL) and travels toward the trailing edge.
  const travel = I18nManager.isRTL ? -TRAVEL : TRAVEL;
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [0, travel]) }],
  }));

  return (
    <Pressable
      testID={testID}
      onPress={() => {
        haptics.selection();
        onValueChange(!value);
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      style={[styles.slot, disabled && !parentDimmed && styles.disabled]}
    >
      <View
        testID={testID ? `${testID}-track` : undefined}
        style={[styles.track, { backgroundColor: c.borderStrong }]}
      >
        <Animated.View
          testID={testID ? `${testID}-fill` : undefined}
          style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: c.primary }, fillStyle]}
        />
        <View style={styles.thumbLane}>
          <Animated.View
            testID={testID ? `${testID}-thumb` : undefined}
            style={[styles.thumb, { backgroundColor: c.onPrimary }, theme.elevation[1], thumbStyle]}
          />
        </View>
      </View>
    </Pressable>
  );
}

/**
 * 64×44 slot (§5.9 [UI-R2]): a full touch target; the 51-wide track sits at its trailing edge so
 * it lines up with chevrons and value text in a ListItem (mirrors in RTL).
 */
const styles = StyleSheet.create({
  slot: {
    minWidth: k.slotWidth,
    minHeight: layout.touchTargetIOS,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  track: {
    width: k.trackWidth,
    height: k.trackHeight,
    borderRadius: radius.pill,
    padding: k.inset,
    justifyContent: 'center',
  },
  fill: { borderRadius: radius.pill },
  thumbLane: { flex: 1, justifyContent: 'center', alignItems: 'flex-start' },
  thumb: { width: k.thumb, height: k.thumb, borderRadius: radius.pill },
  disabled: { opacity: componentTokens.state.disabledOpacity },
});
