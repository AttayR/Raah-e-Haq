import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { componentTokens, motion, radius, springs } from '../../../theme';
import { timing } from '../easing';

const p = componentTokens.ride.centrePin;

export type CentrePinKind = 'pickup' | 'destination' | 'stop';

export type CentrePinProps = {
  /** Destination: the logo-orange head with an `onAccent` dot (§5.21 [UI-R21]); else navy. */
  kind: CentrePinKind;
  /** The map is moving: the pin lifts 8 and its shadow shrinks (§6.6). */
  lifted: boolean;
  testID?: string;
};

/**
 * Choose-on-map centre pin (DESIGN_SYSTEM §5.21, motion §6.6; UI-R9b): drawn over the map with its
 * tip on the map's exact centre, so the point under the tip is the map region's centre. 32 tall:
 * a 20 head (navy, or `accent` for the drop-off with an 8 `onAccent` dot) on a 3 `primary` stem.
 * While the map moves the pin rises 8 and the contact shadow scales to 0.8 (150 ms); it drops
 * back on the press spring. Reduce Motion: no movement. Decorative (the card names the place);
 * takes no touches. All animation runs on the UI thread.
 */
export function CentrePin({ kind, lifted, testID = 'centre-pin' }: CentrePinProps) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const reduced = useReducedMotion();
  const lift = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      lift.value = 0;
      return;
    }
    lift.value = lifted ? withTiming(1, timing(motion.fast)) : withSpring(0, springs.press);
  }, [lifted, reduced, lift]);
  const pinStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -p.lift * lift.value }] }));
  const shadowStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - (1 - p.shadowScale) * lift.value }] }));
  const destination = kind === 'destination';
  return (
    <View
      style={styles.layer}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      {/* The tip sits on the centre: the pin is drawn in the upper half of a 2 × height box. */}
      <View style={styles.box}>
        <Animated.View
          style={[styles.shadow, { backgroundColor: c.vehicleShadow, opacity: p.shadowOpacity }, shadowStyle]}
          testID={`${testID}-shadow`}
        />
        <Animated.View style={[styles.pin, pinStyle]} testID={`${testID}-${lifted ? 'lifted' : 'resting'}`}>
          <View style={[styles.head, { backgroundColor: destination ? c.accent : c.primary }]} testID={`${testID}-head`}>
            <View style={[styles.dot, { backgroundColor: destination ? c.onAccent : c.onPrimary }]} />
          </View>
          <View style={[styles.stem, { backgroundColor: c.primary }]} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  box: { width: p.head, height: p.height * 2, alignItems: 'center' },
  pin: { position: 'absolute', top: 0, height: p.height, alignItems: 'center' },
  head: { width: p.head, height: p.head, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dot: { width: p.innerDot, height: p.innerDot, borderRadius: radius.pill },
  stem: { width: p.stem, height: p.height - p.head, borderBottomLeftRadius: p.stem, borderBottomRightRadius: p.stem },
  shadow: {
    position: 'absolute',
    top: p.height - p.shadowHeight / 2,
    width: p.shadowWidth,
    height: p.shadowHeight,
    borderRadius: radius.pill,
  },
});
