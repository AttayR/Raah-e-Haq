import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { AppText, Icon, ServiceTile } from '../../../components/ui';
import { toEasing } from '../../../components/ui/easing';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { t } from '../../../i18n';
import { componentTokens, layout, motion, space } from '../../../theme';
import { HOME_HEADER_ESTIMATE, HomeSheetHeader, type HomeHeaderKind } from './HomeSheet';

const fadeEasing = toEasing(motion.fast.easing);
const resizeEasing = toEasing(motion.base.easing);

/**
 * Service row (passenger-home § Services S2): Ride at the start (the active service, what "Where
 * to?" under it books), Parcel at the end. Two equal tiles, 12 apart, stretched to one height.
 */
const HomeServiceRow = memo(function HomeServiceRow({ onRide, onParcel }: { onRide: () => void; onParcel: () => void }) {
  return (
    <View style={styles.row} testID="home-service-row">
      <ServiceTile
        icon="rides"
        tone="primary"
        active
        title={t('home.serviceRideTitle')}
        subtitle={t('home.serviceRideSub')}
        accessibilityLabel={t('home.serviceRideA11y')}
        accessibilityHint={t('home.serviceRideHint')}
        onPress={onRide}
        testID="home-service-ride"
      />
      <ServiceTile
        icon="parcel"
        tone="accent"
        title={t('home.serviceParcelTitle')}
        subtitle={t('home.serviceParcelSub')}
        accessibilityLabel={t('home.serviceParcelA11y')}
        accessibilityHint={t('home.serviceParcelHint')}
        onPress={onParcel}
        testID="home-send-parcel"
      />
    </View>
  );
});

/** Parcel tier off (S1): one line that says plainly what Home books. One tile is not a choice. */
function RideOnlyHeading() {
  return (
    <View
      style={styles.heading}
      accessible
      accessibilityRole="header"
      accessibilityLabel={t('home.rideOnlyHeading')}
      testID="home-ride-only-heading"
    >
      <Icon name="rides" size={20} color="primaryText" />
      <AppText variant="title" numberOfLines={1} style={styles.headingText}>
        {t('home.rideOnlyHeading')}
      </AppText>
    </View>
  );
}

type Props = {
  /** Which header (S1): service row, ride-only heading, or the greeting while a ride is live. */
  kind: HomeHeaderKind;
  /** The greeting text; read only for `greeting`. */
  greeting: string;
  /** Ride tile: the "Where to?" handler. */
  onRide: () => void;
  /** Parcel tile: Send a parcel. */
  onParcel: () => void;
  /** The shown header's natural height whenever it settles on a new one (drives the peek, S5). */
  onHeight: (height: number, kind: HomeHeaderKind) => void;
  /**
   * The header now shown (after the old one faded out). The peek follows the shown header, not
   * `kind`, so it eases once, together with the header's own height.
   */
  onShown?: (kind: HomeHeaderKind) => void;
  /** True while the sheet is dragged: a swap waits until the gesture ends (S6). */
  hold?: SharedValue<boolean>;
};

/**
 * The Home sheet header (passenger-home § Services S1, S6). A change of `kind` (the parcel tier
 * switched, a ride started or ended) fades the old header out (`motion.fast`; it takes no taps
 * from the first frame), eases the header's height to the new one (`motion.base`, the sheet's
 * peek follows in step) and fades the new one in. Waits while the sheet is dragged; Reduce
 * Motion swaps at once. Memoised with boolean/string props: drags and map moves skip it.
 */
function HomeSheetTopBase({ kind, greeting, onRide, onParcel, onHeight, onShown, hold }: Props) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<HomeHeaderKind>(kind);
  const [leaving, setLeaving] = useState(false);
  const wanted = useRef(kind);
  wanted.current = kind;
  const shownRef = useRef(kind);
  const pending = useRef(false);
  const leavingRef = useRef(false);
  const opacity = useSharedValue(1);
  /** Header height; -1 until measured (it then takes its natural height). */
  const height = useSharedValue(-1);
  const heightTarget = useRef(-1);

  const commit = useCallback(() => {
    const next = wanted.current;
    const resized = HOME_HEADER_ESTIMATE[next] !== HOME_HEADER_ESTIMATE[shownRef.current];
    shownRef.current = next;
    leavingRef.current = false;
    setShown(next);
    onShown?.(next);
    setLeaving(false);
    // The new header fades in once the height has eased to it.
    const fadeIn = withTiming(1, { duration: motion.fast.duration, easing: fadeEasing });
    opacity.value = reduce ? 1 : resized ? withDelay(motion.base.duration, fadeIn) : fadeIn;
  }, [onShown, opacity, reduce]);

  const swap = useCallback(() => {
    pending.current = false;
    if (reduce) {
      commit();
      return;
    }
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    opacity.value = withTiming(0, { duration: motion.fast.duration, easing: fadeEasing }, finished => {
      if (finished) runOnJS(commit)();
    });
  }, [commit, opacity, reduce]);

  useEffect(() => {
    if (kind === shownRef.current && !leavingRef.current) return;
    if (hold?.value) {
      pending.current = true;
      return;
    }
    swap();
  }, [hold, kind, swap]);

  const flushPending = useCallback(() => {
    if (pending.current) swap();
  }, [swap]);
  useAnimatedReaction(
    () => hold?.value ?? false,
    (now, previous) => {
      if (previous === true && !now) runOnJS(flushPending)();
    },
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const next = e.nativeEvent.layout.height;
      if (heightTarget.current >= 0 && Math.abs(heightTarget.current - next) < 1) return;
      const first = heightTarget.current < 0;
      heightTarget.current = next;
      height.value = first || reduce ? next : withTiming(next, { duration: motion.base.duration, easing: resizeEasing });
      onHeight(next, shownRef.current);
    },
    [height, onHeight, reduce],
  );

  const outerStyle = useAnimatedStyle(() => (height.value < 0 ? {} : { height: height.value }));
  const innerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.clip, outerStyle]}>
      <Animated.View
        style={innerStyle}
        onLayout={onLayout}
        pointerEvents={leaving ? 'none' : 'auto'}
        testID="home-sheet-top"
      >
        {shown === 'services' ? (
          <HomeServiceRow onRide={onRide} onParcel={onParcel} />
        ) : shown === 'rideOnly' ? (
          <RideOnlyHeading />
        ) : (
          <HomeSheetHeader greeting={greeting} />
        )}
      </Animated.View>
    </Animated.View>
  );
}

export const HomeSheetTop = memo(HomeSheetTopBase);

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: componentTokens.serviceTile.rowGap,
    paddingHorizontal: layout.gutter,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: HOME_HEADER_ESTIMATE.rideOnly,
    paddingHorizontal: layout.gutter,
  },
  headingText: { flex: 1, minWidth: 0 },
});
