import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Card, SkeletonCard } from '../../../components/ui';
import { useRemoteData } from '../../../core/api/useRemoteData';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import { walletApi } from '../api';
import { providerDisplayName, topUpMethodLabel } from '../topUpFormat';
import type { TopUpResult } from '../types';

type Props = { id: string };

/**
 * The top-up behind a `topup` ledger entry (T-515): gateway, method and the masked account,
 * from GET /wallet/topups/{id}. The entry itself already shows amount, date and status, so a
 * failed lookup shows nothing rather than an error.
 */
export function TopUpDetailCard({ id }: Props) {
  const { theme } = useAppTheme();
  const fetch = useCallback(() => walletApi.getTopUp(id), [id]);
  const { data, status } = useRemoteData<TopUpResult | null>({
    fetch,
    key: id,
    fallbackError: t('topUp.statusLoadFailed'),
  });

  if (!data) {
    return status === 'loading' ? <SkeletonCard height={96} /> : null;
  }

  const { topUp } = data;
  const rows = [
    { label: t('topUp.detailProvider'), value: providerDisplayName(topUp.provider) },
    { label: t('topUp.detailMethod'), value: topUpMethodLabel(topUp.method) },
    topUp.mobileNumber ? { label: t('topUp.detailAccount'), value: topUp.mobileNumber } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  return (
    <Card padding="none" testID="transaction-topup">
      {rows.map((row, index) => (
        <View
          key={row.label}
          style={[
            styles.row,
            index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border } : null,
          ]}
        >
          <AppText variant="bodySmall" color="textSecondary" style={styles.label}>
            {row.label}
          </AppText>
          <AppText variant="bodyStrong" style={styles.value} align="end">
            {row.value}
          </AppText>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] },
  label: { flexShrink: 0, maxWidth: '45%' },
  value: { flex: 1, minWidth: 0 },
});
