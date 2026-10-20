import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { componentTokens, layout } from '../../../theme';
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
}: {
  header: number;
  peek: number;
  /** Measured footer content (0 without a footer). */
  footer: number;
  bottomInset: number;
}): number | null => {
  if (header <= 0 || peek <= 0) return null;
  const bottom = Math.max(bottomInset + layout.bottomActionOffset, layout.bottomActionMinOffset);
  const footerBlock = footer > 0 ? sheet.footerTopPadding + footer + bottom : bottom;
  return Math.round(sheet.contentTop + header + peek + footerBlock);
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

/**
 * The shared trip sheet (shared-trip-sheet TS1, kit, both roles): the kit BottomSheet in map
 * mode with a measured `peek` (handle + header + peek group + bottom block, re-applied only on a
 * ≥ 1 pt change) and `expanded` = the whole content. The details render only below the peek
 * group, so at `peek` they sit under the screen edge. Gutter 16 on every block.
 */
export function TripSheet({
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
}: TripSheetProps) {
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetHandle>(null);
  const [heights, setHeights] = useState({ header: 0, peek: 0, footer: 0 });
  const measure = useCallback(
    (key: 'header' | 'peek' | 'footer') => (e: LayoutChangeEvent) => {
      const next = Math.round(e.nativeEvent.layout.height);
      setHeights((prev) => (Math.abs(prev[key] - next) < 1 ? prev : { ...prev, [key]: next }));
    },
    [],
  );
  const receipt = mode === 'receipt';
  const peekHeight = receipt
    ? undefined
    : tripPeekHeight({ header: heights.header, peek: heights.peek, footer: footer ? heights.footer : 0, bottomInset: insets.bottom }) ?? undefined;

  // A new state opens at `peek` (TS1), also when the passenger had expanded the last one.
  const lastKey = useRef(stateKey);
  useEffect(() => {
    if (lastKey.current === stateKey) return;
    lastKey.current = stateKey;
    if (!receipt) ref.current?.snapTo('peek');
  }, [stateKey, receipt]);

  const onSnapChange = useCallback(
    (snap: SheetSnap, height: number) => {
      onHeightChange?.(height);
      onExpandedChange?.(!receipt && snap === 'content');
    },
    [onExpandedChange, onHeightChange, receipt],
  );

  return (
    <BottomSheet
      ref={ref}
      snapPoints={receipt ? RECEIPT_SNAPS : TRIP_SNAPS}
      peekHeight={peekHeight}
      initialSnap={receipt ? 'content' : 'peek'}
      handleTapToggles={!receipt}
      draggable={!receipt}
      openFrom={openFrom}
      animatedHeight={animatedHeight}
      onSnapChange={onSnapChange}
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
        <View style={styles.details} testID={`${testID}-details`}>
          {receipt ? null : details}
          {persistent}
          {receipt ? null : detailsEnd}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: layout.gutter, paddingBottom: k.headerGap },
  // PR2: 16 between the receipt's header and its money card.
  receiptHeader: { paddingBottom: k.zoneGap },
  body: { paddingHorizontal: layout.gutter },
  details: { marginTop: k.detailsGap, gap: k.zoneGap },
});
