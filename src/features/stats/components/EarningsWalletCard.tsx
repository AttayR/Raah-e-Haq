import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Button, Card, Icon, ListItem, Skeleton, type IconName } from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, radius, space } from '../../../theme';
import { useWallet } from '../../wallet/hooks';
import { owedCardState, type OwedCardState } from '../heroText';

type Props = {
  /** Reads GET /wallet while the Earnings tab is focused. */
  visible: boolean;
  onOpenWallet: () => void;
  /** "Pay {amount}": Add money prefilled with what is owed (BE-74 top-up). */
  onPay: (amountOwed: number) => void;
};

const e = componentTokens.earnings;

/**
 * Earnings › amount owed (UI-R17, docs/design/screens/driver-earnings.md §2), from GET /wallet
 * now, not the selected period. Owed: a prominent `warningSoft` card with Pay (when `canTopUp`)
 * and Wallet; on hold: the same without Pay; nothing owed or credit: one calm row to Wallet.
 * Loading is a skeleton and a failed read is a row that retries.
 */
export function EarningsWalletCard({ visible, onOpenWallet, onPay }: Props) {
  const { data, status, reload } = useWallet(visible);
  const state = useMemo(() => owedCardState(data, status === 'failed'), [data, status]);
  return <OwedCard state={state} onOpenWallet={onOpenWallet} onPay={onPay} onRetry={reload} />;
}

type ViewProps = Omit<Props, 'visible'> & { state: OwedCardState; onRetry: () => void };

const OwedCard = React.memo(function OwedCard({ state, onOpenWallet, onPay, onRetry }: ViewProps) {
  switch (state.kind) {
    case 'loading':
      return <Skeleton shape="card" height={componentTokens.skeleton.heights.earningsOwed} testID="earnings-owed-loading" />;
    case 'failed':
      return (
        <Card padding="none" testID="earnings-wallet-card">
          <ListItem
            icon="networkError"
            title={t('earnings.walletFailedTitle')}
            subtitle={t('earnings.walletFailedBody')}
            onPress={onRetry}
            chevron={false}
            testID="earnings-wallet-retry"
          />
        </Card>
      );
    case 'owed':
    case 'onHold':
      return <OwedProminent state={state} onOpenWallet={onOpenWallet} onPay={onPay} />;
    case 'credit':
      return <CalmRow icon="wallet" title={state.title} subtitle={t('earnings.creditBody')} onPress={onOpenWallet} />;
    case 'settled':
      return <CalmRow icon="checkMark" title={t('earnings.settledTitle')} subtitle={t('earnings.settledBody')} onPress={onOpenWallet} />;
  }
});

function OwedProminent({
  state,
  onOpenWallet,
  onPay,
}: {
  state: Extract<OwedCardState, { kind: 'owed' | 'onHold' }>;
  onOpenWallet: () => void;
  onPay: (amountOwed: number) => void;
}) {
  const { theme } = useAppTheme();
  const dark = theme.mode === 'dark';
  const title = state.kind === 'onHold' && !state.amount ? t('earnings.owedOnHoldTitle') : t('earnings.owedTitle');
  const pay = state.kind === 'owed' && state.payLabel ? { label: state.payLabel, amountOwed: state.amountOwed } : null;
  const groupLabel = state.amount ? t('earnings.owedA11y', { amount: state.amount }) : title;
  return (
    <View style={[styles.owed, { backgroundColor: theme.colors.warningSoft }]} testID="earnings-owed">
      <View style={styles.owedRow} accessible accessibilityLabel={`${groupLabel}. ${state.body}`}>
        <View style={[styles.circle, { backgroundColor: dark ? theme.colors.surfaceAlt : theme.colors.surface }]}>
          <Icon name="moneyOut" size={e.owedIcon} color="warning" />
        </View>
        <View style={styles.owedText}>
          <AppText variant="label" color="warning">
            {title}
          </AppText>
          {state.amount ? (
            <AppText variant="numericL" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} testID="earnings-owed-amount">
              {state.amount}
            </AppText>
          ) : null}
          <AppText variant="caption" color="textSecondary" numberOfLines={3}>
            {state.body}
          </AppText>
        </View>
      </View>
      {/* Pay gets the full width so "Pay Rs 99,999" never truncates; Wallet is the quiet second action. */}
      <View style={styles.actions}>
        {pay ? (
          <Button
            label={pay.label}
            size="md"
            leadingIcon="topUp"
            onPress={() => onPay(pay.amountOwed)}
            accessibilityLabel={pay.label}
            testID="earnings-owed-pay"
          />
        ) : null}
        <Button
          label={t('earnings.owedWallet')}
          variant={pay ? 'ghost' : 'secondary'}
          size="md"
          onPress={onOpenWallet}
          accessibilityLabel={t('earnings.walletOpenA11y')}
          testID="earnings-owed-wallet"
        />
      </View>
    </View>
  );
}

function CalmRow({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle: string; onPress: () => void }) {
  const { theme } = useAppTheme();
  return (
    <Card padding="none" testID="earnings-wallet-card">
      <ListItem
        leading={
          <View style={[styles.circle, { backgroundColor: theme.colors.successSoft }]}>
            <Icon name={icon} color="success" />
          </View>
        }
        title={title}
        subtitle={subtitle}
        onPress={onPress}
        accessibilityLabel={`${title}, ${subtitle}`}
        accessibilityHint={t('earnings.walletOpenA11y')}
        testID="earnings-wallet"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  owed: { borderRadius: radius.lg, padding: space[4], gap: space[3] },
  owedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  circle: {
    width: e.owedIconCircle,
    height: e.owedIconCircle,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  owedText: { flex: 1, minWidth: 0 },
  actions: { gap: space[1] },
});
