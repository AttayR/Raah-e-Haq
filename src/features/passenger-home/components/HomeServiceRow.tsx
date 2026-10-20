import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { ServiceCard } from '../../../components/ui';
import { toEasing } from '../../../components/ui/easing';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { t } from '../../../i18n';
import { componentTokens, motion, motionPatterns, space } from '../../../theme';
import { HOME_SERVICE_ROW_ESTIMATE } from '../layout';

const fadeEasing = toEasing(motion.fast.easing);
const resizeEasing = toEasing(motion.base.easing);
const RISE = motionPatterns.homeEntrance.rise;

type Props = {
  /** The parcel tier is on (last known value, S7) and no ride is live. */
  visible: boolean;
  onRide: () => void;
  onParcel: () => void;
  /**
   * The row now counts toward the peek: true as soon as it starts to appear (the sheet grows with
   * it), false only once the cards have faded out (the sheet shrinks after the fade).
   */
  onShown: (shown: boolean) => void;
  /** The row's natural height with its 12 gap, whenever it changes by 1pt or more. */
  onHeight: (height: number) => void;
  /** True while the sheet is dragged: a swap waits until the gesture ends. */
  hold?: SharedValue<boolean>;
  /** Cold-open entrance (V7): each card's animated style. */
  rideStyle?: StyleProp<ViewStyle>;
  parcelStyle?: StyleProp<ViewStyle>;
};

/**
 * The Home service row (UI-R20b, passenger-home V2, V6): Ride and Parcel `ServiceCard`s, 12
 * apart, after the chip row. Shown only while the parcel tier is on and nothing is live; the
 * ride-only heading is retired (the tagline says "within the city").
 *
 * Off → on: the row's height eases 0 → 84 (`motion.base`, the sheet's peek grows in step), then
 * the cards fade in and rise 8 → 0 (`motion.fast`). On → off: the cards fade out (no taps from the
 * first frame), then the height eases 84 → 0 and the peek shrinks. One animated height, no
 * LayoutAnimation. Waits while the sheet is dragged; Reduce Motion swaps at once. Memoised.
 */
function HomeServiceRowBase({ visible, onRide, onParcel, onShown, onHeight, hold, rideStyle, parcelStyle }: Props) {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const [leaving, setLeaving] = useState(false);
  const shownRef = useRef(visible);
  const pending = useRef(false);
  const natural = useRef(HOME_SERVICE_ROW_ESTIMATE);
  /** -1 = natural height (no animation running or ever needed). */
  const height = useSharedValue(visible ? -1 : 0);
  const opacity = useSharedValue(visible ? 1 : 0);
  const rise = useSharedValue(0);

  const finishHide = useCallback(() => {
    setMounted(false);
    setLeaving(false);
  }, []);

  const apply = useCallback(
    (next: boolean) => {
      pending.current = false;
      if (shownRef.current === next) return;
      shownRef.current = next;
      if (next) {
        setMounted(true);
        setLeaving(false);
        onShown(true);
        if (reduce) {
          height.value = -1;
          opacity.value = 1;
          rise.value = 0;
          return;
        }
        height.value = withTiming(natural.current, { duration: motion.base.duration, easing: resizeEasing }, done => {
          if (done) height.value = -1;
        });
        rise.value = RISE;
        opacity.value = withDelay(motion.base.duration, withTiming(1, { duration: motion.fast.duration, easing: fadeEasing }));
        rise.value = withDelay(motion.base.duration, withTiming(0, { duration: motion.fast.duration, easing: fadeEasing }));
        return;
      }
      setLeaving(true);
      if (reduce) {
        height.value = 0;
        opacity.value = 0;
        onShown(false);
        finishHide();
        return;
      }
      const fromHeight = natural.current;
      height.value = fromHeight;
      opacity.value = withTiming(0, { duration: motion.fast.duration, easing: fadeEasing }, done => {
        if (!done) return;
        runOnJS(onShown)(false);
        height.value = withTiming(0, { duration: motion.base.duration, easing: resizeEasing }, shrunk => {
          if (shrunk) runOnJS(finishHide)();
        });
      });
    },
    [finishHide, height, onShown, opacity, reduce, rise],
  );

  useEffect(() => {
    if (visible === shownRef.current) return;
    if (hold?.value) {
      pending.current = true;
      return;
    }
    apply(visible);
  }, [apply, hold, visible]);

  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const flushPending = useCallback(() => {
    if (pending.current) apply(visibleRef.current);
  }, [apply]);
  useAnimatedReaction(
    () => hold?.value ?? false,
    (now, previous) => {
      if (previous === true && !now) runOnJS(flushPending)();
    },
  );

  const reported = useRef<number | null>(null);
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const next = e.nativeEvent.layout.height;
      natural.current = next;
      if (reported.current !== null && Math.abs(reported.current - next) < 1) return;
      reported.current = next;
      onHeight(next);
    },
    [onHeight],
  );

  const outerStyle = useAnimatedStyle(() => (height.value < 0 ? {} : { height: height.value }));
  const innerStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: rise.value }] }));

  if (!mounted) return null;
  return (
    <Animated.View style={[styles.clip, outerStyle]} testID="home-service-row-wrap">
      <Animated.View style={innerStyle} pointerEvents={leaving ? 'none' : 'auto'} testID="home-service-row-inner">
        <View style={styles.row} onLayout={onLayout} testID="home-service-row">
          <Animated.View style={[styles.slot, rideStyle]}>
            <ServiceCard
              kind="ride"
              title={t('home.serviceRideTitle')}
              accessibilityLabel={t('home.serviceRideA11y')}
              accessibilityHint={t('home.serviceRideHint')}
              onPress={onRide}
              testID="home-service-ride"
            />
          </Animated.View>
          <Animated.View style={[styles.slot, parcelStyle]}>
            <ServiceCard
              kind="parcel"
              title={t('home.serviceParcelTitle')}
              accessibilityLabel={t('home.serviceParcelA11y')}
              accessibilityHint={t('home.serviceParcelHint')}
              onPress={onParcel}
              testID="home-send-parcel"
            />
          </Animated.View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export const HomeServiceRow = memo(HomeServiceRowBase);

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: componentTokens.serviceCard.rowGap,
    paddingBottom: space[3],
  },
  slot: { flex: 1, minWidth: 0, flexDirection: 'row' },
});
