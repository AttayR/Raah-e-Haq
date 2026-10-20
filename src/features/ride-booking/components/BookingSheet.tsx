import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { useKeyboardHeight } from '../../../hooks/useKeyboardHeight';
import { KeyboardRevealProvider, type RevealScrollable } from '../../../components/ui/keyboardReveal';
import { componentTokens, radius, space } from '../../../theme';
import { MAP_TOP_CONTROLS_HEIGHT } from './MapTopControls';

/** UI-R9b: a drag inside the sheet (a stop being reordered) holds the sheet's scroll. */
const SheetScrollLockContext = createContext<((locked: boolean) => void) | undefined>(undefined);
export const useSheetScrollLock = (): ((locked: boolean) => void) | undefined => useContext(SheetScrollLockContext);

type Props = {
  children: React.ReactNode;
  /** Reports the sheet's height so the map keeps its points above it (T-314). */
  onHeightChange?: (height: number) => void;
  /**
   * Cap as a share of the window (e.g. 0.5) so the route stays visible above the sheet on the
   * vehicle / fare / ride steps (DESIGN_SYSTEM 5.14). Content scrolls inside.
   */
  maxHeightRatio?: number;
  /**
   * The step's single primary action, pinned under the scrolling content and above the home
   * indicator (DESIGN_SYSTEM §5.14/§9 map pattern, T-564): 12 above it, `max(insets.bottom + 8,
   * 16)` below it, 8 above the keyboard. Long content scrolls behind it, so it is never cut off.
   */
  footer?: React.ReactNode;
  /**
   * Drawn flush at the sheet's top edge, inside the top-radius clip (UI-R10: the finding-driver
   * indeterminate bar, passenger-finding-driver.md block 1). Decorative; takes no touches.
   */
  topAccessory?: React.ReactNode;
  /** Start scrolled to the end of the content (Debug gallery evidence only). */
  revealEnd?: boolean;
  /**
   * UI-R9b: the centre-pin picker covers the map: the sheet stays mounted (typed text, focus and
   * scroll are kept) but is not drawn and reports no height meanwhile.
   */
  hidden?: boolean;
  /** UI-R10 polish: the sheet reached its cap under the map controls (the locate control hides). */
  onFullChange?: (full: boolean) => void;
  testID?: string;
};

/**
 * The booking map's bottom sheet (DESIGN_SYSTEM 5.14): `surface`, top radius 24, upward
 * shadow, bottom safe-area inset. It never grows under the map controls; longer content
 * scrolls inside, clipped 24 below the top (the kit sheet's content top) with a hairline once
 * scrolled, so nothing slides under the handle half cut (T-539). On iOS it rides above the
 * keyboard (Android resizes the window itself, `adjustResize`), so search suggestions stay
 * visible while typing. T-553: a focused search field and its suggestions are scrolled into the
 * visible part of the sheet (the kit keyboard reveal), e.g. the stop search at the end of the
 * vehicle step.
 */
export const BookingSheet: React.FC<Props> = ({
  children,
  onHeightChange,
  maxHeightRatio,
  footer,
  topAccessory,
  revealEnd = false,
  hidden = false,
  onFullChange,
  testID = 'booking-sheet',
}) => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const keyboardHeight = useKeyboardHeight();
  const keyboardOffset = Platform.OS === 'ios' ? keyboardHeight : 0;
  const keyboardUp = keyboardHeight > 0;
  const belowControls = windowHeight - insets.top - MAP_TOP_CONTROLS_HEIGHT - space[4] - keyboardOffset;
  // The ratio cap applies only while the keyboard is down (typing needs the room).
  const ratioCap = maxHeightRatio && !keyboardUp ? windowHeight * maxHeightRatio : Infinity;
  const maxHeight = Math.max(0, Math.min(belowControls, ratioCap));
  const [scrolled, setScrolled] = useState(false);
  const [scrollLocked, setScrollLocked] = useState(false);
  const full = useRef<boolean | null>(null);
  const lastHeight = useRef<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    if (hidden) return;
    const height = e.nativeEvent.layout.height;
    lastHeight.current = height;
    onHeightChange?.(height);
    const isFull = maxHeight > 0 && height >= maxHeight - 1;
    if (full.current !== isFull) {
      full.current = isFull;
      onFullChange?.(isFull);
    }
  };
  // Shown again (the picker closed): the map controls ride on this sheet's height again at once,
  // even when its layout did not change while it was hidden.
  const onHeightRef = useRef(onHeightChange);
  onHeightRef.current = onHeightChange;
  useEffect(() => {
    if (!hidden && lastHeight.current !== null) onHeightRef.current?.(lastHeight.current);
  }, [hidden]);
  const scrollRef = useRef<ScrollView | null>(null);
  const getScroll = useCallback((): RevealScrollable | null => scrollRef.current, []);
  // UI-R10: the footer gets a top hairline while content runs on beneath it (not scrolled to the
  // end), like the handle band once scrolled. Only a change of the boolean re-renders.
  const metrics = useRef({ offset: 0, viewport: 0, content: 0 });
  const [moreBelow, setMoreBelow] = useState(false);
  const updateMoreBelow = () => {
    const { offset, viewport, content } = metrics.current;
    const next = viewport > 0 && content - (offset + viewport) > 1;
    setMoreBelow((prev) => (prev === next ? prev : next));
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    // Some scroll events (and test events) carry only the offset: keep the last known sizes.
    const last = metrics.current;
    metrics.current = {
      offset: contentOffset.y,
      viewport: (layoutMeasurement as typeof layoutMeasurement | undefined)?.height ?? last.viewport,
      content: (contentSize as typeof contentSize | undefined)?.height ?? last.content,
    };
    updateMoreBelow();
    const next = contentOffset.y > 0;
    if (next !== scrolled) setScrolled(next);
  };
  const onScrollLayout = (e: LayoutChangeEvent) => {
    metrics.current.viewport = e.nativeEvent.layout.height;
    updateMoreBelow();
  };
  const onContentSizeChange = (_w: number, h: number) => {
    metrics.current.content = h;
    updateMoreBelow();
    if (revealEnd) scrollRef.current?.scrollToEnd({ animated: false });
  };

  return (
    <View
      testID={testID}
      onLayout={onLayout}
      style={[
        styles.sheet,
        hidden ? styles.hidden : null,
        theme.elevation[3],
        {
          bottom: keyboardOffset,
          maxHeight,
          backgroundColor: theme.colors.surface,
        },
        theme.mode === 'dark' ? { borderWidth: theme.borderWidth.thin, borderColor: theme.colors.border } : null,
      ]}
    >
      {topAccessory ? (
        <View style={styles.topAccessory} pointerEvents="none" testID={`${testID}-top-accessory`}>
          {topAccessory}
        </View>
      ) : null}
      <View
        style={[
          styles.handleArea,
          scrolled ? { borderBottomWidth: theme.borderWidth.thin, borderBottomColor: theme.colors.border } : null,
        ]}
        testID={`${testID}-handle-area`}
      >
        <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        onScroll={onScroll}
        onLayout={onScrollLayout}
        onContentSizeChange={onContentSizeChange}
        scrollEventThrottle={16}
        scrollEnabled={!scrollLocked}
        testID={`${testID}-scroll`}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: (keyboardUp || footer ? 0 : insets.bottom) + space[4] },
        ]}
      >
        <SheetScrollLockContext.Provider value={setScrollLocked}>
          <KeyboardRevealProvider getScroll={getScroll}>{children}</KeyboardRevealProvider>
        </SheetScrollLockContext.Provider>
      </ScrollView>
      {footer ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: keyboardUp ? space[2] : Math.max(insets.bottom + space[2], space[4]) },
            moreBelow ? { borderTopWidth: theme.borderWidth.thin, borderTopColor: theme.colors.border } : null,
          ]}
          testID={`${testID}-footer`}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    start: 0,
    end: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderBottomWidth: 0,
  },
  // Clipped by the sheet's own top radius (the sheet itself cannot clip: that would cut its shadow).
  topAccessory: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    height: radius.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
    zIndex: 1,
  },
  // The handle 8 from the top in a fixed 24pt band: the scroll (and its clipping) starts below it.
  handleArea: { height: componentTokens.sheet.contentTop, alignItems: 'center', paddingTop: componentTokens.sheet.handleTop },
  handle: { width: componentTokens.sheet.handleWidth, height: componentTokens.sheet.handleHeight, borderRadius: radius.pill },
  scroll: { flexGrow: 0 },
  hidden: { display: 'none' },
  content: { paddingHorizontal: space[4], gap: space[3] },
  // §5.14: 16 above the footer action.
  footer: { paddingHorizontal: space[4], paddingTop: space[4] },
});

export default BookingSheet;
