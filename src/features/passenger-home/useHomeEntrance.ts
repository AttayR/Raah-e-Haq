import { useEffect, useRef, useState } from 'react';
import {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { toEasing } from '../../components/ui/easing';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { motion, motionPatterns } from '../../theme';

const e = motionPatterns.homeEntrance;
const baseEasing = toEasing(motion.base.easing);
const fastEasing = toEasing(motion.fast.easing);
/**
 * The veil waits for `onMapReady`; if the map never reports ready (the fallback view, a native
 * map that failed), it still lifts after this long so it never hides the fallback message.
 */
export const HOME_VEIL_MAX_MS = 4000;

/** Module flag (V7): the entrance runs once per JS session, the first time Home is focused. */
let homeEntered = false;

/** Tests only. */
export const resetHomeEntranceForTests = () => {
  homeEntered = false;
};
export const homeEntranceDone = () => homeEntered;

/** One block's fade + 8 pt rise, driven by a 0 → 1 progress value. */
const useBlockStyle = (progress: SharedValue<number>) =>
  useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: (1 - progress.value) * e.rise }] }));

/**
 * Passenger Home cold-open entrance (UI-R20b, passenger-home V7): the map veil (land colour) fades
 * when the map is ready, the sheet rises 40 → 0 on a clamped spring, then the greeting, "Where
 * to?", the chip row, the Ride card and the Parcel card fade in and rise 8 → 0 at 60/100/140/
 * 180/220 ms, and the map controls fade in at 200 ms; all done by 470 ms. Everything runs on the
 * UI thread from one effect (`withDelay`, no JS timers, no layout animations), opacity and
 * transform only, and every control is in the tree and pressable from frame 0.
 *
 * Only the first time Home is focused in this JS session; later mounts, tab switches, returns
 * and theme or language changes start at the final values. Reduce Motion: no movement, content
 * at once, the veil fades in 150.
 */
export function useHomeEntrance({ focused, mapReady }: { focused: boolean; mapReady: boolean }) {
  const reduce = useReducedMotion();
  const [entering] = useState(() => !homeEntered);
  const started = useRef(false);
  const [running, setRunning] = useState(false);
  const from = (hidden: number, shown: number) => (entering ? hidden : shown);

  const veil = useSharedValue(from(1, 0));
  const sheet = useSharedValue(from(e.sheetFrom, 0));
  const greeting = useSharedValue(from(0, 1));
  const whereTo = useSharedValue(from(0, 1));
  const chips = useSharedValue(from(0, 1));
  const ride = useSharedValue(from(0, 1));
  const parcel = useSharedValue(from(0, 1));
  const controls = useSharedValue(from(0, 1));

  useEffect(() => {
    if (!entering || started.current || !focused) return;
    started.current = true;
    homeEntered = true;
    setRunning(true);
    const blocks: Array<[SharedValue<number>, number]> = [
      [greeting, e.greetingAt],
      [whereTo, e.whereToAt],
      [chips, e.chipsAt],
      [ride, e.rideAt],
      [parcel, e.parcelAt],
    ];
    if (reduce) {
      sheet.value = 0;
      blocks.forEach(([value]) => {
        value.value = 1;
      });
      controls.value = 1;
    } else {
      sheet.value = withSpring(0, e.sheetSpring);
      blocks.forEach(([value, at]) => {
        value.value = withDelay(at, withTiming(1, { duration: motion.base.duration, easing: baseEasing }));
      });
      controls.value = withDelay(e.controlsAt, withTiming(1, { duration: motion.fast.duration, easing: fastEasing }));
    }
    veil.value = withDelay(HOME_VEIL_MAX_MS, withTiming(0, { duration: motion.base.duration, easing: baseEasing }));
  }, [chips, controls, entering, focused, greeting, parcel, reduce, ride, sheet, veil, whereTo]);

  // The veil lifts as soon as the map has drawn (or at once if it was ready first).
  useEffect(() => {
    if (!running || !mapReady) return;
    veil.value = withTiming(0, { duration: reduce ? e.reducedVeilMs : motion.base.duration, easing: baseEasing });
  }, [mapReady, reduce, running, veil]);

  // Reduce Motion switched on mid-entrance (the setting is read asynchronously): jump to the end.
  useEffect(() => {
    if (!reduce || !running) return;
    [sheet, greeting, whereTo, chips, ride, parcel, controls].forEach(value => cancelAnimation(value));
    sheet.value = 0;
    [greeting, whereTo, chips, ride, parcel, controls].forEach(value => {
      value.value = 1;
    });
  }, [chips, controls, greeting, parcel, reduce, ride, running, sheet, whereTo]);

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheet.value }] }));
  const controlsStyle = useAnimatedStyle(() => ({ opacity: controls.value }));
  const greetingStyle = useBlockStyle(greeting);
  const whereToStyle = useBlockStyle(whereTo);
  const chipsStyle = useBlockStyle(chips);
  const rideStyle = useBlockStyle(ride);
  const parcelStyle = useBlockStyle(parcel);

  return {
    /** Whether this mount plays the entrance (the veil is rendered only then). */
    entering,
    veilStyle,
    sheetStyle,
    controlsStyle,
    greetingStyle,
    whereToStyle,
    chipsStyle,
    rideStyle,
    parcelStyle,
  };
}
