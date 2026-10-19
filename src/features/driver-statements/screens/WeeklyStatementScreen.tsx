import React from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Banner, ErrorState, Header, IconButton, Screen, SkeletonList } from '../../../components/ui';
import { formatMoney } from '../../../core/format/money';
import { t } from '../../../i18n';
import { componentTokens, layout, space } from '../../../theme';
import { periodCaption } from '../../stats/format';
import { vehicleLabel } from '../../ride-history/copy';
import { formatRate } from '../../fare/format';
import { StatementCard } from '../components/StatementRows';
import { useWeeklyStatement } from '../hooks';
import type { StatementVehicleLine, WeeklyStatement } from '../types';

/** A by-type line's React key: vehicle type plus commission rate, unique per statement (T-543). */
export const statementLineKey = (line: Pick<StatementVehicleLine, 'vehicleType' | 'commissionRate'>): string =>
  `${line.vehicleType}@${line.commissionRate}`;

function StatementBody({ statement }: { statement: WeeklyStatement }) {
  const money = (n: number) => formatMoney(n, { currency: statement.currency });
  const signed = (n: number) => formatMoney(n, { currency: statement.currency, sign: 'always' });
  const { rides, ledger, owed, balance } = statement;
  return (
    <>
      <StatementCard
        title={t('statements.trips')}
        testID="statement-rides"
        rows={[
          { key: 'count', label: t('statements.trips'), value: String(rides.count) },
          { key: 'gross', label: t('statements.grossFares'), value: money(rides.grossFares) },
          rides.bookingFees > 0 && { key: 'bookingFees', label: t('statements.bookingFees'), value: money(-rides.bookingFees) },
          { key: 'commission', label: t('statements.commission'), value: money(-rides.commission) },
          { key: 'net', label: t('statements.driverNet'), value: money(rides.driverNet), strong: true },
        ]}
        footer={
          rides.count === 0 ? (
            <AppText variant="caption" color="textMuted" testID="statement-empty">
              {t('statements.empty')}
            </AppText>
          ) : null
        }
      />
      {statement.byVehicleType.length > 0 ? (
        <StatementCard
          title={t('statements.byType')}
          testID="statement-types"
          rows={statement.byVehicleType.map((line) => ({
            // One line per vehicle type and commission rate (BE-84): a rate change mid-week gives
            // the same type twice, so the type alone is not unique (T-543).
            key: statementLineKey(line),
            label: `${vehicleLabel(line.vehicleType) ?? line.vehicleType}: ${t(line.rides === 1 ? 'statements.typeLineOne' : 'statements.typeLine', {
              rides: line.rides,
              rate: formatRate(line.commissionRate),
              net: money(line.driverNet),
            })}`,
            value: money(line.grossFares),
          }))}
        />
      ) : null}
      <StatementCard
        title={t('statements.ledgerTitle')}
        testID="statement-ledger"
        rows={[
          { key: 'due', label: t('statements.commissionDue'), value: money(ledger.commissionDue) },
          { key: 'paid', label: t('statements.commissionPaid'), value: money(ledger.commissionPaid) },
          ledger.topups > 0 && { key: 'topups', label: t('statements.topups'), value: money(ledger.topups) },
          ledger.payouts > 0 && { key: 'payouts', label: t('statements.payouts'), value: money(ledger.payouts) },
          ledger.other !== 0 && { key: 'other', label: t('statements.other'), value: money(ledger.other) },
          { key: 'net', label: t('statements.netChange'), value: signed(ledger.netChange), strong: true },
          { key: 'opening', label: `${t('statements.balanceTitle')} · ${t('statements.opening')}`, value: money(balance.opening) },
          { key: 'closing', label: `${t('statements.balanceTitle')} · ${t('statements.closing')}`, value: money(balance.closing) },
        ]}
      />
      <StatementCard
        title={t('statements.owedTitle')}
        testID="statement-owed"
        rows={[
          { key: 'start', label: t('statements.opening'), value: money(owed.startOfWeek) },
          { key: 'end', label: t('statements.closing'), value: money(owed.endOfWeek) },
          { key: 'now', label: t('statements.owedNow'), value: money(owed.now), strong: true },
        ]}
      />
      <Banner
        tone={statement.reconciled ? 'success' : 'warning'}
        text={statement.reconciled ? t('statements.reconciled') : t('statements.notReconciled')}
        testID="statement-reconciled"
      />
    </>
  );
}

/**
 * Earnings → Weekly statements (T-521, BE-84 GET /driver/statements): one week at a time with a
 * prev / next picker (next stops at this week), the trips' fares, commission and earnings, the
 * split per vehicle type, the wallet entries of the week, what was owed at the start, the end and
 * now, and whether the ledger matches the trips. Pull to refresh; loading and error states.
 */
export default function WeeklyStatementScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const statement = useWeeklyStatement(isFocused);
  const { data, status, error } = statement;
  const range = data ? periodCaption('week', data.from, data.to) : '';

  return (
    <Screen
      scroll
      testID="statement-screen"
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={status === 'refreshing'}
          onRefresh={statement.refresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      <Header
        title={t('statements.title')}
        backLabel={t('statements.back')}
        onBack={() => navigation.goBack()}
        tone="background"
        testID="statement"
      />
      <View style={styles.body}>
        <View style={styles.picker}>
          <IconButton
            icon="back"
            variant="tonal"
            onPress={statement.prev}
            disabled={!statement.canGoPrev || status === 'loading'}
            accessibilityLabel={t('statements.prevWeekA11y')}
            testID="statement-prev"
          />
          <AppText
            variant="title"
            align="center"
            style={styles.range}
            accessibilityLabel={range ? t('statements.weekA11y', { range }) : undefined}
            testID="statement-range"
          >
            {range}
          </AppText>
          <IconButton
            icon="chevronEnd"
            variant="tonal"
            onPress={statement.next}
            disabled={!statement.canGoNext || status === 'loading'}
            accessibilityLabel={t('statements.nextWeekA11y')}
            testID="statement-next"
          />
        </View>
        {data ? (
          <>
            {status === 'failed' && error ? (
              <AppText variant="bodySmall" color="danger" testID="statement-refresh-error">
                {error}
              </AppText>
            ) : null}
            <StatementBody statement={data} />
          </>
        ) : status === 'failed' ? (
          <ErrorState
            title={t('statements.loadFailed')}
            body={error ?? undefined}
            retryLabel={t('statements.retry')}
            onRetry={statement.reload}
            testID="statement-error"
          />
        ) : (
          <SkeletonList heroHeight={componentTokens.skeleton.heights.statementHero} rows={4} testID="statement-loading" />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space[8] },
  body: { paddingHorizontal: space[4], paddingTop: space[2], gap: space[3], width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center' },
  picker: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  range: { flex: 1 },
});
