import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Icon, vehicleIconName } from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, layout, radius, space } from '../../../theme';
import type { TripRowText } from '../tripItems';
import type { EarningsRide } from '../types';
import { useIsStale, useStaleStyle } from './StaleFade';

const k = componentTokens.earnings.row;

type RowProps = {
  ride: EarningsRide;
  text: TripRowText;
  /** First / last segment of the day's grouped card: rounded top / bottom corners. */
  first: boolean;
  last: boolean;
  onOpen: (rideId: number) => void;
};

/**
 * One trip (UI-R17 round 2, driver-earnings.md §3.3): vehicle glyph, route, "{time} · {distance}",
 * "Fare · Commission", and the net in a fixed end-aligned column so every amount lines up. It
 * draws its own segment of the day's grouped card; tap opens the ride details.
 */
function EarningsTripRowView({ ride, text, first, last, onOpen }: RowProps) {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const fade = useStaleStyle();
  // §3.6: the stale flag comes from context, so a period switch does not rebuild every row.
  const stale = useIsStale();
  return (
    <Animated.View style={[styles.wrap, fade]}>
      <Pressable
        onPress={() => onOpen(ride.id)}
        disabled={stale}
        accessibilityRole="button"
        accessibilityLabel={text.a11y}
        accessibilityHint={t('earnings.rowHint')}
        accessibilityState={{ disabled: stale }}
        testID={`earnings-ride-${ride.id}`}
        style={({ pressed }) => [
          styles.row,
          first ? styles.first : null,
          last ? styles.last : null,
          { backgroundColor: pressed ? colors.surfacePressed : colors.surface },
        ]}
      >
        {first ? null : <View style={[styles.divider, { backgroundColor: colors.border, height: theme.borderWidth.hairline }]} />}
        <View style={[styles.tile, { backgroundColor: colors.surfaceAlt }]}>
          <Icon name={vehicleIconName(ride.vehicleType)} size={k.glyph} color="textSecondary" />
        </View>
        <View style={styles.text}>
          <AppText variant="bodyStrong" numberOfLines={1} testID={`earnings-ride-${ride.id}-title`}>
            {text.title}
          </AppText>
          {text.meta ? (
            <AppText variant="caption" color="textSecondary" numberOfLines={1}>
              {text.meta}
            </AppText>
          ) : null}
          <AppText variant="caption" color="textMuted" numberOfLines={2} style={styles.split} testID={`earnings-ride-${ride.id}-split`}>
            {text.split}
          </AppText>
        </View>
        <View style={styles.trailing}>
          <AppText variant="numeric" numberOfLines={1} testID={`earnings-ride-${ride.id}-net`}>
            {text.net}
          </AppText>
          <AppText variant="caption" color="textMuted" style={styles.netLabel}>
            {t('earnings.rowNet')}
          </AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export const EarningsTripRow = React.memo(EarningsTripRowView);

type DayProps = { label: string; totals: string | null; a11y: string; first: boolean; date: string };

/** Day header above a group of trips (§3.3): "Today" / "Yesterday" / "Fri, 16 Oct" and the day's server totals. */
function EarningsDayHeaderView({ label, totals, a11y, first, date }: DayProps) {
  const fade = useStaleStyle();
  return (
    <Animated.View
      style={[styles.day, first ? styles.dayFirst : null, fade]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={a11y}
      testID={`earnings-day-${date}`}
    >
      <AppText variant="label" color="textSecondary">
        {label}
      </AppText>
      {totals ? (
        <AppText variant="caption" color="textSecondary" style={styles.dayTotals}>
          {totals}
        </AppText>
      ) : null}
    </Animated.View>
  );
}

export const EarningsDayHeader = React.memo(EarningsDayHeaderView);

const styles = StyleSheet.create({
  wrap: { marginHorizontal: layout.gutter },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: k.minHeight,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  first: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  last: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  divider: { position: 'absolute', top: 0, start: k.dividerInset, end: 0 },
  tile: { width: k.tile, height: k.tile, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, marginStart: space[4] },
  split: { fontVariant: ['tabular-nums'] },
  trailing: { flexShrink: 0, minWidth: k.trailingMinWidth, alignItems: 'flex-end', marginStart: space[3] },
  netLabel: { marginTop: space[1] / 2 },
  day: {
    marginHorizontal: layout.gutter,
    paddingHorizontal: space[4],
    paddingTop: space[4],
    paddingBottom: space[2],
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space[1],
  },
  dayFirst: { paddingTop: 0 },
  dayTotals: { fontVariant: ['tabular-nums'] },
});
