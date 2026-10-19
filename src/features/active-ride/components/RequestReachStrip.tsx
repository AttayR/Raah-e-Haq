import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Icon } from '../../../components/ui';
import { toEasing } from '../../../components/ui/easing';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import type { RideResource } from '../../../services/rideService';
import { componentTokens, motion, radius, space } from '../../../theme';
import { reachAnnouncement, reachContent, useRequestReach, type CountText, type RequestReach } from '../reach';

const r = componentTokens.ride.reachStrip;
const numberIn = FadeInDown.duration(r.numberInMs).withInitialValues({ opacity: 0, transform: [{ translateY: r.numberRise }] });
const numberOut = FadeOut.duration(r.numberOutMs);
const stripIn = FadeIn.duration(motion.fast.duration);
const breatheEasing = toEasing(motion.base.easing);

/** A number that crossfades on change (old out 100 ms, new in 150 ms rising 4 pt); tabular figures. */
const ReachNumber: React.FC<{ n: number; reduced: boolean; color: 'textPrimary' | 'textSecondary'; testID?: string }> = ({ n, reduced, color, testID }) => (
  <Animated.View key={n} entering={reduced ? undefined : numberIn} exiting={reduced ? undefined : numberOut}>
    <AppText variant="label" color={color} style={styles.tabular} testID={testID}>
      {String(n)}
    </AppText>
  </Animated.View>
);

const CountPart: React.FC<{ part: CountText; reduced: boolean; color: 'textPrimary' | 'textSecondary'; testID: string }> = ({ part, reduced, color, testID }) => (
  <View style={styles.part}>
    {part.before ? <AppText variant="label" color={color}>{part.before}</AppText> : null}
    <ReachNumber n={part.n} reduced={reduced} color={color} testID={`${testID}-n`} />
    {part.after ? <AppText variant="label" color={color}>{part.after}</AppText> : null}
  </View>
);

/** The `success` dot, breathing 1 → 0.4 → 1 (2000 ms) while shown; still with reduced motion. */
const ViewingDot: React.FC<{ reduced: boolean }> = ({ reduced }) => {
  const { theme } = useAppTheme();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduced) {
      opacity.value = 1;
      return undefined;
    }
    const half = { duration: r.breatheMs / 2, easing: breatheEasing };
    opacity.value = withRepeat(withSequence(withTiming(r.breatheMinOpacity, half), withTiming(1, half)), -1, false);
    return () => cancelAnimation(opacity);
  }, [opacity, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View testID="request-reach-dot" style={[styles.dot, { backgroundColor: theme.colors.success }, style]} />;
};

/** Announces politely when `sent`, then `viewing`, first becomes > 0 (not on every change). */
const useReachAnnouncements = (reach: RequestReach, round: string) => {
  const said = useRef<{ round: string; sent: boolean; viewing: boolean }>({ round, sent: false, viewing: false });
  if (said.current.round !== round) said.current = { round, sent: false, viewing: false };
  const sent = reach.sent ?? 0;
  const viewing = reach.viewing ?? 0;
  useEffect(() => {
    const state = said.current;
    if (sent > 0 && !state.sent) {
      state.sent = true;
      AccessibilityInfo.announceForAccessibility(reachAnnouncement('sent', sent));
    }
    if (viewing > 0 && !state.viewing) {
      state.viewing = true;
      AccessibilityInfo.announceForAccessibility(reachAnnouncement('viewing', viewing));
    }
  }, [sent, viewing]);
};

const ReachStripBody: React.FC<{ reach: RequestReach; round: string }> = ({ reach, round }) => {
  const { theme } = useAppTheme();
  const reduced = useReducedMotion();
  useReachAnnouncements(reach, round);
  const content = reachContent(reach);
  return (
    <Animated.View
      entering={reduced ? undefined : stripIn}
      testID="request-reach"
      accessible
      accessibilityRole="text"
      accessibilityLabel={content.label}
      style={[styles.strip, { backgroundColor: theme.colors.surfaceAlt }]}
    >
      <Icon name="broadcast" size={20} color="primaryText" />
      <View style={styles.text}>
        {content.sending ? (
          <AppText variant="label" color="textPrimary" testID="request-reach-sending">
            {content.sending}
          </AppText>
        ) : null}
        {content.sent ? <CountPart part={content.sent} reduced={reduced} color="textPrimary" testID="request-reach-sent" /> : null}
        {content.viewing ? (
          <View style={styles.part} testID="request-reach-viewing">
            <AppText variant="label" color="textSecondary">{' · '}</AppText>
            <ViewingDot reduced={reduced} />
            <CountPart part={content.viewing} reduced={reduced} color="textSecondary" testID="request-reach-viewing" />
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
};

/**
 * "Sent to {n} drivers · {m} viewing" on Finding a driver (T-587, block 3a): from the ride poll's
 * `reach`, calm (fade in once, numbers crossfade, the viewing dot breathes). Hidden until the
 * poll has carried a reach; a failed read keeps the last value and says nothing. Never ellipsized:
 * at large text the viewing part wraps to a second line.
 */
export const RequestReachStrip: React.FC<{ ride: RideResource | null; searching: boolean }> = ({ ride, searching }) => {
  const reach = useRequestReach(ride, searching);
  if (!reach || !ride) return null;
  return <ReachStripBody reach={reach} round={`${ride.id}:${ride.requeue_count ?? 0}`} />;
};

const styles = StyleSheet.create({
  strip: {
    minHeight: r.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.gap,
    paddingVertical: r.paddingVertical,
    paddingHorizontal: r.paddingHorizontal,
    borderRadius: radius.md,
  },
  text: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: space[1] },
  part: { flexDirection: 'row', alignItems: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  dot: { width: r.dot, height: r.dot, borderRadius: radius.pill, marginEnd: r.dotGap },
});
