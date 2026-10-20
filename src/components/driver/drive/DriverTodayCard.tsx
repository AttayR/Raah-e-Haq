import React, { Fragment, memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { formatMoney } from '../../../core/format/money';
import { formatMinutes } from '../../../features/stats/format';
import type { DriverStats } from '../../../features/stats/types';
import { t } from '../../../i18n';
import { componentTokens, space } from '../../../theme';
import { AppText, Card, ErrorState, Icon, Skeleton } from '../../ui';

type Cell = { key: string; value: string; label: string; star?: boolean };

/**
 * The Today cells (D4): trips today, online time when the API tracks it, rating ("New" when
 * null). A cell the API did not send is not drawn. A day with no trip and no online time yet
 * draws no cells (the empty line says what will show).
 */
export const todayCells = (stats: DriverStats): Cell[] => {
  if (stats.tripsToday <= 0 && !stats.onlineMinutesToday) return [];
  const cells: Cell[] = [
    {
      key: 'trips',
      value: String(stats.tripsToday),
      label: t('drive.todayTrips'),
    },
  ];
  if (stats.onlineMinutesToday !== null) {
    cells.push({
      key: 'online',
      value: formatMinutes(stats.onlineMinutesToday),
      label: t('drive.todayOnline'),
    });
  }
  cells.push({
    key: 'rating',
    value: stats.rating !== null ? stats.rating.toFixed(1) : t('drive.todayRatingNew'),
    label: t('drive.todayRating'),
    star: stats.rating !== null,
  });
  return cells;
};

type Props = {
  /** GET /me/stats for a driver; null while loading or after a failure. */
  stats: DriverStats | null;
  loading: boolean;
  /** The read failed and there is nothing to show. */
  failed: boolean;
  onRetry: () => void;
  onOpenEarnings: () => void;
};

/**
 * Today card on the Drive sheet at `half` (UI-R11, driver-drive-home D4; replaces the "Today ·
 * Rs" chip and the stat tiles): "TODAY" with an Earnings link, today's earnings in `numericL`
 * with "earned", then up to three equal cells split by hairlines. Loading: skeletons; failure: a
 * compact ErrorState; a new day: the earnings line and one sentence, no cells. Only what
 * GET /me/stats returned.
 */
function DriverTodayCardBase({ stats, loading, failed, onRetry, onOpenEarnings }: Props) {
  const { theme } = useAppTheme();
  const cells = stats ? todayCells(stats) : [];
  return (
    <Card variant="outlined" testID="driver-home-today">
      <View style={styles.titleRow}>
        <AppText variant="overline" color="textSecondary" accessibilityRole="header" style={styles.flex}>
          {t('drive.todayTitle')}
        </AppText>
        <Pressable
          onPress={onOpenEarnings}
          hitSlop={space[3]}
          accessibilityRole="link"
          accessibilityLabel={t('drive.todayEarningsLinkA11y')}
          style={styles.link}
          testID="drive-today-earnings-link"
        >
          <AppText variant="buttonSmall" color="primaryText">
            {t('drive.todayEarningsLink')}
          </AppText>
          <Icon name="chevronEnd" size={16} color="primaryText" />
        </Pressable>
      </View>

      {stats ? (
        <>
          <View
            style={styles.earnedRow}
            accessible
            accessibilityLabel={t('drive.todayEarnedA11y', {
              amount: formatMoney(stats.earningsToday, {
                currency: stats.currency,
              }),
            })}
          >
            <AppText variant="numericL" testID="drive-today-earnings">
              {formatMoney(stats.earningsToday, { currency: stats.currency })}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {t('drive.todayEarned')}
            </AppText>
          </View>
          {cells.length > 0 ? (
            <View style={[styles.cells, { borderTopColor: theme.colors.border }]}>
              {cells.map((cell, index) => (
                <Fragment key={cell.key}>
                  {index > 0 ? <View style={[styles.separator, { backgroundColor: theme.colors.border }]} /> : null}
                  <View
                    style={styles.cell}
                    accessible
                    accessibilityLabel={`${cell.value} ${cell.label}`}
                    testID={`driver-home-stat-${cell.key}`}
                  >
                    <View style={styles.valueRow}>
                      {cell.star ? <Icon name="star" size={16} color="ratingStar" /> : null}
                      <AppText variant="numeric" numberOfLines={1}>
                        {cell.value}
                      </AppText>
                    </View>
                    <AppText variant="caption" color="textSecondary" align="center" numberOfLines={2}>
                      {cell.label}
                    </AppText>
                  </View>
                </Fragment>
              ))}
            </View>
          ) : (
            <AppText variant="bodySmall" color="textSecondary" style={styles.empty} testID="driver-home-today-empty">
              {t('drive.todayEmpty')}
            </AppText>
          )}
        </>
      ) : failed && !loading ? (
        <ErrorState
          size="compact"
          title={t('drive.todayErrorTitle')}
          retryLabel={t('drive.todayRetry')}
          onRetry={onRetry}
          testID="driver-home-stats-error"
        />
      ) : (
        <View testID="driver-home-today-loading">
          <Skeleton width={120} height={22} style={styles.earnedRow} />
          <View style={[styles.cells, { borderTopColor: theme.colors.border }]}>
            {[0, 1, 2].map(i => (
              <View key={i} style={styles.cell}>
                <Skeleton width={48} height={16} />
              </View>
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}

export const DriverTodayCard = memo(DriverTodayCardBase);

const k = componentTokens.metricStrip;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  link: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  earnedRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[2],
    marginTop: space[1],
  },
  cells: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space[3],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cell: { flex: 1, minWidth: 0, alignItems: 'center', gap: space[1] },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  separator: { width: StyleSheet.hairlineWidth, height: k.separatorHeight },
  empty: { marginTop: space[3] },
});
