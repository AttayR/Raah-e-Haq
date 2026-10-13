import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { t } from '../../i18n';
import { componentTokens, layout, motion, motionPatterns, reducedMotion, space, springs } from '../../theme';
import { toEasing } from './easing';
import { ModalRoot } from './ModalRoot';
import { releaseTarget, resolveSnaps, type ResolvedSnap, type SheetSnap } from './sheetSnaps';

export type { SheetSnap } from './sheetSnaps';

export type BottomSheetHandle = {
  /** Springs to a snap point (state changes: booking step, incoming request). */
  snapTo: (snap: SheetSnap) => void;
  /** Modal sheets: animates out, then calls `onClose`. Map sheets: collapses to the lowest snap. */
  close: () => void;
};

export type BottomSheetProps = React.PropsWithChildren<{
  /**
   * `map` (default): sits on the map, no scrim, the map stays interactive above it.
   * `modal`: pickers and confirmations in a native Modal over an `overlay` scrim; tapping the
   * scrim, Android back or dragging it down closes it.
   */
  mode?: 'map' | 'modal';
  /** Map default `['peek', 'half', 'full']`; modal default `['content']`. */
  snapPoints?: readonly SheetSnap[];
  /** Height of `peek` (170 passenger Home, 137 driver Drive, §8.3). Without it, `peek` = content. */
  peekHeight?: number;
  /** Where the sheet opens. Default: the lowest snap. */
  initialSnap?: SheetSnap;
  /** Modal mode only. */
  visible?: boolean;
  onClose?: () => void;
  onSnapChange?: (snap: SheetSnap, height: number) => void;
  /** Written with the visible height on every frame (camera padding, controls that ride the sheet). */
  animatedHeight?: SharedValue<number>;
  /** Drag area under the handle (sheet title, status row). The handle is always draggable. */
  header?: React.ReactNode;
  /** Sticky footer (the one primary action): above the home indicator and the keyboard. */
  footer?: React.ReactNode;
  /** Changing it cross-fades the content (§6.12): old out in 100 ms, new in + 8pt rise in 250 ms. */
  contentKey?: string | number;
  /** Springs to `full` while a field inside is focused (§5.14). Default true. */
  expandOnKeyboard?: boolean;
  /**
   * False while the host screen is not focused (another tab or a pushed screen covers it): the
   * sheet then registers no Android back handler and no keyboard listeners, so a hidden tab's
   * sheet never eats Back or jumps to `full` for someone else's field. Default true.
   */
  active?: boolean;
  /** Read by screen readers on the handle. */
  accessibilityLabel?: string;
  testID?: string;
}>;

const k = componentTokens.sheet;
const swapEasing = toEasing(motion.base.easing);

/**
 * BottomSheet (DESIGN_SYSTEM §5.14, §6.2, §6.12, §8.3), built on Reanimated 4 + Gesture Handler
 * (no extra dependency): top radius 24, `surface`, elevation 3 (upward), handle 36×5 8 from the
 * top, content 24 from the top. Snap points from props (`peek`, `half`, `full`, `content`), drag
 * on the handle and header with release velocity, programmatic `snapTo`, inner scroll only at
 * the highest snap, a sticky footer above the home indicator and the keyboard, and `full` while
 * the keyboard is up. Spring: damping 24, stiffness 260; reduced motion: 200 ms timing, no
 * overshoot, no content-swap slide.
 */
export const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>(function BottomSheet(
  {
    mode = 'map',
    snapPoints,
    peekHeight,
    initialSnap,
    visible = true,
    onClose,
    onSnapChange,
    animatedHeight,
    header,
    footer,
    contentKey,
    expandOnKeyboard = true,
    active = true,
    accessibilityLabel,
    testID,
    children,
  },
  ref,
) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const modal = mode === 'modal';
  const snaps = useMemo<readonly SheetSnap[]>(
    () => snapPoints ?? (modal ? ['content'] : ['peek', 'half', 'full']),
    [modal, snapPoints],
  );

  // Measured sizes.
  const [containerHeight, setContainerHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [bodyHeight, setBodyHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const footerBottom = Math.max(insets.bottom + layout.bottomActionOffset, layout.bottomActionMinOffset);
  const footerBlock = footer ? footerHeight : 0;
  // [T-519] While the keyboard is up (iOS) it covers the bottom of the sheet, so a `content`
  // sheet grows by its height (capped at `full`) instead of hiding its body under the keyboard.
  const contentHeight = k.contentTop + headerHeight + bodyHeight + (footer ? footerBlock : footerBottom) + keyboardHeight;

  const resolved = useMemo(
    () =>
      resolveSnaps(snaps, {
        containerHeight,
        topInset: insets.top,
        peekHeight,
        contentHeight: bodyHeight > 0 || headerHeight > 0 ? contentHeight : undefined,
        minHeight: k.contentTop + headerHeight + footerBlock,
      }),
    [bodyHeight, containerHeight, contentHeight, footerBlock, headerHeight, insets.top, peekHeight, snaps],
  );

  // Position: points from the container top to the sheet top. Off-screen until measured.
  const top = useSharedValue(100000);
  const container = useSharedValue(0);
  const [current, setCurrent] = useState<SheetSnap | null>(null);
  const [mounted, setMounted] = useState(modal ? visible : true);
  const restoreSnap = useRef<SheetSnap | null>(null);
  const containerRef = useRef(0);

  const animateTo = useCallback(
    (height: number, velocity = 0, done?: () => void, containerOnJS?: number) => {
      'worklet';
      // On the JS thread pass the container height: a `.value` read there goes to the UI runtime
      // and can still see the previous (unmeasured) value right after a JS write.
      const target = (containerOnJS ?? container.value) - height;
      const finished = (ok?: boolean) => {
        'worklet';
        if (ok && done) runOnJS(done)();
      };
      top.value = reduce
        ? withTiming(target, { duration: reducedMotion.sheetSnap.duration, easing: swapEasing }, finished)
        : withSpring(target, { ...springs.sheet, velocity }, finished);
    },
    [container, reduce, top],
  );

  // Refs so a settle (state + callback) never re-triggers the placement effect mid-spring.
  const currentRef = useRef<SheetSnap | null>(null);
  const onSnapChangeRef = useRef(onSnapChange);
  onSnapChangeRef.current = onSnapChange;
  const settledHeight = useRef(0);
  const settle = useCallback((snap: ResolvedSnap) => {
    if (currentRef.current === snap.snap && Math.abs(settledHeight.current - snap.height) < 1) return;
    currentRef.current = snap.snap;
    settledHeight.current = snap.height;
    setCurrent(snap.snap);
    onSnapChangeRef.current?.(snap.snap, snap.height);
  }, []);

  const snapTo = useCallback(
    (snap: SheetSnap) => {
      const target = resolved.find(r => r.snap === snap) ?? resolved[resolved.length - 1];
      if (!target) return;
      animateTo(target.height, 0, undefined, containerRef.current);
      settle(target);
    },
    [animateTo, resolved, settle],
  );

  const unmount = useCallback(() => {
    setMounted(false);
    currentRef.current = null;
    setCurrent(null);
  }, []);

  const finishClose = useCallback(() => {
    unmount();
    onClose?.();
  }, [onClose, unmount]);

  const close = useCallback(() => {
    if (!modal) {
      if (resolved[0]) snapTo(resolved[0].snap);
      return;
    }
    animateTo(0, 0, finishClose, containerRef.current);
  }, [animateTo, finishClose, modal, resolved, snapTo]);

  useImperativeHandle(ref, () => ({ snapTo, close }), [close, snapTo]);

  // Modal visibility from the parent.
  useEffect(() => {
    if (!modal) return;
    if (visible) {
      setMounted(true);
    } else if (mounted) {
      animateTo(0, 0, unmount, containerRef.current);
    }
  }, [animateTo, modal, mounted, unmount, visible]);

  // First placement once the container (and, for content snaps, the content) is measured, and
  // re-placement when the snap heights change (rotation, content swap on a `content` snap).
  const initialSnapRef = useRef(initialSnap);
  useEffect(() => {
    if (!mounted || containerHeight === 0 || resolved.length === 0) return;
    container.value = containerHeight;
    containerRef.current = containerHeight;
    const wanted = currentRef.current ?? initialSnapRef.current ?? resolved[0].snap;
    const target = resolved.find(r => r.snap === wanted) ?? resolved[0];
    if (currentRef.current === null) {
      // Opening: start below the screen, then rise with the spring.
      top.value = containerHeight;
    }
    animateTo(target.height, 0, undefined, containerHeight);
    settle(target);
  }, [animateTo, container, containerHeight, mounted, resolved, settle, top]);

  // [T-519] Visible body height (between the header and the footer / keyboard) for the
  // focused-field scroll below; a ref so the keyboard listeners need not re-subscribe.
  const scrollRef = useRef<ScrollView>(null);
  const bodyContentRef = useRef<View>(null);
  const visibleBody = useRef(0);
  const bodyHeightRef = useRef(0);
  bodyHeightRef.current = bodyHeight;
  visibleBody.current =
    (resolved[resolved.length - 1]?.height ?? 0) - k.contentTop - headerHeight - (footer ? footerBlock : footerBottom) - keyboardHeight;

  // [T-519] Once the keyboard is up and the sheet has grown, scroll the focused field inside the
  // body into view (its bottom just above the footer; its top first when it is taller than that).
  const revealFocusedField = useCallback(() => {
    const input = TextInput.State?.currentlyFocusedInput?.();
    const content = bodyContentRef.current;
    if (!input || !content) return;
    input.measureLayout(
      content,
      (_x, y, _width, height) => {
        if (y < 0 || y > bodyHeightRef.current) return; // Not a field of this sheet.
        const margin = space[2];
        const target = Math.max(0, Math.min(y - margin, y + height + margin - visibleBody.current));
        scrollRef.current?.scrollTo({ y: target, animated: !reduce });
      },
      () => {},
    );
  }, [reduce]);
  useEffect(() => {
    if (!mounted || !active) return undefined;
    const sub = Keyboard.addListener('keyboardDidShow', revealFocusedField);
    return () => sub.remove();
  }, [active, mounted, revealFocusedField]);

  // Keyboard: go `full` while a field inside is focused; the footer rides above the keyboard.
  useEffect(() => {
    if (!mounted || !active) return undefined;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, event => {
      // Android resizes the window (adjustResize), so only iOS lifts the footer itself.
      setKeyboardHeight(Platform.OS === 'ios' ? event.endCoordinates.height : 0);
      if (expandOnKeyboard && current !== 'full') {
        restoreSnap.current = current;
        const highest = resolved[resolved.length - 1];
        if (highest) snapTo(snaps.includes('full') ? 'full' : highest.snap);
      }
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      if (restoreSnap.current) {
        snapTo(restoreSnap.current);
        restoreSnap.current = null;
      }
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [active, current, expandOnKeyboard, mounted, resolved, snapTo, snaps]);

  // Android back: a modal sheet closes; a raised map sheet collapses before navigation goes back.
  useEffect(() => {
    if (modal || !mounted || !active) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (resolved.length > 1 && current !== resolved[0].snap) {
        snapTo(resolved[0].snap);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [active, current, modal, mounted, resolved, snapTo]);

  // Publish the visible height for camera padding and riding controls.
  useAnimatedReaction(
    () => Math.max(0, container.value - top.value),
    height => {
      if (animatedHeight) animatedHeight.value = height;
    },
  );

  const startTop = useSharedValue(0);
  const pan = useMemo(() => {
    const highest = resolved[resolved.length - 1];
    const lowest = resolved[0];
    return Gesture.Pan()
      .activeOffsetY([-6, 6])
      .onStart(() => {
        startTop.value = top.value;
      })
      .onUpdate(event => {
        if (!highest || !lowest) return;
        const minTop = container.value - highest.height;
        // A map sheet stops at its lowest snap; a modal one follows the finger down to close.
        const maxTop = modal ? container.value : container.value - lowest.height;
        top.value = Math.min(Math.max(startTop.value + event.translationY, minTop), maxTop);
      })
      .onEnd(event => {
        if (!lowest) return;
        const height = container.value - top.value;
        const target = releaseTarget(height, event.velocityY, resolved, modal);
        if (target === 'close') {
          animateTo(0, event.velocityY, finishClose);
          return;
        }
        // `top` grows as the sheet moves down, so the finger's velocity carries over as is.
        animateTo(target.height, event.velocityY);
        runOnJS(settle)(target);
      });
  }, [animateTo, container, finishClose, modal, resolved, settle, startTop, top]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: top.value }] }));
  const scrimStyle = useAnimatedStyle(() => {
    const lowest = resolved[0]?.height ?? 1;
    return {
      opacity: interpolate(container.value - top.value, [0, lowest], [0, 1], Extrapolation.CLAMP),
    };
  });
  // The footer stays pinned to the container bottom; it only follows a modal sheet that is
  // dragged below its lowest snap (closing).
  const footerStyle = useAnimatedStyle(() => {
    const lowest = resolved[0]?.height ?? 0;
    const restTop = container.value - lowest;
    return { transform: [{ translateY: Math.max(0, top.value - restTop) }] };
  });

  const highestSnap = resolved[resolved.length - 1]?.snap;
  const scrollable = current !== null && current === highestSnap;
  const sheetHeight = resolved[resolved.length - 1]?.height ?? 0;

  const onContainerLayout = (e: LayoutChangeEvent) => setContainerHeight(Math.round(e.nativeEvent.layout.height));

  const expandCollapse = (direction: 'increment' | 'decrement') => {
    const index = resolved.findIndex(r => r.snap === current);
    const next = resolved[Math.min(Math.max(index + (direction === 'increment' ? 1 : -1), 0), resolved.length - 1)];
    if (next) snapTo(next.snap);
  };

  const swapIn = reduce
    ? FadeIn.duration(reducedMotion.listAppear.duration)
    : FadeIn.duration(motionPatterns.sheetContentSwap.duration)
        .easing(swapEasing)
        .withInitialValues({ transform: [{ translateY: motionPatterns.sheetContentSwap.translateY }] });
  const swapOut = FadeOut.duration(motion.instant.duration);

  const sheet = (
    <Animated.View
      testID={testID}
      style={[
        styles.sheet,
        theme.elevation[3],
        { height: sheetHeight, backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        // Dark mode always, light mode at `full`: a 1pt top edge (§8.3).
        theme.mode === 'dark' || current === 'full' ? { borderTopWidth: theme.borderWidth.thin } : null,
        sheetStyle,
      ]}
    >
      <GestureDetector gesture={pan}>
        <View>
          <View
            style={styles.handleArea}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={accessibilityLabel ?? t('kit.sheetHandleA11y')}
            accessibilityHint={t('kit.sheetHandleHint')}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={e => expandCollapse(e.nativeEvent.actionName === 'increment' ? 'increment' : 'decrement')}
            testID={testID ? `${testID}-handle` : undefined}
          >
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          </View>
          {header ? (
            <View onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)} testID={testID ? `${testID}-header` : undefined}>
              {header}
            </View>
          ) : null}
        </View>
      </GestureDetector>
      <ScrollView
        ref={scrollRef}
        style={styles.body}
        scrollEnabled={scrollable}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={scrollable}
        contentContainerStyle={{ paddingBottom: (footer ? footerBlock : footerBottom) + keyboardHeight }}
        testID={testID ? `${testID}-scroll` : undefined}
      >
        <View
          ref={bodyContentRef}
          onLayout={e => setBodyHeight(e.nativeEvent.layout.height)}
          testID={testID ? `${testID}-body` : undefined}
        >
          {contentKey !== undefined ? (
            <Animated.View key={contentKey} entering={swapIn} exiting={swapOut}>
              {children}
            </Animated.View>
          ) : (
            children
          )}
        </View>
      </ScrollView>
    </Animated.View>
  );

  const footerView = footer ? (
    <Animated.View
      style={[
        styles.footer,
        {
          paddingBottom: keyboardHeight > 0 ? space[2] : footerBottom,
          bottom: keyboardHeight,
          backgroundColor: theme.colors.surface,
        },
        footerStyle,
      ]}
      onLayout={e => setFooterHeight(e.nativeEvent.layout.height)}
      testID={testID ? `${testID}-footer` : undefined}
    >
      {footer}
    </Animated.View>
  ) : null;

  if (!modal) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={onContainerLayout}>
        {sheet}
        {footerView}
      </View>
    );
  }

  if (!mounted) {
    return null;
  }
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <ModalRoot>
        <View style={styles.fill} onLayout={onContainerLayout}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay }, scrimStyle]}>
            <Pressable
              style={styles.fill}
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              testID={testID ? `${testID}-scrim` : undefined}
            />
          </Animated.View>
          {sheet}
          {footerView}
        </View>
      </ModalRoot>
    </Modal>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sheet: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    borderTopStartRadius: k.radius,
    borderTopEndRadius: k.radius,
  },
  // Handle 8 from the top; content starts 24 from the top (8 + 5 + 11).
  handleArea: {
    height: k.contentTop,
    alignItems: 'center',
    paddingTop: k.handleTop,
  },
  handle: { width: k.handleWidth, height: k.handleHeight, borderRadius: k.handleHeight },
  body: { flex: 1 },
  footer: {
    position: 'absolute',
    start: 0,
    end: 0,
    paddingHorizontal: layout.gutter,
    paddingTop: k.footerTopPadding,
  },
});
