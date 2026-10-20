import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import LocationSearch, { suggestionAddress } from './LocationSearch';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { haptics } from '../../core/haptics';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { AppText } from '../ui/AppText';
import { timing } from '../ui/easing';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { PinGlyph } from '../ui/ride/MapPins';
import { componentTokens, motion, space } from '../../theme';
import { BOOKING_COPY } from '../../features/ride-booking/copy';

type Coords = { latitude: number; longitude: number; address?: string | null };

/** A long press starts the drag, so a scroll or a tap on the row is never a reorder. */
export const STOP_DRAG_LONG_PRESS_MS = 200;
const r = componentTokens.ride.stopRow;

/** The slot a row dragged `offset` from slot `index` lands in (nearest slot, kept in the list). */
export const dropSlot = (index: number, offset: number, rowHeight: number, count: number): number => {
  'worklet';
  if (rowHeight <= 0 || count <= 0) return index;
  return Math.min(count - 1, Math.max(0, index + Math.round(offset / rowHeight)));
};

type RowProps = {
  stop: Coords;
  index: number;
  count: number;
  onRemove: (index: number) => void;
  /** Drag (or a screen reader's Move up / Move down) moved the stop to `to`. */
  onMove?: (from: number, to: number) => void;
  /** True while a drag holds the row (the sheet stops scrolling under the finger). */
  onDragChange?: (dragging: boolean) => void;
};

/**
 * One stop on the trip (DS §9 v1.1, UI-R10; UI-R9b): the drag handle (24 `drag-vertical` in a 44
 * target, only with 2+ stops), the numbered stop glyph of its map pin, "Stop n: address" and
 * remove. A long press on the handle lifts the row (scale 1.02) and it follows the finger inside
 * the list; on release it settles in the nearest slot (`motion.fast`) and the stops reorder (one
 * new route). Screen readers get Move up / Move down actions on the handle. UI thread only.
 */
export function StopRow({ stop, index, count, onRemove, onMove, onDragChange }: RowProps) {
  const { theme } = useAppTheme();
  const reduced = useReducedMotion();
  const offset = useSharedValue(0);
  const lifted = useSharedValue(0);
  const height = useSharedValue(0);
  const reorderable = !!onMove && count > 1;
  // A new place in the list (the reorder landed): the row is drawn in its slot, unshifted.
  useEffect(() => {
    offset.value = 0;
  }, [index, offset]);

  const settle = useMemo(() => timing(reduced ? { ...motion.fast, duration: 0 } : motion.fast), [reduced]);
  const begin = useCallback(() => {
    haptics.selection();
    onDragChange?.(true);
  }, [onDragChange]);
  const end = useCallback(() => onDragChange?.(false), [onDragChange]);
  const drop = useCallback((to: number) => onMove?.(index, to), [onMove, index]);

  const pan = Gesture.Pan()
    .enabled(reorderable)
    .activateAfterLongPress(STOP_DRAG_LONG_PRESS_MS)
    .onStart(() => {
      lifted.value = 1;
      runOnJS(begin)();
    })
    .onUpdate((e) => {
      const h = height.value;
      offset.value = Math.min((count - 1 - index) * h, Math.max(-index * h, e.translationY));
    })
    .onEnd(() => {
      const to = dropSlot(index, offset.value, height.value, count);
      offset.value = withTiming((to - index) * height.value, settle, () => {
        'worklet';
        if (to !== index) runOnJS(drop)(to);
      });
    })
    .onFinalize(() => {
      lifted.value = 0;
      runOnJS(end)();
    })
    .withTestId(`stop-drag-${index + 1}`);

  const rowStyle = useAnimatedStyle(() => ({
    zIndex: lifted.value,
    opacity: lifted.value ? r.dragOpacity : 1,
    transform: [{ translateY: offset.value }, { scale: lifted.value ? r.dragScale : 1 }],
  }));

  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'moveUp' && index > 0) onMove?.(index, index - 1);
    if (e.nativeEvent.actionName === 'moveDown' && index < count - 1) onMove?.(index, index + 1);
  };
  const actions = [
    ...(index > 0 ? [{ name: 'moveUp', label: BOOKING_COPY.moveStopUp }] : []),
    ...(index < count - 1 ? [{ name: 'moveDown', label: BOOKING_COPY.moveStopDown }] : []),
  ];

  return (
    <Animated.View
      style={[styles.row, { backgroundColor: theme.colors.surface }, rowStyle]}
      onLayout={(e: LayoutChangeEvent) => {
        height.value = e.nativeEvent.layout.height;
      }}
      testID={`stop-row-${index + 1}`}
    >
      {reorderable ? (
        <GestureDetector gesture={pan}>
          <View
            style={styles.handle}
            accessible
            accessibilityRole="button"
            accessibilityLabel={BOOKING_COPY.reorderStopA11y(index + 1)}
            accessibilityHint={BOOKING_COPY.reorderStopHint}
            accessibilityActions={actions}
            onAccessibilityAction={onAction}
            testID={`stop-handle-${index + 1}`}
          >
            <Icon name="drag" size={24} color="textMuted" />
          </View>
        </GestureDetector>
      ) : (
        <View style={styles.inset} />
      )}
      {/* UI-R10: the same numbered glyph as the stop's map pin. */}
      <PinGlyph kind="stop" index={index + 1} testID={`stop-row-glyph-${index + 1}`} />
      <AppText variant="bodySmall" numberOfLines={1} style={styles.stopText}>
        {BOOKING_COPY.stopLine(index + 1, stop.address || BOOKING_COPY.pinnedOnMap)}
      </AppText>
      <IconButton
        icon="close"
        iconColor="textSecondary"
        accessibilityLabel={BOOKING_COPY.removeStopA11y(index + 1)}
        onPress={() => onRemove(index)}
        testID={`remove-stop-${index + 1}`}
      />
    </Animated.View>
  );
}

type SearchProps = {
  /** `address` is the picked suggestion's text, sent with the ride (T-302). */
  onAddStop: (c: Coords, address: string) => void;
  onFocusChange?: (focused: boolean) => void;
};

/** The add-a-stop search (shown once "Add a stop" was tapped, UI-R10). */
export function StopSearch({ onAddStop, onFocusChange }: SearchProps) {
  const [query, setQuery] = useState('');
  return (
    <LocationSearch
      mode="destination"
      placeholder={BOOKING_COPY.addStop}
      query={query}
      onChangeQuery={setQuery}
      onFocusChange={onFocusChange}
      onSelect={(sel) => {
        onAddStop(sel.coords, suggestionAddress(sel));
        setQuery('');
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: componentTokens.listItem.minHeight.one,
    paddingEnd: space[2],
  },
  // The handle's 44 target sits 4 in (its glyph 14 from the edge); without it the pin glyph starts at the 16 gutter.
  handle: { width: r.handleTarget, height: r.handleTarget, marginStart: space[1], alignItems: 'center', justifyContent: 'center' },
  inset: { width: space[2] },
  stopText: { flex: 1, minWidth: 0 },
});
