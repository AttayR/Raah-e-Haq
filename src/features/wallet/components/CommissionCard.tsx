import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Button, Card, ListItem } from '../../../components/ui';
import { formatMoney } from '../../../core/format/money';
import { space } from '../../../theme';
import { WALLET_COPY } from '../copy';
import type { Settlement, Wallet } from '../types';
import { SettlementRow } from './SettlementRow';

type Props = {
  wallet: Wallet;
  onPay: () => void;
  onOpenReports: () => void;
  onCancel: (settlement: Settlement) => void;
  cancellingId: number | null;
};

/**
 * Driver only: the commission owed (`commission_owed`), "Pay commission" while nothing is
 * waiting for review, the pending report(s) with Cancel, and the link to all reports.
 */
export function CommissionCard({ wallet, onPay, onOpenReports, onCancel, cancellingId }: Props) {
  const { theme } = useAppTheme();
  const owed = wallet.commissionOwed;
  const pending = wallet.pendingSettlements.filter((s) => s.status === 'pending' && s.kind === 'commission_payment');
  const canPay = wallet.canSettleCommission && owed > 0 && pending.length === 0;
  return (
    <Card padding="none" testID="wallet-commission-card">
      <View style={styles.body}>
        <AppText variant="overline" color="textMuted">
          {WALLET_COPY.commissionTitle}
        </AppText>
        <AppText
          variant="numericL"
          color={owed > 0 ? 'danger' : 'textPrimary'}
          testID="wallet-commission-owed"
        >
          {formatMoney(owed, { currency: wallet.currency })}
        </AppText>
        <AppText variant="bodySmall" color="textSecondary">
          {owed > 0 ? WALLET_COPY.commissionBody : WALLET_COPY.commissionNoneOwed}
        </AppText>
        {canPay ? (
          <Button label={WALLET_COPY.payCommission} leadingIcon="cash" onPress={onPay} testID="wallet-pay-commission" />
        ) : null}
      </View>
      {pending.map((settlement) => (
        <View key={settlement.id} style={[styles.divided, { borderTopColor: theme.colors.border }]}>
          <SettlementRow settlement={settlement} onCancel={onCancel} cancelling={cancellingId === settlement.id} />
        </View>
      ))}
      <View style={[styles.divided, { borderTopColor: theme.colors.border }]}>
        <ListItem
          icon="receipt"
          title={WALLET_COPY.paymentRequests}
          subtitle={WALLET_COPY.paymentRequestsSubtitle}
          onPress={onOpenReports}
          testID="wallet-open-settlements"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { padding: space[4], gap: space[2] },
  divided: { borderTopWidth: StyleSheet.hairlineWidth },
});
