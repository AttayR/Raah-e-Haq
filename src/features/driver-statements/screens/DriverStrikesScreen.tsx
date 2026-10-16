import React from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Badge, Banner, Card, EmptyState, ErrorState, Header, Icon, Screen, SkeletonList, type IconName } from '../../../components/ui';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import { formatCalendarDate, formatDateTime } from '../../wallet/format';
import { useDriverStrikes } from '../hooks';
import type { DriverStrike } from '../types';

/** "Fare report upheld" / "Cancelled after accepting"; an unknown kind reads as words. */
export const strikeKindLabel = (kind: string): string => {
  if (kind === 'overcharge_report') return t('strikes.kindOvercharge');
  if (kind === 'driver_cancel') return t('strikes.kindDriverCancel');
  // BE-86: an "AC not working" report an admin confirmed (automatic ones stay pending, unlisted).
  if (kind === 'ac_not_working') return t('strikes.kindAcNotWorking');
  const words = kind.replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : kind;
};

/**
 * A strike's date: BE-105 sends passenger-report strikes (overcharge, AC) as `YYYY-MM-DD` only,
 * shown as the date without a time; other strikes carry an ISO time.
 */
export const strikeDate = (value: string | null): string => {
  if (!value) return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatCalendarDate(value) : formatDateTime(value);
};

/** Counts until a date / no longer counts / voided. */
export const strikeStatus = (strike: DriverStrike): { label: string; tone: 'warning' | 'neutral' } => {
  if (strike.status === 'voided') return { label: t('strikes.statusVoided'), tone: 'neutral' };
  if (strike.counts) {
    const until = strikeDate(strike.countsUntil);
    return { label: until ? t('strikes.statusCounts', { date: until }) : t('strikes.statusCountsPlain'), tone: 'warning' };
  }
  return { label: t('strikes.statusExpired'), tone: 'neutral' };
};

const STRIKE_ICONS: Readonly<Record<string, IconName>> = { overcharge_report: 'dispute', ac_not_working: 'ac' };

function StrikeRow({ strike }: { strike: DriverStrike }) {
  const status = strikeStatus(strike);
  return (
    <Card testID={`strike-${strike.key}`}>
      <View style={styles.row}>
        <Icon name={STRIKE_ICONS[strike.kind] ?? 'close'} size={20} color="textSecondary" />
        <View style={styles.flex}>
          <AppText variant="bodyStrong">{strikeKindLabel(strike.kind)}</AppText>
          {strike.createdAt ? (
            <AppText variant="caption" color="textMuted" testID={`strike-${strike.key}-date`}>
              {strikeDate(strike.createdAt)}
            </AppText>
          ) : null}
          {/* BE-82 / BE-105: a passenger-report strike is date, kind and status only (mapped without a reason). */}
          {strike.reason ? (
            <AppText variant="bodySmall" color="textSecondary" testID={`strike-${strike.key}-reason`}>
              {strike.reason}
            </AppText>
          ) : null}
        </View>
      </View>
      <View style={styles.badge}>
        <Badge label={status.label} tone={status.tone} testID={`strike-${strike.key}-status`} />
      </View>
    </Card>
  );
}

/**
 * Earnings → Strikes (T-521, GET /driver/strikes): how many active strikes count in the window
 * against the review threshold, an "Account under review" banner when reached (the account is
 * not suspended), and each strike: what for, when, and whether it still counts.
 */
export default function DriverStrikesScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { data, status, error, refresh, reload } = useDriverStrikes(isFocused);

  let body: React.ReactNode;
  if (data) {
    body = (
      <>
        {data.underReview ? (
          <Banner
            tone="warning"
            title={t('strikes.underReviewTitle')}
            text={t('strikes.underReviewBody', { threshold: data.reviewThreshold, days: data.windowDays })}
            testID="strikes-under-review"
          />
        ) : null}
        <AppText variant="bodySmall" color="textSecondary" testID="strikes-summary">
          {t('strikes.summary', { count: data.activeCount, threshold: data.reviewThreshold, days: data.windowDays })}
        </AppText>
        {data.strikes.length === 0 ? (
          <EmptyState icon="shield" title={t('strikes.emptyTitle')} body={t('strikes.emptyBody')} testID="strikes-empty" />
        ) : (
          data.strikes.map((strike) => <StrikeRow key={strike.key} strike={strike} />)
        )}
      </>
    );
  } else if (status === 'failed') {
    body = (
      <ErrorState
        title={t('strikes.loadFailed')}
        body={error ?? undefined}
        retryLabel={t('strikes.retry')}
        onRetry={reload}
        testID="strikes-error"
      />
    );
  } else {
    body = <SkeletonList rows={3} testID="strikes-loading" />;
  }

  return (
    <Screen
      scroll
      testID="strikes-screen"
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={status === 'refreshing'} onRefresh={refresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
      }
    >
      <Header title={t('strikes.title')} backLabel={t('strikes.back')} onBack={() => navigation.goBack()} tone="background" testID="strikes" />
      <View style={styles.body}>{body}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space[8] },
  body: { paddingHorizontal: space[4], paddingTop: space[2], gap: space[3], width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  flex: { flex: 1, minWidth: 0, gap: space[1] / 2 },
  badge: { flexDirection: 'row', marginTop: space[2] },
});
