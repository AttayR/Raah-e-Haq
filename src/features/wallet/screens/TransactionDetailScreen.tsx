import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import {
  AppText,
  Badge,
  Banner,
  Card,
  ErrorState,
  Header,
  Icon,
  ListItem,
  Screen,
  Skeleton,
  SkeletonCard,
  SkeletonGroup,
} from '../../../components/ui';
import { formatMoney } from '../../../core/format/money';
import { componentTokens, layout, radius, space } from '../../../theme';
import { SETTLEMENT_METHOD_LABEL, WALLET_COPY } from '../copy';
import { formatDateTime, transactionAmountColor, transactionAmountText, transactionIcon } from '../format';
import { useTransactionDetail } from '../hooks';
import { t as translate } from '../../../i18n';
import { TopUpDetailCard } from '../components/TopUpDetailCard';
import { providerDisplayName } from '../topUpFormat';
import type { WalletRoutes } from '../navigation';
import type { WalletTransaction } from '../types';
import { RIDE_DETAILS_ROUTE } from '../../ride-history/navigation';

type Row = { label: string; value: string; testID?: string };

/** Ledger types of a ride: their cash went from the passenger to the driver. */
const RIDE_TYPES: ReadonlySet<string> = new Set(['ride_payment', 'driver_earning', 'commission_due']);
/** Ledger types written by an approved settlement: "Cash at office" / "Bank transfer". */
const SETTLEMENT_TYPES: ReadonlySet<string> = new Set(['commission_payment', 'payout']);
/** BE-74: a top-up's entry names its gateway (`jazzcash|easypaisa`; the local fake books as `wallet`). */
const TOP_UP_TYPE = 'topup';

/** "Payment method" row: settlement wording only for settlements, never for ride rows (T-509). */
export const methodLabel = (
  t: Pick<WalletTransaction, 'type' | 'paymentMethod' | 'settlementId' | 'topupId'>,
): string | null => {
  const method = t.paymentMethod;
  if (!method) return null;
  if (t.type === TOP_UP_TYPE) {
    // The top-up card below names the gateway and the method (card / mobile account); the
    // ledger's `wallet` (the fake gateway's booking) would misread as "paid from the wallet".
    if (t.topupId || method === 'wallet') return null;
    return providerDisplayName(method);
  }
  if (method === 'wallet') return WALLET_COPY.title;
  if (RIDE_TYPES.has(t.type)) return method === 'cash' ? WALLET_COPY.methodRideCash : null;
  if (method === 'cash' || method === 'bank_transfer') {
    const settlement = SETTLEMENT_TYPES.has(t.type) || t.settlementId !== null;
    if (settlement) return SETTLEMENT_METHOD_LABEL[method];
    return method === 'cash' ? WALLET_COPY.methodCashGeneric : SETTLEMENT_METHOD_LABEL.bank_transfer;
  }
  return method;
};

const titleCase = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');

/** The detail rows that apply to this entry; absent fields are left out, never shown as "null". */
export const transactionDetailRows = (t: WalletTransaction): Row[] => {
  const money = (n: number) => formatMoney(n, { currency: t.currency });
  const method = methodLabel(t);
  const rows: Array<Row | null> = [
    { label: WALLET_COPY.detailType, value: t.label },
    { label: WALLET_COPY.detailStatus, value: titleCase(t.status) },
    t.createdAt ? { label: WALLET_COPY.detailDate, value: formatDateTime(t.createdAt) } : null,
    t.ride?.rideCode ? { label: WALLET_COPY.detailRide, value: t.ride.rideCode } : null,
    method ? { label: WALLET_COPY.detailMethod, value: method } : null,
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
  // The top-up id is a single-line caption under the top-up card, not a row (it wrapped).
  return rows.filter((row): row is Row => row !== null);
};

/**
 * One ledger entry (T-508): GET /wallet/transactions/{id}, opened from the Wallet list. An entry
 * for a ride links to its RideDetails (T-501); a top-up entry (T-515) shows its top-up.
 */
export default function TransactionDetailScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { params } = useRoute<RouteProp<WalletRoutes, 'WalletTransaction'>>();
  const { data: transaction, status, error, reload } = useTransactionDetail(params.id, params.transaction ?? null);

  const header = (
    <Header
      title={WALLET_COPY.detailTitle}
      backLabel={WALLET_COPY.back}
      onBack={() => navigation.goBack()}
      tone="background"
      testID="transaction"
    />
  );

  if (!transaction) {
    return (
      <Screen testID="transaction-screen">
        {header}
        {status === 'failed' ? (
          <ErrorState
            title={WALLET_COPY.detailFailed}
            body={error ?? undefined}
            retryLabel={WALLET_COPY.retry}
            onRetry={reload}
            testID="transaction-error"
          />
        ) : (
          <SkeletonGroup testID="transaction-loading" style={styles.body}>
            <View style={styles.hero}>
              <Skeleton width={56} height={56} shape="pill" />
              <Skeleton width="50%" textVariant="numericXL" />
              <Skeleton width="35%" textVariant="bodySmall" />
            </View>
            <SkeletonCard height={componentTokens.skeleton.heights.detailCard} />
          </SkeletonGroup>
        )}
      </Screen>
    );
  }

  const struck = transaction.reversed ? styles.struck : null;
  const rows = transactionDetailRows(transaction);
  const ride = transaction.ride;

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

        {transaction.reversed ? <Banner tone="info" icon="refund" text={WALLET_COPY.detailReversedNote} /> : null}
        {transaction.reversesId !== null ? <Banner tone="info" icon="refund" text={WALLET_COPY.detailReversalNote} /> : null}
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

        {transaction.topupId ? (
          <View style={styles.topUp}>
            <TopUpDetailCard id={transaction.topupId} />
            {/* Long opaque id: one line, truncated in the middle; long-press copies it whole. */}
            <AppText
              variant="caption"
              color="textMuted"
              numberOfLines={1}
              ellipsizeMode="middle"
              selectable
              style={styles.topUpId}
              testID="transaction-topup-id"
            >
              {translate('topUp.detailTopUpId', { id: transaction.topupId })}
            </AppText>
          </View>
        ) : null}

        {ride ? (
          <Card padding="none">
            <ListItem
              icon="rides"
              title={WALLET_COPY.viewRide}
              subtitle={ride.rideCode ?? undefined}
              onPress={() => navigation.navigate(RIDE_DETAILS_ROUTE, { rideId: ride.id })}
              testID="transaction-view-ride"
            />
          </Card>
        ) : null}
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
  topUp: { gap: space[2] },
  topUpId: { paddingHorizontal: space[4] },
});
