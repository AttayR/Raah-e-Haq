import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  I18nManager,
  Platform,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Card } from '../../../components/ui';
import { haptics } from '../../../core/haptics';
import { t } from '../../../i18n';
import { borderWidth, componentTokens, space } from '../../../theme';
import { chartReadout, chartSlots, clampSelectable, defaultSelection, type ChartSlot } from '../chartModel';
import type { EarningsDay, EarningsPeriod } from '../types';
import { useStaleStyle } from './StaleFade';

const c = componentTokens.earnings.chart;
const A11Y_ACTIONS = [{ name: 'increment' }, { name: 'decrement' }] as const;

type Props = {
  series: ReadonlyArray<EarningsDay>;
  period: EarningsPeriod;
  currency: string;
  /** BE-125 `today`, or the derived one (earningsDates.resolveToday); null: every day is past. */
  today: string | null;
  /** Period caption ("19 – 25 Oct") for the plot's accessibility label. */
  caption: string;
  /** Another period is loading: dimmed with the hero, not interactive. */
  stale: boolean;
};

/**
 * Earnings per day (UI-R17 round 2, driver-earnings.md §3.1): the readout in the card header
 * (amount in `numericL`), then plain View bars. Past and today: a bar, or a 4pt dot for a day
 * that earned nothing; future: nothing above a fading baseline; today: bold label + marker.
 * One responder on the plot (tap or horizontal drag; never a future day) and one adjustable
 * element for screen readers. No chart library, no animation on selection.
 */
function EarningsChartView({ series, period, currency, today, caption, stale }: Props) {
  const { theme } = useAppTheme();
  const fade = useStaleStyle();
  const slots = useMemo(() => chartSlots(series, period, today), [series, period, today]);
  const fallback = useMemo(() => defaultSelection(slots), [slots]);
  const [pick, setPick] = useState<{ slots: ChartSlot[]; index: number } | null>(null);
  const selected = pick && pick.slots === slots ? pick.index : fallback;
  const current = useRef(selected);
  current.current = selected;
  const width = useRef(0);
  const touchStart = useRef({ x: 0, y: 0 });

  const select = useCallback(
    (index: number) => {
      const next = clampSelectable(index, slots);
      if (next < 0 || next === current.current) return;
      current.current = next;
      setPick({ slots, index: next });
      // §6.11: a selection tick on iOS only (cheap Android motors buzz).
      if (Platform.OS === 'ios') haptics.selection();
    },
    [slots],
  );

  const indexAt = (x: number): number => {
    if (width.current <= 0 || slots.length === 0) return -1;
    const raw = Math.min(slots.length - 1, Math.max(0, Math.floor((x / width.current) * slots.length)));
    return I18nManager.isRTL ? slots.length - 1 - raw : raw;
  };
  const onTouch = (event: GestureResponderEvent) => select(indexAt(event.nativeEvent.locationX));
  // Vertical drags stay with the list; only a mostly horizontal move scrubs the plot.
  const horizontalMove = (event?: GestureResponderEvent): boolean => {
    const native = event?.nativeEvent;
    if (stale || !native) return false;
    return Math.abs(native.pageX - touchStart.current.x) > Math.abs(native.pageY - touchStart.current.y);
  };
  const onAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') select(current.current + 1);
    if (event.nativeEvent.actionName === 'decrement') select(Math.max(0, current.current - 1));
  };

  if (slots.length === 0) return null;
  const day = slots[Math.min(Math.max(selected, 0), slots.length - 1)];
  const readout = chartReadout(day, currency);
  const dark = theme.mode === 'dark';
  const accent = dark ? theme.colors.primaryText : theme.colors.primary;
  const dense = period !== 'week';
  const gap = dense ? c.slotGap.month : c.slotGap.week;

  return (
    <Animated.View style={fade} pointerEvents={stale ? 'none' : 'auto'}>
      <Card testID="earnings-chart">
        <View style={styles.header}>
          <AppText variant="overline" color="textMuted" accessibilityRole="header">
            {t('earnings.chartTitle')}
          </AppText>
          <AppText variant="caption" color="textSecondary" numberOfLines={1} style={styles.date} testID="earnings-chart-date">
            {readout.date}
          </AppText>
        </View>
        <View
          style={styles.readout}
          accessible
          accessibilityLabel={readout.a11y}
          accessibilityLiveRegion="polite"
          testID="earnings-chart-selected"
        >
          <AppText variant="numericL" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} testID="earnings-chart-amount">
            {readout.amount}
          </AppText>
          <AppText variant="bodySmall" color="textSecondary" numberOfLines={1} style={styles.trips}>
            {readout.trips}
          </AppText>
        </View>
        <View
          style={styles.plot}
          testID="earnings-chart-plot"
          onLayout={(event: LayoutChangeEvent) => {
            width.current = event.nativeEvent.layout.width;
          }}
          // The plot itself is the touch target, so locationX is always plot-relative.
          pointerEvents={stale ? 'none' : 'box-only'}
          onTouchStart={(event) => {
            touchStart.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
          }}
          onStartShouldSetResponder={() => !stale}
          onMoveShouldSetResponder={horizontalMove}
          onResponderTerminationRequest={() => true}
          onResponderGrant={onTouch}
          onResponderMove={onTouch}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t('earnings.chartA11y', { caption })}
          accessibilityValue={{ text: readout.a11y }}
          accessibilityState={{ disabled: stale }}
          accessibilityActions={A11Y_ACTIONS}
          onAccessibilityAction={onAction}
        >
          {slots.map((slot, index) => (
            <Slot key={slot.date} slot={slot} selected={index === selected} dense={dense} gap={gap} accent={accent} />
          ))}
        </View>
      </Card>
    </Animated.View>
  );
}

type SlotProps = { slot: ChartSlot; selected: boolean; dense: boolean; gap: number; accent: string };

function Slot({ slot, selected, dense, gap, accent }: SlotProps) {
  const { theme } = useAppTheme();
  const happened = slot.cls !== 'future';
  const fill = selected ? accent : theme.colors.borderStrong;
  const isToday = slot.cls === 'today';
  return (
    <View style={styles.slot} testID={`earnings-bar-${slot.date}`}>
      <View style={[styles.barArea, { paddingHorizontal: gap / 2 }]}>
        {happened && slot.ratio > 0 ? (
          <View
            testID={`earnings-bar-${slot.date}-fill`}
            style={[
              styles.bar,
              dense ? styles.barMonth : styles.barWeek,
              { height: Math.max(c.minBarHeight, slot.ratio * c.plotHeight), backgroundColor: fill },
            ]}
          />
        ) : happened ? (
          <View testID={`earnings-bar-${slot.date}-zero`} style={[styles.dot, { backgroundColor: fill }]} />
        ) : null}
      </View>
      <View style={[styles.baseline, { backgroundColor: happened ? theme.colors.borderStrong : theme.colors.border }]} />
      <View style={styles.labelArea}>
        {slot.label ? (
          <AppText
            variant={isToday ? 'captionStrong' : 'caption'}
            color={isToday ? 'textPrimary' : 'textMuted'}
            numberOfLines={1}
            align="center"
            maxFontSizeMultiplier={c.labelMaxScale}
            style={styles.label}
          >
            {slot.label}
          </AppText>
        ) : null}
        {isToday ? <View testID="earnings-chart-today" style={[styles.todayMarker, { backgroundColor: accent }]} /> : null}
      </View>
    </View>
  );
}

/** Re-renders only when the period's series, the day split or the stale state change. */
export const EarningsChart = React.memo(EarningsChartView);

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2], minHeight: space[4] },
  date: { flexShrink: 1 },
  readout: {
    flexDirection: 'row',
    alignItems: Platform.OS === 'android' ? 'flex-end' : 'baseline',
    gap: space[2],
    marginTop: space[1],
  },
  trips: { flexShrink: 1 },
  plot: { flexDirection: 'row', marginTop: space[4] },
  slot: { flex: 1, minWidth: 0, alignItems: 'center' },
  barArea: { height: c.plotHeight, alignSelf: 'stretch', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: `${c.barRatio * 100}%`, minWidth: c.minBar },
  barWeek: { maxWidth: c.maxBar.week, borderTopLeftRadius: c.barRadius.week, borderTopRightRadius: c.barRadius.week },
  barMonth: { maxWidth: c.maxBar.month, borderTopLeftRadius: c.barRadius.month, borderTopRightRadius: c.barRadius.month },
  dot: { width: c.zeroDot, height: c.zeroDot, borderRadius: c.zeroDot / 2 },
  baseline: { height: borderWidth.thin, alignSelf: 'stretch' },
  labelArea: { marginTop: space[1], height: space[4], alignItems: 'center' },
  // Wider than a month's slot on purpose: "25" stays readable and overflows into the gap.
  label: { width: c.labelWidth },
  todayMarker: {
    position: 'absolute',
    top: space[4] + c.todayMarker.gap,
    width: c.todayMarker.width,
    height: c.todayMarker.height,
    borderRadius: c.todayMarker.height / 2,
  },
});
