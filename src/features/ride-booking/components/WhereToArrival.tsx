import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { timing } from '../../../components/ui/easing';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { componentTokens, layout, motion } from '../../../theme';
import { WhereToFace, whereToBarStyles } from '../../passenger-home/components/WhereToBar';
import type { MapPicker } from '../useMapPicker';
import { MapPickOverlay } from './MapPick';

/**
 * UI-R9b review: the destination field is focused on open, but the keyboard only comes up once
 * the push has ended (~400 ms). The move waits for it this long; without a keyboard (a hardware
 * keyboard) it starts then, over the sheet as it stands.
 */
export const ARRIVAL_SETTLE_MS = 600;
/** After the keyboard event, the sheet's re-layout above it is awaited this long at most. */
export const AFTER_KEYBOARD_MS = 120;
/** A measure that never answers (a view gone meanwhile) shows the field after this long. */
const MEASURE_TIMEOUT_MS = 150;

type Rect = { x: number; y: number; width: number; height: number };

export type WhereToArrival = {
  /** The move is running: the destination field stays hidden under the moving bar. */
  active: boolean;
  /** Attach to the planner's destination field (its window rect is the move's end). */
  fieldRef: React.RefObject<View | null>;
  fieldStyle: StyleProp<ViewStyle>;
  /** Attach to the screen-filling layer the moving bar is drawn in (its origin). */
  layerRef: React.RefObject<View | null>;
  rect: { top: SharedValue<number>; left: SharedValue<number>; width: SharedValue<number>; height: SharedValue<number> };
  ghostOpacity: SharedValue<number>;
  /**
   * Call on every layout of the planner sheet. After the keyboard event the first one means the
   * sheet has taken its keyboard height: the field is measured then, at its final place.
   */
  onSheetLayout: () => void;
};

/**
 * UI-R9b, passenger-home Interactions: "Where to?" has a shared-element feel. Booking (pushed with
 * a 250 ms fade) draws a copy of the Home bar where the bar was (`fromTop`, its window y) and moves
 * it, in `motion.base` on the UI thread, onto the planner's destination field once the planner has
 * settled; the copy then fades out over the field, which appears. UI-R9b review: "settled" is the
 * sheet's first layout after the keyboard event (it rises by the keyboard's height then), so the
 * field is measured at its final place and the copy makes one 250 ms move, never a second one
 * with the sheet (`ARRIVAL_SETTLE_MS` without a keyboard, `AFTER_KEYBOARD_MS` without a layout).
 * Without a start, with Reduce Motion, or when the field cannot be measured, nothing moves and
 * the field shows at once.
 */
export function useWhereToArrival(fromTop: number | null): WhereToArrival {
  const reduced = useReducedMotion();
  const { width: windowWidth } = useWindowDimensions();
  const [active, setActive] = useState(fromTop !== null);
  const fieldRef = useRef<View | null>(null);
  const layerRef = useRef<View | null>(null);
  const fieldOpacity = useSharedValue(fromTop !== null ? 0 : 1);
  const ghostOpacity = useSharedValue(fromTop !== null ? 1 : 0);
  const top = useSharedValue(fromTop ?? 0);
  const left = useSharedValue<number>(layout.gutter);
  const width = useSharedValue(windowWidth - layout.gutter * 2);
  const height = useSharedValue<number>(componentTokens.home.whereToHeight);
  const started = useRef(false);
  const measureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Review (retry 1): a Booking closed while measuring leaves no timer behind.
  useEffect(
    () => () => {
      if (measureTimer.current) clearTimeout(measureTimer.current);
      measureTimer.current = null;
    },
    [],
  );

  const finish = useCallback(() => setActive(false), []);
  const reveal = useCallback(() => {
    fieldOpacity.value = 1;
    ghostOpacity.value = 0;
    setActive(false);
  }, [fieldOpacity, ghostOpacity]);

  const run = useCallback(() => {
    if (started.current) return;
    started.current = true;
    const field = fieldRef.current;
    const layer = layerRef.current;
    if (!field || !layer || typeof field.measureInWindow !== 'function' || typeof layer.measureInWindow !== 'function') {
      reveal();
      return;
    }
    let answered = false;
    measureTimer.current = setTimeout(() => {
      measureTimer.current = null;
      if (answered) return;
      answered = true;
      reveal();
    }, MEASURE_TIMEOUT_MS);
    layer.measureInWindow((_lx, ly) => {
      field.measureInWindow((x, y, w, h) => {
        if (answered) return;
        answered = true;
        if (measureTimer.current) clearTimeout(measureTimer.current);
        measureTimer.current = null;
        const to: Rect = { x, y: y - ly, width: w, height: h };
        if (![to.x, to.y, to.width, to.height].every(Number.isFinite) || to.width <= 0) {
          reveal();
          return;
        }
        top.value = top.value - ly;
        const move = timing(motion.base);
        top.value = withTiming(to.y, move);
        left.value = withTiming(to.x, move);
        width.value = withTiming(to.width, move);
        const fade = timing(motion.fast);
        height.value = withTiming(to.height, move, () => {
          'worklet';
          fieldOpacity.value = withTiming(1, fade);
          ghostOpacity.value = withTiming(0, fade, () => {
            'worklet';
            runOnJS(finish)();
          });
        });
      });
    });
  }, [finish, reveal, top, left, width, height, fieldOpacity, ghostOpacity]);

  // Set by the keyboard event: the sheet's next layout starts the move.
  const awaitingLayout = useRef(false);
  const onSheetLayout = useCallback(() => {
    if (!awaitingLayout.current) return;
    awaitingLayout.current = false;
    run();
  }, [run]);

  useEffect(() => {
    if (fromTop === null || !active) return undefined;
    if (reduced) {
      reveal();
      return undefined;
    }
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(run, ARRIVAL_SETTLE_MS);
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, () => {
      if (timer) clearTimeout(timer);
      awaitingLayout.current = true;
      timer = setTimeout(run, AFTER_KEYBOARD_MS);
    });
    return () => {
      if (timer) clearTimeout(timer);
      timer = null;
      awaitingLayout.current = false;
      sub.remove();
    };
    // `run` starts the move once per open (`started`); later renders never restart it.
  }, [fromTop, active, reduced, run, reveal]);

  const fieldStyle = useAnimatedStyle(() => ({ opacity: fieldOpacity.value }));
  return { active, fieldRef, fieldStyle, layerRef, rect: { top, left, width, height }, ghostOpacity, onSheetLayout };
}

/** The moving copy of the Home bar (decorative; the field it lands on is the control). */
export function WhereToGhost({ arrival }: { arrival: WhereToArrival }) {
  const { theme } = useAppTheme();
  const { rect, ghostOpacity } = arrival;
  const style = useAnimatedStyle(() => ({
    top: rect.top.value,
    left: rect.left.value,
    width: rect.width.value,
    height: rect.height.value,
    opacity: ghostOpacity.value,
  }));
  return (
    <View ref={arrival.layerRef} style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {arrival.active ? (
        <Animated.View style={[whereToBarStyles.bar, styles.ghost, { backgroundColor: theme.colors.surfaceAlt }, style]} testID="where-to-ghost">
          <WhereToFace />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** UI-R9b: what Booking draws over its map and sheet: the centre-pin picker and the moving "Where to?" bar. */
export function BookingMapOverlays({
  picker,
  arrival,
  onPickerHeight,
}: {
  picker: MapPicker;
  arrival: WhereToArrival;
  onPickerHeight: (height: number) => void;
}) {
  return (
    <>
      <MapPickOverlay picker={picker} onHeight={onPickerHeight} />
      <WhereToGhost arrival={arrival} />
    </>
  );
}

const styles = StyleSheet.create({
  ghost: { position: 'absolute', minHeight: 0 },
});
