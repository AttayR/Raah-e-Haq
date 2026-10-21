import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { componentTokens, layout, motion, motionPatterns, reducedMotion, space, springs } from '../../../theme';
import { toEasing } from '../../ui/easing';

const k = componentTokens.requestSheet;
const exitEasing = toEasing(motion.exit.easing);
const baseEasing = toEasing(motion.base.easing);
const reducedEasing = toEasing(reducedMotion.sheetSnap.easing);
/** Rises from below without overshoot: the sheet is pinned to the bottom edge. */
const riseSpring = { ...springs.sheet, overshootClamping: true };

type Props = React.PropsWithChildren<{
  /** False while it slides out (decline, timeout, taken); `onHidden` follows. */
  visible: boolean;
  /** A new key swaps the content (§6.12): fade + 8 rise in `motion.base`, the sheet stays up. */
  contentKey: string | number;
  /** Sticky footer (Decline + Accept, Go to pickup); none for the taken / gone state. */
  footer?: React.ReactNode;
  /** The sheet has finished rising (the request's clock may start). */
  onShown?: () => void;
  /** The sheet is off screen after `visible` turned false. */
  onHidden?: () => void;
  /** The sheet's laid-out height (camera padding on the Drive map, R1). */
  onHeightChange?: (height: number) => void;
  testID?: string;
}>;

/**
 * The incoming request sheet (UI-R11, driver-incoming-request R1; DESIGN_SYSTEM §8.3 `request`
 * mode): the Drive sheet's surface in its request form, mounted by RideRequestHost above the
 * tabs (T-408) while the Drive sheet steps aside. Full width at the bottom, no
 * handle, not draggable, content height capped at 70 % of the window (the children give way:
 * the route scrolls), top radius `xl`, `surface`, elevation 3 (dark: 1 pt top `border`), and a
 * sticky footer `max(insets.bottom + 8, 16)` from the bottom. Rises on the sheet spring
 * (clamped), leaves in `motion.exit`; Reduce Motion: 200 ms timing, no rise on content swaps.
 * Transform and opacity only, on the UI thread.
 */
export function RequestSheet({
  visible,
  contentKey,
  footer,
  onShown,
  onHidden,
  onHeightChange,
  testID,
  children,
}: Props) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduce = useReducedMotion();
  const maxHeight = Math.round(windowHeight * k.maxWindowRatio);
  const footerBottom = Math.max(insets.bottom + layout.bottomActionOffset, layout.bottomActionMinOffset);

  const shownRef = useRef(onShown);
  shownRef.current = onShown;
  const hiddenRef = useRef(onHidden);
  hiddenRef.current = onHidden;
  const heightRef = useRef(0);
  const notifyShown = useCallback(() => shownRef.current?.(), []);
  const notifyHidden = useCallback(() => hiddenRef.current?.(), []);

  const offset = useSharedValue(windowHeight);
  useEffect(() => {
    if (visible) {
      const done = (finished?: boolean) => {
        'worklet';
        if (finished) runOnJS(notifyShown)();
      };
      offset.value = reduce
        ? withTiming(
            0,
            {
              duration: reducedMotion.sheetSnap.duration,
              easing: reducedEasing,
            },
            done,
          )
        : withSpring(0, riseSpring, done);
      return;
    }
    const gone = (finished?: boolean) => {
      'worklet';
      if (finished) runOnJS(notifyHidden)();
    };
    offset.value = withTiming(
      heightRef.current || windowHeight,
      { duration: motion.exit.duration, easing: exitEasing },
      gone,
    );
  }, [notifyHidden, notifyShown, offset, reduce, visible, windowHeight]);

  const swap = useSharedValue(1);
  const firstKey = useRef(contentKey);
  useEffect(() => {
    if (firstKey.current === contentKey) return;
    firstKey.current = contentKey;
    swap.value = 0;
    swap.value = withTiming(1, {
      duration: reduce ? reducedMotion.listAppear.duration : motion.base.duration,
      easing: baseEasing,
    });
  }, [contentKey, reduce, swap]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: swap.value,
    transform: [
      {
        translateY: reduce ? 0 : (1 - swap.value) * motionPatterns.sheetContentSwap.translateY,
      },
    ],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const height = Math.round(e.nativeEvent.layout.height);
    if (Math.abs(height - heightRef.current) < 1) return;
    heightRef.current = height;
    onHeightChange?.(height);
  };

  return (
    <Animated.View
      style={[
        styles.sheet,
        theme.elevation[3],
        {
          maxHeight,
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
        theme.mode === 'dark' ? { borderTopWidth: theme.borderWidth.thin } : null,
        sheetStyle,
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
      onLayout={onLayout}
      testID={testID}
    >
      <Animated.View style={[styles.content, contentStyle]}>{children}</Animated.View>
      {footer ? (
        <View style={[styles.footer, { paddingBottom: footerBottom }]} testID={testID ? `${testID}-footer` : undefined}>
          {footer}
        </View>
      ) : (
        <View style={{ height: footerBottom }} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    borderTopStartRadius: componentTokens.sheet.radius,
    borderTopEndRadius: componentTokens.sheet.radius,
    paddingTop: k.topPadding,
  },
  // Gives way first when the sheet hits its cap (the route inside scrolls).
  content: { flexShrink: 1, paddingHorizontal: layout.gutter },
  footer: {
    flexDirection: 'row',
    gap: space[3],
    paddingHorizontal: layout.gutter,
    paddingTop: componentTokens.sheet.footerTopPadding,
  },
});
