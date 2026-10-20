import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Button, Card, EmptyState, Skeleton, SkeletonGroup } from '../../../components/ui';
import { t, type TranslationKey } from '../../../i18n';
import { componentTokens, layout, radius, space } from '../../../theme';
import type { EarningsPeriod } from '../types';

const sk = componentTokens.skeleton;
const heights = sk.heights;
const row = componentTokens.earnings.row;

const END_OF_LIST: Record<EarningsPeriod, TranslationKey> = {
  day: 'earnings.endOfListDay',
  week: 'earnings.endOfListWeek',
  month: 'earnings.endOfListMonth',
};

const EMPTY_TITLE: Record<EarningsPeriod, TranslationKey> = {
  day: 'earnings.emptyDay',
  week: 'earnings.emptyWeek',
  month: 'earnings.emptyMonth',
};

type FooterProps = {
  period: EarningsPeriod;
  loadingMore: boolean;
  loadMoreError: string | null;
  /** Every page is loaded and there was more than one. */
  ended: boolean;
  onRetry: () => void;
};

/** Under the trips (§3.5): the paging spinner, a paging error with Try again, or "That's every trip …". */
export function EarningsListFooter({ period, loadingMore, loadMoreError, ended, onRetry }: FooterProps) {
  const { theme } = useAppTheme();
  if (loadingMore) {
    return (
      <View style={styles.paging} testID="earnings-loading-more">
        <ActivityIndicator size="small" color={theme.mode === 'dark' ? theme.colors.primaryText : theme.colors.primary} />
      </View>
    );
  }
  if (loadMoreError) {
    return (
      <View style={styles.footer} testID="earnings-more-error">
        <AppText variant="caption" color="textSecondary" align="center">
          {t('earnings.moreFailed')}
        </AppText>
        <Button label={t('earnings.moreRetry')} variant="ghost" size="sm" fullWidth={false} onPress={onRetry} testID="earnings-more-retry" />
      </View>
    );
  }
  if (ended) {
    return (
      <View style={styles.footer}>
        <AppText variant="caption" color="textMuted" align="center" testID="earnings-end">
          {t(END_OF_LIST[period])}
        </AppText>
      </View>
    );
  }
  return null;
}

type EmptyProps = {
  period: EarningsPeriod;
  /** The hero counts trips but page 1 listed none (server inconsistency): no action. */
  mismatch: boolean;
  onGoToDrive: () => void;
};

/** Empty period (§3.5): the compact EmptyState in a card, with "Go to Drive" (a tab switch only). */
export function EarningsEmpty({ period, mismatch, onGoToDrive }: EmptyProps) {
  return (
    <View style={styles.emptyWrap}>
      <Card>
        <EmptyState
          size="compact"
          icon="rides"
          title={mismatch ? t('earnings.mismatchTitle') : t(EMPTY_TITLE[period])}
          body={mismatch ? t('earnings.mismatchBody') : t('earnings.emptyBody')}
          action={mismatch ? undefined : { label: t('earnings.emptyAction'), onPress: onGoToDrive, testID: 'earnings-empty-action' }}
          testID="earnings-empty"
        />
      </Card>
    </View>
  );
}

/** First load (§3.5): the layout's blocks at their resting heights, so nothing jumps. */
export function EarningsSkeleton({ period }: { period: EarningsPeriod }) {
  return (
    <SkeletonGroup style={styles.skeleton} testID="earnings-loading">
      <Skeleton shape="card" height={heights.earningsHero} />
      <Skeleton shape="card" height={heights.earningsOwed} style={styles.gap12} />
      {period !== 'day' ? <Skeleton shape="card" height={heights.earningsChart} style={styles.gap16} /> : null}
      <View style={[styles.tiles, styles.gap16]}>
        <Skeleton shape="card" height={heights.earningsTile} style={styles.flex} />
        <Skeleton shape="card" height={heights.earningsTile} style={styles.flex} />
      </View>
      <Skeleton width={sk.overline.width} height={sk.overline.height} style={styles.overline} />
      <Card padding="none" style={styles.rows}>
        {Array.from({ length: 4 }, (_, i) => (
          <View key={i} style={styles.rowSkeleton}>
            <Skeleton width={row.tile} height={row.tile} shape="block" />
            <View style={styles.rowText}>
              <Skeleton width={sk.earningsRowLines.title} textVariant="bodyStrong" />
              <Skeleton width={sk.earningsRowLines.meta} textVariant="caption" />
            </View>
            <Skeleton width={sk.earningsRowLines.amount} textVariant="numeric" />
          </View>
        ))}
      </Card>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  paging: { height: componentTokens.earnings.footerHeight, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: space[4], alignItems: 'center', gap: space[2] },
  emptyWrap: { paddingHorizontal: layout.gutter },
  skeleton: { paddingHorizontal: layout.gutter },
  gap12: { marginTop: space[3] },
  gap16: { marginTop: space[4] },
  tiles: { flexDirection: 'row', gap: space[3] },
  flex: { flex: 1 },
  overline: { marginTop: space[6] },
  rows: { marginTop: space[2], borderRadius: radius.lg, overflow: 'hidden' },
  rowSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: componentTokens.skeleton.heights.earningsRow,
    paddingHorizontal: space[4],
    gap: space[4],
  },
  rowText: { flex: 1, gap: space[2] },
});
