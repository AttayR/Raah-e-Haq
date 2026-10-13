import React from 'react';
import { Card, ListItem } from '../../../components/ui';
import { formatMoney } from '../../../core/format/money';
import { t } from '../../../i18n';
import { useWallet } from '../../wallet/hooks';

type Props = {
  /** Reads GET /wallet while the Earnings tab is focused. */
  visible: boolean;
  onOpen: () => void;
};

/**
 * Earnings › commission and settlements entry (DESIGN_SYSTEM §8.1, UI-R4): the commission owed
 * from GET /wallet (BE-09), opening the Wallet screen (balance, "Pay commission", payment
 * reports). While the wallet loads the row says what it opens; if GET /wallet fails it says so
 * (never "loading" forever). Either way the row opens the screen, which has its own loading,
 * error and retry states; nothing is shown that the API did not return.
 */
export function EarningsWalletCard({ visible, onOpen }: Props) {
  const { data, status } = useWallet(visible);
  const subtitle = !data
    ? status === 'failed'
      ? t('earnings.walletUnavailable')
      : t('earnings.walletLoading')
    : data.commissionOwed > 0
    ? t('earnings.walletOwed', { amount: formatMoney(data.commissionOwed, { currency: data.currency }) })
    : t('earnings.walletClear');
  return (
    <Card padding="none" testID="earnings-wallet-card">
      <ListItem
        icon="wallet"
        title={t('earnings.walletTitle')}
        subtitle={subtitle}
        onPress={onOpen}
        accessibilityLabel={`${t('earnings.walletTitle')}, ${subtitle}`}
        testID="earnings-wallet"
      />
    </Card>
  );
}
