import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText } from '../../../components/ui';
import { formatMoney } from '../../../core/format/money';
import { radius, space } from '../../../theme';
import { WALLET_COPY } from '../copy';
import type { Wallet } from '../types';

type Props = { wallet: Wallet; isDriver: boolean };

/**
 * Balance hero (docs/design/screens/passenger-wallet.md): `primary` fill with `onPrimary`
 * text in light, `primarySoft` / `onPrimarySoft` in dark. One meta line: spent (passenger) or
 * cash earnings (driver). "Add money" (T-515) sits under the card, on the Wallet screen.
 */
export function BalanceCard({ wallet, isDriver }: Props) {
  const { theme } = useAppTheme();
  const dark = theme.mode === 'dark';
  const text = dark ? 'onPrimarySoft' : 'onPrimary';
  const metaLabel = isDriver ? WALLET_COPY.earnedLabel : WALLET_COPY.spentLabel;
  const metaValue = isDriver ? wallet.totalEarnings : wallet.totalSpent;
  const balance = formatMoney(wallet.balance, { currency: wallet.currency });
  return (
    <View
      style={[styles.card, { backgroundColor: dark ? theme.colors.primarySoft : theme.colors.primary }]}
      testID="wallet-balance-card"
      accessible
      accessibilityLabel={`${WALLET_COPY.balanceLabel}: ${balance}`}
    >
      <AppText variant="caption" color={text}>
        {WALLET_COPY.balanceLabel}
      </AppText>
      <AppText
        variant="numericXL"
        color={text}
        // UI-R15: no adjustsFontSizeToFit; on iOS (new arch) it shrank the balance to a few
        // points in this card. 34pt fits a seven-figure balance on an SE.
        numberOfLines={1}
        testID="wallet-balance"
      >
        {balance}
      </AppText>
      <View style={styles.meta}>
        <AppText variant="caption" color={text} style={styles.metaLabel}>
          {metaLabel}
        </AppText>
        <AppText variant="numeric" color={text} testID="wallet-balance-meta">
          {formatMoney(metaValue, { currency: wallet.currency })}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space[5], gap: space[1] },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[2], marginTop: space[3] },
  metaLabel: { flexShrink: 1 },
});
