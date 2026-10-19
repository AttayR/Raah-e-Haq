import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, BrandBar, Icon, type IconName } from '../../../components/ui';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { t } from '../../../i18n';
import { borderWidth, componentTokens, motion, radius, space } from '../../../theme';
import { periodCaption } from '../format';
import { heroContent, type HeroBreakdownRow, type HeroStat } from '../heroText';
import type { EarningsPeriod, EarningsTotals } from '../types';

type Props = {
  totals: EarningsTotals;
  currency: string;
  period: EarningsPeriod;
  from: string | null;
  to: string | null;
  /** Another period is loading: the old values stay, dimmed (no skeleton flash). */
  stale?: boolean;
};

const e = componentTokens.earnings;
const ROW_ICON: Record<HeroBreakdownRow['key'], IconName> = { fares: 'cash', commission: 'moneyOut', bookingFee: 'receipt' };
const STAT_ICON: Record<HeroStat['key'], IconName> = { trips: 'rides', online: 'clock', distance: 'distance' };

/**
 * Earnings period hero (UI-R17, docs/design/screens/driver-earnings.md §1.1): what the driver
 * keeps as the one big number, the money story under it as an equation (fares − commission =
 * you keep) and one equal-column stats row. Only the server's figures from GET /driver/earnings;
 * the rate shows only when BE-123 sends it and "Online" only when BE-124 does.
 */
function EarningsHeroView({ totals, currency, period, from, to, stale = false }: Props) {
  const { theme } = useAppTheme();
  const reduce = useReducedMotion();
  const content = useMemo(() => heroContent(totals, currency, period), [totals, currency, period]);
  const caption = periodCaption(period, from, to);
  const divider = { backgroundColor: theme.colors.heroDivider };

  const opacity = useSharedValue(1);
  useEffect(() => {
    const target = stale ? e.staleOpacity : 1;
    opacity.value = reduce ? target : withTiming(target, { duration: motion.fast.duration });
  }, [stale, reduce, opacity]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.card, { backgroundColor: theme.colors.heroFill }, fade]} testID="earnings-hero">
      <View accessible accessibilityLabel={t('earnings.heroKeepA11y', { amount: content.net, period: caption })}>
        {/* UI-R21 §1.7 M3: the hero's one saffron element, 8 above "You keep". */}
        <BrandBar style={styles.brandBar} testID="earnings-brand-bar" />
        <View style={styles.headline}>
          <AppText variant="label" color="heroTextMuted">
            {t('earnings.heroKeep')}
          </AppText>
          <AppText variant="caption" color="heroTextMuted" numberOfLines={1} style={styles.caption} testID="earnings-period-caption">
            {caption}
          </AppText>
        </View>
        <AppText
          variant="numericXL"
          color="heroText"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={styles.net}
          testID="earnings-total"
        >
          {content.net}
        </AppText>
      </View>

      {content.rows ? (
        <View style={styles.breakdown} accessible accessibilityLabel={content.breakdownA11y ?? undefined} testID="earnings-breakdown">
          {content.rows.map((row) => (
            <View key={row.key} style={styles.row}>
              <View style={styles.rowIcon}>
                <Icon name={ROW_ICON[row.key]} size={e.heroIcon} color="heroTextMuted" />
              </View>
              <AppText variant="bodySmall" color="heroTextMuted" numberOfLines={2} style={styles.rowLabel}>
                {row.label}
              </AppText>
              <AppText variant="numeric" color="heroText" numberOfLines={1} align="end" style={styles.rowValue} testID={row.testID}>
                {row.value}
              </AppText>
            </View>
          ))}
          <View style={[styles.rule, styles.ruleBreakdown, divider]} />
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Icon name="wallet" size={e.heroIcon} color="heroTextMuted" />
            </View>
            <AppText variant="label" color="heroText" numberOfLines={2} style={styles.rowLabel}>
              {t('earnings.heroNet')}
            </AppText>
            <AppText variant="numeric" color="heroText" numberOfLines={1} align="end" style={styles.rowValue} testID="earnings-net">
              {content.net}
            </AppText>
          </View>
        </View>
      ) : (
        <AppText variant="bodySmall" color="heroTextMuted" style={styles.noTrips} testID="earnings-no-trips">
          {content.noTrips}
        </AppText>
      )}

      <View style={[styles.rule, divider]} />
      <View style={styles.stats} testID="earnings-stats">
        {content.stats.map((stat, index) => (
          <React.Fragment key={stat.key}>
            {index > 0 ? <View style={[styles.statRule, divider]} /> : null}
            <View
              style={styles.stat}
              accessible
              accessibilityLabel={t('earnings.statA11y', { caption: stat.caption, value: stat.value })}
            >
              <Icon name={STAT_ICON[stat.key]} size={e.heroIcon} color="heroTextMuted" />
              <AppText
                variant="numeric"
                color="heroText"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={styles.statValue}
                testID={stat.testID}
              >
                {stat.value}
              </AppText>
              <AppText variant="caption" color="heroTextMuted" numberOfLines={2} align="center">
                {stat.caption}
              </AppText>
            </View>
          </React.Fragment>
        ))}
      </View>
    </Animated.View>
  );
}

/** Re-renders only when the period's figures change (the list scrolls under it). */
export const EarningsHero = React.memo(EarningsHeroView);

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: e.heroPadding },
  brandBar: { marginBottom: componentTokens.brand.barGapHero },
  headline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space[2],
    minHeight: e.heroHeadlineMinHeight,
  },
  caption: { flexShrink: 1 },
  net: { marginTop: space[1] },
  breakdown: { marginTop: space[4] },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2], minHeight: e.heroRowMinHeight, paddingVertical: space[1] },
  // Keeps the 16 glyph centred on the first 20-pt text line when the label wraps.
  rowIcon: { height: space[5], justifyContent: 'center' },
  rowLabel: { flex: 1 },
  rowValue: { flexShrink: 0 },
  rule: { height: borderWidth.thin, alignSelf: 'stretch', marginTop: space[4] },
  ruleBreakdown: { marginTop: space[1], marginBottom: space[1] },
  noTrips: { marginTop: space[4] },
  stats: { flexDirection: 'row', paddingTop: space[3] },
  stat: { flex: 1, alignItems: 'center', gap: e.statGap, paddingHorizontal: space[1] },
  statValue: { marginTop: e.statGap },
  statRule: { width: borderWidth.thin, height: e.statRuleHeight, alignSelf: 'center' },
});
