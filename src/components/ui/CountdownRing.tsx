import React, { memo, useEffect, useState } from 'react';
import { I18nManager, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { useAppIsActive } from '../../hooks/useAppIsActive';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { componentTokens } from '../../theme';
import { AppText, type TextColor } from './AppText';

/** What a countdown runs on: wall-clock start, length, and whether it is frozen (accepting). */
export type CountdownSpec = {
  startedAt: number;
  durationMs: number;
  paused?: boolean;
};

/** Milliseconds left at `now` (never below 0). */
export const countdownRemainingMs = ({ startedAt, durationMs }: CountdownSpec, now: number): number =>
  Math.max(0, startedAt + durationMs - now);

/** Whole seconds shown in the ring: 19.2 s left reads 20, 0.1 s reads 1, 0 reads 0. */
export const countdownSecondsLeft = (spec: CountdownSpec, now: number): number =>
  Math.ceil(countdownRemainingMs(spec, now) / 1000);

const k = componentTokens.countdownRing;
const r = (k.size - k.stroke) / 2;
const circumference = 2 * Math.PI * r;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = CountdownSpec & {
  /** Arc, track and seconds colour (`onPrimary` inside the primary Accept button). */
  color?: TextColor;
  testID?: string;
};

/**
 * CountdownRing (shared-trip-sheet TS9, UI-R11): 32 × 32, a 3 pt track at 32 % and a 3 pt arc
 * that starts at 12 o'clock and is eaten clockwise as time runs out (mirrored in RTL), with the
 * seconds left in the centre. The arc runs on the UI thread (`withTiming`, linear, on
 * `strokeDashoffset`); the seconds are one 1 Hz state inside the ring only. Time left is always
 * computed from `startedAt`, so a backgrounded app comes back with the right remainder.
 * `paused` freezes it. Reduce Motion: the arc steps once a second instead of sliding.
 * Decorative: the button that holds it carries the label.
 */
function CountdownRingBase({ startedAt, durationMs, paused = false, color = 'onPrimary', testID }: Props) {
  const { theme } = useAppTheme();
  const reduce = useReducedMotion();
  const active = useAppIsActive();
  const spec = { startedAt, durationMs };
  const [seconds, setSeconds] = useState(() => countdownSecondsLeft(spec, Date.now()));
  const progress = useSharedValue(durationMs > 0 ? countdownRemainingMs(spec, Date.now()) / durationMs : 0);

  useEffect(() => {
    const at = { startedAt, durationMs };
    const fraction = (now: number) => (durationMs > 0 ? countdownRemainingMs(at, now) / durationMs : 0);
    const now = Date.now();
    const left = countdownRemainingMs(at, now);
    cancelAnimation(progress);
    progress.value = fraction(now);
    setSeconds(countdownSecondsLeft(at, now));
    if (paused || left <= 0 || !active) return undefined;
    if (!reduce) progress.value = withTiming(0, { duration: left, easing: Easing.linear });

    let interval: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      const t = Date.now();
      setSeconds(countdownSecondsLeft(at, t));
      if (reduce) progress.value = fraction(t);
      if (countdownRemainingMs(at, t) <= 0 && interval !== null) clearInterval(interval);
    };
    // First tick on the next whole second, then once a second.
    const first = setTimeout(() => {
      tick();
      interval = setInterval(tick, 1000);
    }, left % 1000 || 1000);
    return () => {
      clearTimeout(first);
      if (interval !== null) clearInterval(interval);
    };
  }, [active, durationMs, paused, progress, reduce, startedAt]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: -(1 - progress.value) * circumference,
  }));
  const stroke = theme.colors[color];

  return (
    <View
      style={styles.box}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <Svg width={k.size} height={k.size} style={I18nManager.isRTL ? styles.mirrored : undefined}>
        <Circle
          cx={k.size / 2}
          cy={k.size / 2}
          r={r}
          stroke={stroke}
          strokeOpacity={k.trackOpacity}
          strokeWidth={k.stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={k.size / 2}
          cy={k.size / 2}
          r={r}
          stroke={stroke}
          strokeWidth={k.stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          fill="none"
          rotation={-90}
          origin={`${k.size / 2}, ${k.size / 2}`}
          animatedProps={arcProps}
        />
      </Svg>
      <View style={styles.centre}>
        <AppText
          variant="numericSmall"
          color={color}
          maxFontSizeMultiplier={1}
          testID={testID ? `${testID}-seconds` : undefined}
        >
          {String(seconds)}
        </AppText>
      </View>
    </View>
  );
}

export const CountdownRing = memo(CountdownRingBase);

const styles = StyleSheet.create({
  box: { width: k.size, height: k.size },
  mirrored: { transform: [{ scaleX: -1 }] },
  centre: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
