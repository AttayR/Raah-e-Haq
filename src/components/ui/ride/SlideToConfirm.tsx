import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, I18nManager, StyleSheet, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { haptics } from '../../../core/haptics';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { t } from '../../../i18n';
import { componentTokens, motion, radius, reducedMotion, springs } from '../../../theme';
import { AppText } from '../AppText';
import { timing } from '../easing';
import { Icon } from '../Icon';

const s = componentTokens.ride.slide;

const COMPLETE_AT = s.completeAt;
/** [UI-R13] The label may shrink this far before it would be cut (a long locale at 1.3×). */
export const SLIDE_LABEL_MIN_SCALE = 0.8;

/**
 * Whether a release at `offset` along a `travel`-long track confirms (§5.31: 85%). [UI-R13] A
 * worklet: the pan's `onEnd` calls it on the UI thread (a plain function crashed every slide).
 */
export const slideCompletes = (offset: number, travel: number): boolean => {
  'worklet';
  return travel > 0 && offset >= travel * COMPLETE_AT;
};

export type SlideToConfirmProps = {
  /** "Slide to start trip", "Slide to complete trip". */
  label: string;
  onConfirm: () => void;
  /** The action is running: the knob stays at the end with a spinner. */
  loading?: boolean;
  disabled?: boolean;
  /** Spoken name; defaults to the label without "Slide to". */
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Slide-to-confirm (DESIGN_SYSTEM §5.31) for Start/Complete trip on driving screens: 64pt `primary`
 * pill track, 56pt `onPrimary` knob with `chevron-double-right` in `primary`, label `button`
 * `onPrimary` that fades as the knob moves. Confirms at 85% travel (haptic `impactMedium`), springs
 * back otherwise. Screen readers get a button with an "activate" action (double tap confirms).
 * RTL slides towards the start edge.
 */
export function SlideToConfirm({ label, onConfirm, loading = false, disabled = false, accessibilityLabel, testID }: SlideToConfirmProps) {
  const { theme } = useAppTheme();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const travel = Math.max(0, width - s.knob - s.inset * 2);
  const offset = useSharedValue(0);
  const dir = I18nManager.isRTL ? -1 : 1;
  const inactive = disabled || loading;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animation configs are built on the JS thread; the gesture callbacks (UI thread) only read them.
  const fastTiming = useMemo(() => timing(motion.fast), []);
  const backTiming = useMemo(() => timing(reducedMotion.sheetSnap), []);
  const moveTo = useCallback(
    (target: number) => {
      offset.value = reduced ? withTiming(target, backTiming) : withSpring(target, springs.press);
    },
    [backTiming, offset, reduced],
  );

  const clearReset = () => {
    if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    resetTimer.current = null;
  };
  useEffect(() => clearReset, []);

  const confirm = useCallback(() => {
    haptics.impactMedium();
    onConfirm();
    // A screen that never sets `loading` (or fails at once) must not leave the knob parked.
    clearReset();
    resetTimer.current = setTimeout(() => {
      resetTimer.current = null;
      if (!loadingRef.current) moveTo(0);
    }, s.resetAfterMs);
  }, [moveTo, onConfirm]);

  // Loading parks the knob at the end; idle (or a failed action) brings it home.
  useEffect(() => {
    moveTo(loading ? travel : 0);
  }, [loading, moveTo, travel]);

  // [UI-R13] A new action (Start → Complete trip) starts with the knob home, never parked at the end.
  const lastLabel = useRef(label);
  useEffect(() => {
    if (lastLabel.current === label) return;
    lastLabel.current = label;
    clearReset();
    if (!loadingRef.current) offset.value = 0;
  }, [label, offset]);

  const pan = Gesture.Pan()
    .enabled(!inactive && travel > 0)
    .activeOffsetX([-8, 8])
    .onUpdate(e => {
      offset.value = Math.min(travel, Math.max(0, e.translationX * dir));
    })
    .onEnd(() => {
      if (slideCompletes(offset.value, travel)) {
        offset.value = withTiming(travel, fastTiming);
        runOnJS(confirm)();
      } else {
        offset.value = reduced ? withTiming(0, backTiming) : withSpring(0, springs.press);
      }
    })
    .withTestId(testID ? `${testID}-pan` : 'slide-pan');

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value * dir }] }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: travel > 0 ? 1 - Math.min(1, offset.value / (travel * s.completeAt)) : 1 }));

  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'activate' && !inactive) confirm();
  };

  return (
    <View
      testID={testID}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={t('ride.slideHint')}
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={onAction}
      style={[styles.track, { backgroundColor: theme.colors.primary }, disabled ? styles.disabled : null]}
    >
      <Animated.View style={[styles.labelWrap, labelStyle]} pointerEvents="none">
        {/* [UI-R13] Keyed on the text, so a new label is sized afresh (never stuck at a shrunk size). */}
        <AppText
          key={loading ? 'working' : label}
          variant="button"
          color="onPrimary"
          numberOfLines={1}
          align="center"
          adjustsFontSizeToFit
          minimumFontScale={SLIDE_LABEL_MIN_SCALE}
          testID={testID ? `${testID}-label` : undefined}
        >
          {loading ? t('ride.slideWorking') : label}
        </AppText>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View
          testID={testID ? `${testID}-knob` : undefined}
          style={[styles.knob, { backgroundColor: theme.colors.onPrimary }, knobStyle]}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <Icon name="slideConfirm" size={28} color="primary" />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: s.height, borderRadius: radius.pill, justifyContent: 'center', padding: s.inset, alignSelf: 'stretch' },
  // [UI-R13] The label keeps clear of the knob at the start only; the end needs just the track's
  // inset, so "Slide karke shuru karein" fits at 1.3× on an iPhone SE.
  labelWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingStart: s.knob + s.inset * 2,
    paddingEnd: s.inset * 2,
  },
  knob: { width: s.knob, height: s.knob, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: componentTokens.state.disabledOpacity },
});
