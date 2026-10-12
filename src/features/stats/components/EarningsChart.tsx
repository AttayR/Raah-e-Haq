import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Card } from '../../../components/ui';
import { formatMoney } from '../../../core/format/money';
import { space } from '../../../theme';
import { STATS_COPY } from '../copy';
import { barRatios, chartLabel, formatSeriesDate } from '../format';
import type { EarningsDay, EarningsPeriod } from '../types';

const PLOT_HEIGHT = 120;
const MAX_BAR = 24;
const STUB = 2;

type Props = { series: ReadonlyArray<EarningsDay>; period: EarningsPeriod; currency: string };

/**
 * Earnings per day as plain View bars (no chart library in the app): one flexible bar per day
 * of the zero-filled `series`, zero days as a 2pt stub. Tap a bar to read that day; the
 * busiest day is selected first.
 */
export function EarningsChart({ series, period, currency }: Props) {
  const { theme } = useAppTheme();
  const ratios = barRatios(series);
  const best = ratios.indexOf(Math.max(...ratios, 0));
  const [selected, setSelected] = useState(best);
  useEffect(() => setSelected(best), [best, series]);

  if (series.length === 0) return null;
  const day = series[Math.min(selected, series.length - 1)];
  const dark = theme.mode === 'dark';

  return (
    <Card testID="earnings-chart">
      <AppText variant="overline" color="textMuted" accessibilityRole="header">
        {STATS_COPY.chartLabel}
      </AppText>
      <View style={[styles.plot, series.length > 10 ? styles.plotDense : null]}>
        {series.map((item, index) => {
          const isSelected = index === selected;
          const height = ratios[index] > 0 ? Math.max(STUB * 2, ratios[index] * PLOT_HEIGHT) : STUB;
          // Selected day in the brand colour, the others neutral, empty days a faint stub.
          const fill =
            ratios[index] === 0
              ? theme.colors.surfaceAlt
              : isSelected
                ? dark
                  ? theme.colors.primaryText
                  : theme.colors.primary
                : theme.colors.borderStrong;
          const label = chartLabel(item.date, period, index);
          return (
            <Pressable
              key={item.date}
              style={styles.slot}
              onPress={() => setSelected(index)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={STATS_COPY.chartDay(
                formatSeriesDate(item.date),
                formatMoney(item.earnings, { currency }),
                item.trips,
              )}
              testID={`earnings-bar-${item.date}`}
            >
              <View style={styles.barArea}>
                <View style={[styles.bar, { height, backgroundColor: fill }]} />
              </View>
              <AppText variant="caption" color="textMuted" numberOfLines={1} align="center" style={styles.label}>
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <AppText variant="bodySmall" color="textSecondary" testID="earnings-chart-selected">
        {STATS_COPY.chartDay(formatSeriesDate(day.date), formatMoney(day.earnings, { currency }), day.trips)}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: space[1], marginVertical: space[3] },
  // A month has 28-31 bars: tighter gaps so they stay visible on an iPhone SE.
  plotDense: { gap: 2 },
  slot: { flex: 1, alignItems: 'center', minWidth: 0 },
  barArea: { height: PLOT_HEIGHT, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '80%', maxWidth: MAX_BAR, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  // Wider than a month's slot on purpose: "25" stays readable and overflows into the gap.
  label: { marginTop: space[1], width: 28, alignSelf: 'center' },
});
