import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText } from '../../../components/ui';
import { formatMoney } from '../../../core/format/money';
import { radius, space } from '../../../theme';
import { STATS_COPY } from '../copy';
import { formatDistanceKm, periodCaption } from '../format';
import type { DriverEarnings } from '../types';

type Props = { earnings: DriverEarnings };

/**
 * Period total (docs/design/screens/driver-earnings.md): the driver's earnings for the period
 * on the `primary` hero (dark: `primarySoft`), then trips, fares collected and commission.
 */
export function EarningsHero({ earnings }: Props) {
  const { theme } = useAppTheme();
  const dark = theme.mode === 'dark';
  const text = dark ? 'onPrimarySoft' : 'onPrimary';
  const { totals, currency } = earnings;
  const money = (n: number) => formatMoney(n, { currency });
  const metrics: Array<{ label: string; value: string; testID: string }> = [
    { label: STATS_COPY.trips, value: String(totals.trips), testID: 'earnings-trips' },
    { label: STATS_COPY.fares, value: money(totals.grossFares), testID: 'earnings-fares' },
    { label: STATS_COPY.commission, value: money(totals.commission), testID: 'earnings-commission' },
  ];
  if (totals.distanceKm > 0) {
    metrics.push({ label: STATS_COPY.distance, value: formatDistanceKm(totals.distanceKm), testID: 'earnings-distance' });
  }
  return (
    <View
      style={[styles.card, { backgroundColor: dark ? theme.colors.primarySoft : theme.colors.primary }]}
      testID="earnings-hero"
    >
      <AppText variant="caption" color={text}>
        {periodCaption(earnings.period, earnings.from, earnings.to)}
      </AppText>
      <AppText
        variant="numericXL"
        color={text}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        testID="earnings-total"
      >
        {money(totals.earnings)}
      </AppText>
      <View style={styles.metrics}>
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.metric} accessible accessibilityLabel={`${metric.label}: ${metric.value}`}>
            <AppText variant="numeric" color={text} numberOfLines={1} adjustsFontSizeToFit testID={metric.testID}>
              {metric.value}
            </AppText>
            <AppText variant="caption" color={text} numberOfLines={2}>
              {metric.label}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space[5], gap: space[1] },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space[3], rowGap: space[3], columnGap: space[4] },
  // Two or three per row depending on width; never clipped.
  metric: { flexGrow: 1, flexBasis: '28%', minWidth: 88 },
});
