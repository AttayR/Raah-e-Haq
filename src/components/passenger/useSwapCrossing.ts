import { useCallback, useEffect, useRef } from 'react';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { timing } from '../ui/easing';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { motion } from '../../theme';

/** Each half of the crossing: together `motion.base` (250 ms, standard easing). */
const HALF = { duration: motion.base.duration / 2, easing: motion.base.easing };

/**
 * The pickup and destination rows' offset at crossing progress `p` (0 → 1): each row travels
 * toward the other one and fades out by the middle, where the values swap; the swapped texts then
 * arrive from the other row's place and fade in. `distance` is the gap between the rows' tops, so
 * each text travels the whole way from its row to the other one over the 250 ms.
 */
export const crossingOffset = (p: number, distance: number): number => {
  'worklet';
  return (p <= 0.5 ? p : 1 - p) * distance;
};

/**
 * UI-R9b review (the rows barely seemed to travel): a row stays opaque for the first two thirds
 * of its way to the middle, so the two rows are seen sliding over each other, and only fades in
 * the last third, where the values swap (transparent at the middle itself).
 */
export const CROSSING_FADE_GAIN = 3;
export const crossingOpacity = (p: number): number => {
  'worklet';
  return Math.min(1, Math.abs(1 - 2 * p) * CROSSING_FADE_GAIN);
};

type SwapCrossing = {
  /** Runs the 250 ms crossing and swaps the values in its middle (instant with Reduce Motion). */
  swap: () => void;
  onPickupLayout: (e: LayoutChangeEvent) => void;
  onDestinationLayout: (e: LayoutChangeEvent) => void;
  pickupStyle: StyleProp<ViewStyle>;
  destinationStyle: StyleProp<ViewStyle>;
};

/**
 * UI-R9b (passenger-destination-search Interactions): swap animates the two rows crossing in
 * 250 ms. The values change at the midpoint, while both rows are transparent, two frames before
 * the second half starts (the fields take their new text first), so no frame shows a row with
 * the wrong text in the wrong place. UI thread only; one swap at a time; nothing re-renders for
 * the animation itself.
 */
export function useSwapCrossing(onSwap: (() => void) | undefined): SwapCrossing {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const distance = useSharedValue(0);
  const tops = useRef({ pickup: 0, destination: 0 });
  const busy = useRef(false);
  const mounted = useRef(true);
  const onSwapRef = useRef(onSwap);
  onSwapRef.current = onSwap;
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const measure = useCallback(() => {
    distance.value = tops.current.destination - tops.current.pickup;
  }, [distance]);
  const onPickupLayout = useCallback(
    (e: LayoutChangeEvent) => {
      tops.current.pickup = e.nativeEvent.layout.y;
      measure();
    },
    [measure],
  );
  const onDestinationLayout = useCallback(
    (e: LayoutChangeEvent) => {
      tops.current.destination = e.nativeEvent.layout.y;
      measure();
    },
    [measure],
  );

  const done = useCallback(() => {
    busy.current = false;
  }, []);
  const secondHalf = useCallback(() => {
    progress.value = withTiming(1, timing(HALF), () => {
      'worklet';
      progress.value = 0;
      runOnJS(done)();
    });
  }, [progress, done]);
  const midpoint = useCallback(() => {
    if (!mounted.current) return;
    onSwapRef.current?.();
    requestAnimationFrame(() => requestAnimationFrame(secondHalf));
  }, [secondHalf]);

  const swap = useCallback(() => {
    const run = onSwapRef.current;
    if (!run) return;
    if (reduced || tops.current.destination - tops.current.pickup <= 0) {
      run();
      return;
    }
    if (busy.current) return;
    busy.current = true;
    progress.value = withTiming(0.5, timing(HALF), () => {
      'worklet';
      runOnJS(midpoint)();
    });
  }, [reduced, progress, midpoint]);

  const pickupStyle = useAnimatedStyle(() => ({
    opacity: crossingOpacity(progress.value),
    transform: [{ translateY: crossingOffset(progress.value, distance.value) }],
  }));
  const destinationStyle = useAnimatedStyle(() => ({
    opacity: crossingOpacity(progress.value),
    transform: [{ translateY: -crossingOffset(progress.value, distance.value) }],
  }));

  return { swap, onPickupLayout, onDestinationLayout, pickupStyle, destinationStyle };
}
