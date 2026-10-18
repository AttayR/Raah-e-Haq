import React, { useCallback, useRef, useState } from 'react';
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
export const BookingSheet: React.FC<Props> = ({ children, onHeightChange, maxHeightRatio, footer, testID = 'booking-sheet' }) => {
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
  const scrollRef = useRef<ScrollView | null>(null);
  const getScroll = useCallback((): RevealScrollable | null => scrollRef.current, []);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = e.nativeEvent.contentOffset.y > 0;
    if (next !== scrolled) setScrolled(next);
  };

  return (
    <View
      testID={testID}
      onLayout={(e: LayoutChangeEvent) => onHeightChange?.(e.nativeEvent.layout.height)}
      style={[
        styles.sheet,
        theme.elevation[3],
        {
          bottom: keyboardOffset,
          maxHeight,
          backgroundColor: theme.colors.surface,
        },
        theme.mode === 'dark' ? { borderWidth: theme.borderWidth.thin, borderColor: theme.colors.border } : null,
      ]}
    >
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
        scrollEventThrottle={16}
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
        <KeyboardRevealProvider getScroll={getScroll}>{children}</KeyboardRevealProvider>
      </ScrollView>
      {footer ? (
        <View
          style={[styles.footer, { paddingBottom: keyboardUp ? space[2] : Math.max(insets.bottom + space[2], space[4]) }]}
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
  // The handle 8 from the top in a fixed 24pt band: the scroll (and its clipping) starts below it.
  handleArea: { height: componentTokens.sheet.contentTop, alignItems: 'center', paddingTop: componentTokens.sheet.handleTop },
  handle: { width: componentTokens.sheet.handleWidth, height: componentTokens.sheet.handleHeight, borderRadius: radius.pill },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: space[4], gap: space[3] },
  footer: { paddingHorizontal: space[4], paddingTop: space[3] },
});

export default BookingSheet;
