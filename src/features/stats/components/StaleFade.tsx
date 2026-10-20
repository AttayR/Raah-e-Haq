import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { componentTokens, motion } from '../../../theme';

/**
 * UI-R17 §3.6: while another period loads, the chart and the trips list keep the last period's
 * content at 0.5 and are not interactive. One shared opacity and one stale flag for the whole
 * screen (no per-row timers): the screen owns them, the blocks read them from context, so a period
 * switch re-renders only the consumers once instead of every row through `renderItem`.
 */
type StaleValue = { opacity: SharedValue<number>; stale: boolean };

const StaleContext = createContext<StaleValue | null>(null);

/** The screen's opacity value: 1, or `staleOpacity` while stale (150 ms fade; none with reduced motion). */
export function useStaleOpacity(stale: boolean): SharedValue<number> {
  const reduce = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    const target = stale ? componentTokens.earnings.staleOpacity : 1;
    opacity.value = reduce ? target : withTiming(target, { duration: motion.fast.duration });
  }, [stale, reduce, opacity]);
  return opacity;
}

export function StaleOpacityProvider({
  value,
  stale,
  children,
}: React.PropsWithChildren<{ value: SharedValue<number>; stale: boolean }>) {
  const context = useMemo(() => ({ opacity: value, stale }), [value, stale]);
  return <StaleContext.Provider value={context}>{children}</StaleContext.Provider>;
}

/** True while the shown content belongs to the previous period (false outside a provider). */
export function useIsStale(): boolean {
  return useContext(StaleContext)?.stale ?? false;
}

/** Animated style for a block that dims with the period (full opacity outside a provider). */
export function useStaleStyle() {
  const shared = useContext(StaleContext)?.opacity;
  const local = useSharedValue(1);
  const opacity = shared ?? local;
  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}
