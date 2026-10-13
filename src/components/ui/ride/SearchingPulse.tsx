import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker, type LatLng } from 'react-native-maps';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { t } from '../../../i18n';
import { componentTokens, motionPatterns, radius, reducedMotion } from '../../../theme';
import { toEasing } from '../easing';
import { PinGlyph } from './MapPins';
import { useMarkerTracking } from './useMarkerTracking';

const pulse = motionPatterns.searchingPulse;
const k = componentTokens.ride.pulse;
/** The halo's outer box: the largest ring. */
export const PULSE_SIZE = Math.ceil(k.ring * pulse.scaleTo);

function Ring({ progress, color }: { progress: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => ({
    opacity: pulse.opacityFrom + (pulse.opacityTo - pulse.opacityFrom) * progress.value,
    transform: [{ scale: pulse.scaleFrom + (pulse.scaleTo - pulse.scaleFrom) * progress.value }],
  }));
  return <Animated.View style={[styles.ring, { backgroundColor: color }, style]} />;
}

function AnimatedRings({ color }: { color: string }) {
  const a = useSharedValue(0);
  const b = useSharedValue(0);
  const c = useSharedValue(0);
  useEffect(() => {
    const run = (value: SharedValue<number>, index: number) => {
      value.value = withDelay(
        index * pulse.staggerMs,
        withRepeat(withTiming(1, { duration: pulse.duration, easing: toEasing(pulse.easing) }), -1, false),
      );
    };
    [a, b, c].forEach(run);
    return () => [a, b, c].forEach(value => cancelAnimation(value));
  }, [a, b, c]);
  return (
    <>
      <Ring progress={a} color={color} />
      <Ring progress={b} color={color} />
      <Ring progress={c} color={color} />
    </>
  );
}

/**
 * Searching-for-driver pulse (DESIGN_SYSTEM §6.5): three `focusRing` rings (navy; navy-400 in dark
 * mode) grow 1 → 3.2× and fade 0.35 → 0 over 2 s, 666 ms apart, around the pickup pin. Reduced
 * motion: a static two-ring halo at 0.2 opacity.
 */
export function SearchingPulse({ showPin = true, testID }: { showPin?: boolean; testID?: string }) {
  const { theme } = useAppTheme();
  const reduced = useReducedMotion();
  const color = theme.colors.focusRing;
  return (
    <View
      style={styles.box}
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('ride.searchingA11y')}
    >
      {reduced ? (
        <View testID={testID ? `${testID}-static` : undefined} style={StyleSheet.absoluteFill}>
          {[pulse.scaleTo, (pulse.scaleTo + 1) / 2].slice(0, reducedMotion.searchingHalo.rings).map(scale => (
            <View
              key={scale}
              style={[
                styles.ring,
                { backgroundColor: color, opacity: reducedMotion.searchingHalo.opacity, transform: [{ scale }] },
              ]}
            />
          ))}
        </View>
      ) : (
        <AnimatedRings color={color} />
      )}
      {showPin ? <PinGlyph kind="pickup" /> : null}
    </View>
  );
}

/** The pulse as a map marker centred on the pickup (kept tracking while it animates). */
export function SearchingPulseMarker({ coordinate, testID }: { coordinate: LatLng; testID?: string }) {
  const { theme } = useAppTheme();
  const tracks = useMarkerTracking(theme.mode, true);
  return (
    <Marker testID={testID} coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={tracks} zIndex={3}>
      <SearchingPulse />
    </Marker>
  );
}

/**
 * The 2pt indeterminate bar at the top of the finding-driver sheet (§6.5): a `primary` band
 * sweeping across `surfaceAlt` every 1500 ms. Reduced motion: hidden (the sheet's "Finding a
 * driver…" label carries the state).
 */
export function IndeterminateBar({ testID }: { testID?: string }) {
  const { theme } = useAppTheme();
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  const [width, setWidth] = React.useState(0);
  useEffect(() => {
    if (reduced) return;
    x.value = withRepeat(withTiming(1, { duration: motionPatterns.searchingProgressLoopMs, easing: toEasing({ kind: 'linear' }) }), -1, false);
    return () => cancelAnimation(x);
  }, [reduced, x]);
  const band = width * k.progressBandRatio;
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -band + (width + band) * x.value }] }));
  if (reduced) return null;
  return (
    <View
      testID={testID}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: theme.colors.surfaceAlt }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.band, { width: band, backgroundColor: theme.colors.primary }, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: PULSE_SIZE, height: PULSE_SIZE, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: k.ring,
    height: k.ring,
    borderRadius: radius.pill,
    top: (PULSE_SIZE - k.ring) / 2,
    start: (PULSE_SIZE - k.ring) / 2,
  },
  track: { height: k.progressHeight, overflow: 'hidden', alignSelf: 'stretch' },
  band: { height: k.progressHeight, borderRadius: radius.xs },
});
