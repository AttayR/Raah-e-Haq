import React, { memo, useCallback, useState } from 'react';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { componentTokens, motion, radius, springs } from '../../theme';
import { AppText } from './AppText';
import { ServiceArt } from './ride/ServiceArt';
import type { ServiceKind } from './ride/serviceArtShapes';
import { usePressScale } from './usePressScale';

export type ServiceCardProps = {
  kind: ServiceKind;
  /** One word ("Ride", "Parcel"), `title`, one line. */
  title: string;
  onPress: () => void;
  /** The card's full spoken name (passenger-home S4). */
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** Kit gallery only: draws the pressed fill without a touch. */
  previewPressed?: boolean;
  testID?: string;
};

const k = componentTokens.serviceCard;

/**
 * Service card (UI-R20b, passenger-home V2; replaces UI-R20's ServiceTile): an equal entry point
 * into a service, not a toggle (no border, no selected state, no shadow). Fill by kind (Ride
 * `primarySoft`, Parcel `accentSoft`), radius `lg`, 72 min high; the one-word label 12 in from the
 * top and start; the 104 × 56 illustration bottom-end (the largest thing in the card: picture
 * first, word second), mirrored in RTL so the vehicle always faces the end edge. Press: pressed
 * fill, scale 0.98 and the art nudges 3 toward the end (`motion.instant`, spring back); Reduce
 * Motion: fill only. No haptic (not a commit). Memoised: strings and a kind only.
 */
function ServiceCardBase({ kind, title, onPress, accessibilityLabel, accessibilityHint, previewPressed = false, testID }: ServiceCardProps) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const reduce = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const nudge = useSharedValue(0);
  const rtl = I18nManager.isRTL;
  const down = pressed || previewPressed;
  const ride = kind === 'ride';
  const fill = ride ? (down ? c.primarySoftPressed : c.primarySoft) : down ? c.accentSoftPressed : c.accentSoft;

  const pressIn = useCallback(() => {
    setPressed(true);
    onPressIn();
    if (!reduce) {
      nudge.value = withTiming(rtl ? -k.pressNudge : k.pressNudge, { duration: motion.instant.duration, easing: Easing.out(Easing.quad) });
    }
  }, [nudge, onPressIn, reduce, rtl]);
  const pressOut = useCallback(() => {
    setPressed(false);
    onPressOut();
    nudge.value = reduce ? 0 : withSpring(0, springs.press);
  }, [nudge, onPressOut, reduce]);

  const artStyle = useAnimatedStyle(() => ({ transform: [{ translateX: nudge.value }] }));

  return (
    <Animated.View style={[styles.wrap, animatedStyle]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[styles.card, { backgroundColor: fill }]}
      >
        <View
          style={styles.art}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Animated.View style={artStyle}>
            <ServiceArt kind={kind} cutout={fill} flip={rtl} testID={testID ? `${testID}-art` : undefined} />
          </Animated.View>
        </View>
        <AppText variant="title" numberOfLines={1} ellipsizeMode="tail" style={styles.label}>
          {title}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

export const ServiceCard = memo(ServiceCardBase);

const styles = StyleSheet.create({
  wrap: { flex: 1, minWidth: 0 },
  card: {
    flexGrow: 1,
    minHeight: k.minHeight,
    borderRadius: radius.lg,
    overflow: 'hidden',
    paddingTop: k.labelInset,
    paddingHorizontal: k.labelInset,
  },
  label: { alignSelf: 'flex-start', maxWidth: '100%' },
  art: { position: 'absolute', end: 0, bottom: k.artBottom, width: k.artWidth, height: k.artHeight },
});

export default ServiceCard;
