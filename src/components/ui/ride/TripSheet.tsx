import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { componentTokens, layout, textStyles } from '../../../theme';
import { BottomSheet, type BottomSheetHandle, type SheetSnap } from '../BottomSheet';

const k = componentTokens.tripSheet;
const sheet = componentTokens.sheet;

const TRIP_SNAPS: readonly SheetSnap[] = ['peek', 'content'];
const RECEIPT_SNAPS: readonly SheetSnap[] = ['content'];

/**
 * The `peek` height of a trip sheet (shared-trip-sheet TS1): handle area 24 + status header +
 * the peek group + the bottom block (the sticky footer, else `max(insets.bottom + 8, 16)`).
 * Null until the header and the peek group are measured.
 */
export const tripPeekHeight = ({
  header,
  peek,
  footer,
  bottomInset,
  footerBlock,
}: {
  header: number;
  peek: number;
  /** Measured footer content (0 without a footer). */
  footer: number;
  bottomInset: number;
  /**
   * [UI-R13] The footer as the sheet laid it out (padding, content, bottom inset); preferred over
   * the estimate from `footer` once measured, so the last peek block (the waiting timer) is never
   * cut by the footer.
   */
  footerBlock?: number;
}): number | null => {
  if (header <= 0 || peek <= 0) return null;
  const bottom = Math.max(bottomInset + layout.bottomActionOffset, layout.bottomActionMinOffset);
  const estimate = footer > 0 ? sheet.footerTopPadding + footer + bottom : bottom;
  const block = footer > 0 && footerBlock !== undefined && footerBlock > 0 ? footerBlock : estimate;
  // Rounded up: a fraction of a point short is what clips the peek group's last line.
  return Math.ceil(sheet.contentTop + header + peek + block);
};

/**
 * TS1 Z6: how visible the details are with the sheet `height` tall: 0 at (or below) `peek`, 1 once
 * it has risen 24 pt above it; always 1 on the receipt. A peek of 0 is not measured yet: hidden,
 * so nothing flashes on the first open. Runs on the UI thread.
 */
export const detailsOpacity = (height: number, peek: number, receipt: boolean): number => {
  'worklet';
  if (receipt) return 1;
  if (peek <= 0) return 0;
  return Math.min(1, Math.max(0, (height - peek) / k.detailsRevealDistance));
};

export type TripSheetProps = {
  /** Status header (TS3): drag area, pinned while the details scroll. */
  header: React.ReactNode;
  /** The peek group (progress, person, role zone B). */
  peek: React.ReactNode;
  /** Shown only at `expanded`, 24 below the peek group (trip mode). */
  details?: React.ReactNode;
  /**
   * [T-565] Blocks that own a modal sheet (reports, parcel steps) and must outlive a state change:
   * drawn after `details` (trip) or after the receipt body, always at the same tree position, so
   * the trip → receipt swap never unmounts an open sheet; it closes through its own `visible`.
   */
  persistent?: React.ReactNode;
  /** The last item of the details (the cancel action, TS8); trip mode only. */
  detailsEnd?: React.ReactNode;
  /** Sticky footer (the one primary action). */
  footer?: React.ReactNode;
  /**
   * `trip` (default): `peek` (measured) and `expanded` (= the content, capped at `full`), a tap
   * on the handle toggles them. `receipt`: one `content` snap, no handle, not draggable (PR1).
   */
  mode?: 'trip' | 'receipt';
  /** A change (a new ride state) brings the sheet back to `peek` (TS1). */
  stateKey: string;
  /** Visible height on every frame (controls riding the sheet). */
  animatedHeight?: SharedValue<number>;
  /** Settled height (camera padding). */
  onHeightChange?: (height: number) => void;
  /** The sheet is at `expanded` (the recentre control hides then, TS2). */
  onExpandedChange?: (expanded: boolean) => void;
  /** Rises from this height on its first opening (the sheet it takes over from). */
  openFrom?: number;
  /** False while another screen covers the host. */
  active?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

/** [UI-R13] Opens the details from a row in the peek group (the driver's target row, TS6.1). */
export type TripSheetHandle = { expand: () => void };

/**
 * The shared trip sheet (shared-trip-sheet TS1, kit, both roles): the kit BottomSheet in map
 * mode with a measured `peek` (handle + header + peek group + bottom block, re-applied only on a
 * ≥ 1 pt change) and `expanded` = the whole content. The details render only below the peek
 * group, so at `peek` they sit under the screen edge. Gutter 16 on every block.
 */
export const TripSheet = forwardRef<TripSheetHandle, TripSheetProps>(function TripSheet({
  header,
  peek,
  details,
  persistent,
  detailsEnd,
  footer,
  mode = 'trip',
  stateKey,
  animatedHeight,
  onHeightChange,
  onExpandedChange,
  openFrom,
  active = true,
  accessibilityLabel,
  testID = 'trip-sheet',
}, handle) {
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetHandle>(null);
  const [heights, setHeights] = useState({ header: 0, peek: 0, footer: 0, footerBlock: 0 });
  const measure = useCallback(
    (key: 'header' | 'peek' | 'footer') => (e: LayoutChangeEvent) => {
      const next = Math.ceil(e.nativeEvent.layout.height);
      setHeights((prev) => (Math.abs(prev[key] - next) < 1 ? prev : { ...prev, [key]: next }));
    },
    [],
  );
  const onFooterLayout = useCallback((height: number) => {
    const next = Math.ceil(height);
    setHeights((prev) => (Math.abs(prev.footerBlock - next) < 1 ? prev : { ...prev, footerBlock: next }));
  }, []);
  const receipt = mode === 'receipt';
  useImperativeHandle(handle, () => ({ expand: () => (receipt ? undefined : ref.current?.snapTo('content')) }), [receipt]);
  const peekHeight = receipt
    ? undefined
    : tripPeekHeight({
        header: heights.header,
        peek: heights.peek,
        footer: footer ? heights.footer : 0,
        bottomInset: insets.bottom,
        footerBlock: heights.footerBlock,
      }) ?? undefined;

  // TS1 Z6: the details belong to `expanded`. At peek their top edge would show in the bottom
  // block, so they fade in over the first 24 pt the sheet rises above peek (UI thread).
  const localHeight = useSharedValue(0);
  const height = animatedHeight ?? localHeight;
  const peekValue = useSharedValue(peekHeight ?? 0);
  useEffect(() => {
    peekValue.value = peekHeight ?? 0;
  }, [peekHeight, peekValue]);
  const detailsFade = useAnimatedStyle(
    () => ({ opacity: detailsOpacity(height.value, peekValue.value, receipt) }),
    [receipt],
  );
  // The 24 above the details only when a slot draws something (an empty one adds no gap).
  const [detailsFilled, setDetailsFilled] = useState(false);
  const onDetailsLayout = useCallback((e: LayoutChangeEvent) => {
    const filled = e.nativeEvent.layout.height >= 1;
    setDetailsFilled((prev) => (prev === filled ? prev : filled));
  }, []);

  // A new state opens at `peek` (TS1), also when the passenger had expanded the last one.
  const lastKey = useRef(stateKey);
  useEffect(() => {
    if (lastKey.current === stateKey) return;
    lastKey.current = stateKey;
    if (!receipt) ref.current?.snapTo('peek');
  }, [stateKey, receipt]);

  // While collapsed the details are invisible: screen readers skip them too (Cancel lives there).
  const [expanded, setExpanded] = useState(false);
  const onSnapChange = useCallback(
    (snap: SheetSnap, settled: number) => {
      onHeightChange?.(settled);
      const next = !receipt && snap === 'content';
      setExpanded(next);
      onExpandedChange?.(next);
    },
    [onExpandedChange, onHeightChange, receipt],
  );
  const detailsHidden = !receipt && !expanded;

  return (
    <BottomSheet
      ref={ref}
      snapPoints={receipt ? RECEIPT_SNAPS : TRIP_SNAPS}
      peekHeight={peekHeight}
      initialSnap={receipt ? 'content' : 'peek'}
      handleTapToggles={!receipt}
      draggable={!receipt}
      openFrom={openFrom}
      animatedHeight={height}
      onSnapChange={onSnapChange}
      footerDivider
      onFooterLayout={onFooterLayout}
      // PR2: the comment field's counter line stays above the footer when the keyboard is up.
      focusRevealExtra={componentTokens.textField.helperGap + textStyles.caption.lineHeight}
      expandOnKeyboard
      active={active}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      header={
        <View style={[styles.header, receipt ? styles.receiptHeader : null]} onLayout={measure('header')}>
          {header}
        </View>
      }
      footer={footer ? <View onLayout={measure('footer')}>{footer}</View> : undefined}
    >
      <View style={styles.body}>
        <View onLayout={measure('peek')} testID={`${testID}-peek`}>
          {peek}
        </View>
        {/* One View at a fixed position in both modes: `persistent` keeps its instance across them. */}
        <Animated.View
          style={[detailsFilled ? styles.detailsGap : null, detailsFade]}
          accessibilityElementsHidden={detailsHidden}
          importantForAccessibility={detailsHidden ? 'no-hide-descendants' : 'auto'}
          testID={`${testID}-details`}
        >
          <View style={styles.details} onLayout={onDetailsLayout} testID={`${testID}-details-content`}>
            {receipt ? null : details}
            {persistent}
            {receipt ? null : detailsEnd}
          </View>
        </Animated.View>
      </View>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  header: { paddingHorizontal: layout.gutter, paddingBottom: k.headerGap },
  // PR2: 16 between the receipt's header and its money card.
  receiptHeader: { paddingBottom: k.zoneGap },
  body: { paddingHorizontal: layout.gutter },
  detailsGap: { marginTop: k.detailsGap },
  details: { gap: k.zoneGap },
});
