import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Badge, Card, Icon, Screen } from '../../../components/ui';
import { formatMoney } from '../../../core/format/money';
import { layout, radius, space } from '../../../theme';
import { InfoNote } from '../components/InfoNote';
import { ScreenHeader } from '../components/ScreenHeader';
import { StateView } from '../components/StateView';
import { SETTLEMENT_METHOD_LABEL, WALLET_COPY } from '../copy';
import { formatDateTime, transactionAmountColor, transactionAmountText, transactionIcon } from '../format';
import { useTransactionDetail } from '../hooks';
import type { WalletRoutes } from '../navigation';
import type { WalletTransaction } from '../types';

type Row = { label: string; value: string; testID?: string };

const methodLabel = (method: string | null): string | null => {
  if (!method) return null;
  if (method === 'cash' || method === 'bank_transfer') return SETTLEMENT_METHOD_LABEL[method];
  return method === 'wallet' ? WALLET_COPY.title : method;
};

const titleCase = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');

/** The detail rows that apply to this entry; absent fields are left out, never shown as "null". */
export const transactionDetailRows = (t: WalletTransaction): Row[] => {
  const money = (n: number) => formatMoney(n, { currency: t.currency });
  const rows: Array<Row | null> = [
    { label: WALLET_COPY.detailType, value: t.label },
    { label: WALLET_COPY.detailStatus, value: titleCase(t.status) },
    t.createdAt ? { label: WALLET_COPY.detailDate, value: formatDateTime(t.createdAt) } : null,
    t.ride?.rideCode ? { label: WALLET_COPY.detailRide, value: t.ride.rideCode } : null,
    methodLabel(t.paymentMethod) ? { label: WALLET_COPY.detailMethod, value: methodLabel(t.paymentMethod) ?? '' } : null,
  ];
  // Driver earning: fare, the platform's commission and the driver's share.
  if (t.type === 'driver_earning' && t.grossAmount !== null) {
    rows.push({ label: WALLET_COPY.detailFare, value: money(t.grossAmount), testID: 'transaction-gross' });
    if (t.fee !== null) rows.push({ label: WALLET_COPY.detailCommission, value: money(t.fee), testID: 'transaction-fee' });
    rows.push({ label: WALLET_COPY.detailYourShare, value: money(t.netAmount ?? t.amount), testID: 'transaction-net' });
  }
  if (t.balanceAfter !== null) {
    rows.push({ label: WALLET_COPY.detailBalanceAfter, value: money(t.balanceAfter), testID: 'transaction-balance-after' });
  }
  if (t.reference) rows.push({ label: WALLET_COPY.detailReference, value: t.reference });
  return rows.filter((row): row is Row => row !== null);
};

/** One ledger entry (T-508): GET /wallet/transactions/{id}, opened from the Wallet list. */
export default function TransactionDetailScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { params } = useRoute<RouteProp<WalletRoutes, 'WalletTransaction'>>();
  const { data: transaction, status, error, reload } = useTransactionDetail(params.id, params.transaction ?? null);

  const header = (
    <ScreenHeader
      title={WALLET_COPY.detailTitle}
      backLabel={WALLET_COPY.back}
      onBack={() => navigation.goBack()}
      testID="transaction"
    />
  );

  if (!transaction) {
    return (
      <Screen testID="transaction-screen">
        {header}
        {status === 'failed' ? (
          <StateView
            kind="error"
            message={error ?? WALLET_COPY.detailFailed}
            retryLabel={WALLET_COPY.retry}
            onRetry={reload}
            testID="transaction-error"
          />
        ) : (
          <StateView kind="loading" testID="transaction-loading" />
        )}
      </Screen>
    );
  }

  const struck = transaction.reversed ? styles.struck : null;
  const rows = transactionDetailRows(transaction);

  return (
    <Screen scroll testID="transaction-screen" contentStyle={styles.content}>
      {header}
      <View style={styles.body}>
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: theme.colors.surfaceAlt }]}>
            <Icon name={transactionIcon(transaction)} size={28} color="textSecondary" />
          </View>
          <AppText
            variant="numericXL"
            color={transaction.reversed ? 'textMuted' : transactionAmountColor(transaction)}
            style={struck}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            testID="transaction-amount"
          >
            {transactionAmountText(transaction)}
          </AppText>
          {transaction.description ? (
            <AppText variant="bodySmall" color="textSecondary" align="center">
              {transaction.description}
            </AppText>
          ) : null}
          {transaction.reversed ? <Badge tone="neutral" label={WALLET_COPY.reversed} testID="transaction-reversed" /> : null}
        </View>

        {transaction.reversed ? <InfoNote icon="refund" text={WALLET_COPY.detailReversedNote} /> : null}
        {transaction.reversesId !== null ? <InfoNote icon="refund" text={WALLET_COPY.detailReversalNote} /> : null}
        {status === 'failed' && error ? (
          <AppText variant="bodySmall" color="danger" testID="transaction-refresh-error">
            {error}
          </AppText>
        ) : null}

        <Card padding="none">
          {rows.map((row, index) => (
            <View
              key={row.label}
              style={[
                styles.row,
                index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border } : null,
              ]}
              testID={row.testID}
            >
              <AppText variant="bodySmall" color="textSecondary" style={styles.rowLabel}>
                {row.label}
              </AppText>
              <AppText variant="bodyStrong" style={styles.rowValue} align="end" selectable>
                {row.value}
              </AppText>
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space[8] },
  body: { paddingHorizontal: space[4], gap: space[4], width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center' },
  hero: { alignItems: 'center', gap: space[2], paddingVertical: space[4] },
  heroIcon: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] },
  rowLabel: { flexShrink: 0, maxWidth: '45%' },
  rowValue: { flex: 1, minWidth: 0 },
  struck: { textDecorationLine: 'line-through' },
});
