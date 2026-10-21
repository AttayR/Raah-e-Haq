import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Badge, Button, type BadgeTone } from '../../../components/ui';
import { formatMoney } from '../../../core/format/money';
import { space } from '../../../theme';
import { SETTLEMENT_METHOD_LABEL, SETTLEMENT_STATUS_LABEL, WALLET_COPY } from '../copy';
import { formatDateTime } from '../format';
import type { Settlement, SettlementStatus } from '../types';

const STATUS_TONE: Record<SettlementStatus, BadgeTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
  reversed: 'danger',
};

/** Statuses whose reviewer note explains a refusal (shown in the danger colour). */
const REFUSED: ReadonlySet<SettlementStatus> = new Set(['rejected', 'reversed']);

type Props = {
  settlement: Settlement;
  /** Shown only for a pending report. */
  onCancel?: (settlement: Settlement) => void;
  cancelling?: boolean;
};

/** One payment report: amount, method and reference, its review status, the reviewer's note. */
export function SettlementRow({ settlement, onCancel, cancelling = false }: Props) {
  const details = [
    SETTLEMENT_METHOD_LABEL[settlement.method],
    settlement.reference,
    formatDateTime(settlement.createdAt),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.row} testID={`wallet-settlement-${settlement.id}`}>
      <View style={styles.top}>
        <AppText variant="numeric" style={styles.amount} numberOfLines={1}>
          {formatMoney(settlement.amount, { currency: settlement.currency })}
        </AppText>
        <Badge
          tone={STATUS_TONE[settlement.status]}
          label={SETTLEMENT_STATUS_LABEL[settlement.status]}
          testID={`wallet-settlement-${settlement.id}-status`}
        />
      </View>
      <AppText variant="caption" color="textSecondary">
        {details}
      </AppText>
      {settlement.reviewNote ? (
        <AppText
          variant="bodySmall"
          color={REFUSED.has(settlement.status) ? 'danger' : 'textSecondary'}
          testID={`wallet-settlement-${settlement.id}-note`}
        >
          {`${WALLET_COPY.reviewNote}: ${settlement.reviewNote}`}
        </AppText>
      ) : null}
      {settlement.status === 'pending' && onCancel ? (
        <Button
          label={WALLET_COPY.cancelRequest}
          variant="ghost"
          size="sm"
          fullWidth={false}
          // UI-R19 review: under the row's text, its label starts at the text start.
          flushStart
          loading={cancelling}
          onPress={() => onCancel(settlement)}
          accessibilityLabel={`${WALLET_COPY.cancelRequest} ${formatMoney(settlement.amount, { currency: settlement.currency })}`}
          testID={`wallet-settlement-${settlement.id}-cancel`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: space[4], paddingVertical: space[3], gap: space[1] },
  top: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  amount: { flex: 1, minWidth: 0 },
});
