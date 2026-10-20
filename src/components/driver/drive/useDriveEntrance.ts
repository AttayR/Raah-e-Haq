import { useEffect, useRef, useState } from 'react';
import {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { toEasing } from '../../ui/easing';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { motion, motionPatterns } from '../../../theme';

const home = motionPatterns.homeEntrance;
const e = motionPatterns.driveEntrance;
const baseEasing = toEasing(motion.base.easing);
const fastEasing = toEasing(motion.fast.easing);
/** The veil lifts by itself after this long if the map never reports ready (fallback view). */
export const DRIVE_VEIL_MAX_MS = 4000;

/** Module flag (D6): the entrance runs once per JS session, the first time Drive is focused. */
let driveEntered = false;

/** Tests only. */
export const resetDriveEntranceForTests = () => {
  driveEntered = false;
};
export const driveEntranceDone = () => driveEntered;

const useBlockStyle = (progress: SharedValue<number>) =>
  useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * home.rise }],
  }));

/**
 * Drive cold-open entrance (UI-R11, driver-drive-home D6), the passenger Home V7 pattern: the map
 * veil (`mapBackground`) fades when the map is ready, the sheet rises 40 → 0 on the clamped
 * spring, the status block, the auto-accept row and the action fade in and rise 8 at 60 / 100 /
 * 140 ms (250 each, done by 390), the avatar and locate fade in at 200 (150). Six animated nodes,
 * all from one effect on the UI thread (`withDelay`, no JS timers), opacity and transform only;
 * every control is pressable from the first frame.
 *
 * Only the first time Drive is focused in this JS session: tab switches and returns from
 * DriverRide start at the final values. Reduce Motion: no movement, content at once, veil 150.
 */
export function useDriveEntrance({ focused, mapReady }: { focused: boolean; mapReady: boolean }) {
  const reduce = useReducedMotion();
  const [entering] = useState(() => !driveEntered);
  const started = useRef(false);
  const [running, setRunning] = useState(false);
  const [veilDone, setVeilDone] = useState(false);
  const from = (hidden: number, shown: number) => (entering ? hidden : shown);

  const veil = useSharedValue(from(1, 0));
  const sheet = useSharedValue(from(home.sheetFrom, 0));
  const status = useSharedValue(from(0, 1));
  const row = useSharedValue(from(0, 1));
  const action = useSharedValue(from(0, 1));
  const controls = useSharedValue(from(0, 1));

  useEffect(() => {
    if (!entering || started.current || !focused) return;
    started.current = true;
    driveEntered = true;
    setRunning(true);
    const blocks: Array<[SharedValue<number>, number]> = [
      [status, e.statusAt],
      [row, e.rowAt],
      [action, e.actionAt],
    ];
    if (reduce) {
      sheet.value = 0;
      blocks.forEach(([value]) => {
        value.value = 1;
      });
      controls.value = 1;
    } else {
      sheet.value = withSpring(0, home.sheetSpring);
      blocks.forEach(([value, at]) => {
        value.value = withDelay(at, withTiming(1, { duration: motion.base.duration, easing: baseEasing }));
      });
      controls.value = withDelay(e.controlsAt, withTiming(1, { duration: motion.fast.duration, easing: fastEasing }));
    }
    veil.value = withDelay(
      DRIVE_VEIL_MAX_MS,
      withTiming(0, { duration: motion.base.duration, easing: baseEasing }, finished => {
        'worklet';
        if (finished) runOnJS(setVeilDone)(true);
      }),
    );
  }, [action, controls, entering, focused, reduce, row, sheet, status, veil]);

  useEffect(() => {
    if (!running || !mapReady) return;
    veil.value = withTiming(
      0,
      { duration: reduce ? home.reducedVeilMs : motion.base.duration, easing: baseEasing },
      finished => {
        'worklet';
        if (finished) runOnJS(setVeilDone)(true);
      },
    );
  }, [mapReady, reduce, running, veil]);

  // Reduce Motion switched on mid-entrance: jump to the end.
  useEffect(() => {
    if (!reduce || !running) return;
    [sheet, status, row, action, controls].forEach(value => cancelAnimation(value));
    sheet.value = 0;
    [status, row, action, controls].forEach(value => {
      value.value = 1;
    });
  }, [action, controls, reduce, row, running, sheet, status]);

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheet.value }],
  }));
  const controlsStyle = useAnimatedStyle(() => ({ opacity: controls.value }));
  const statusStyle = useBlockStyle(status);
  const rowStyle = useBlockStyle(row);
  const actionStyle = useBlockStyle(action);

  return {
    entering,
    /** The veil is drawn only until it has faded (then it unmounts). */
    showVeil: entering && !veilDone,
    veilStyle,
    sheetStyle,
    controlsStyle,
    statusStyle,
    rowStyle,
    actionStyle,
  };
}
