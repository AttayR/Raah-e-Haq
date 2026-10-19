import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Icon } from '../../../components/ui';
import { radius, space } from '../../../theme';
import { transactionTypeLabel, WALLET_COPY } from '../copy';
import { formatTime, transactionAmountColor, transactionAmountText, transactionIcon } from '../format';
import type { WalletTransaction } from '../types';

type Props = { item: WalletTransaction; onPress: (item: WalletTransaction) => void };

/**
 * One ledger row: type icon, label (or description) and time, the amount coloured by
 * direction. A reversed entry is struck through and says so.
 */
export const TransactionRow = memo(function TransactionRow({ item, onPress }: Props) {
  const { theme } = useAppTheme();
  // T-575: an app-labelled type is read in the active language here, not kept from when it loaded.
  const label = transactionTypeLabel(item.type) ?? item.label;
  const amount = transactionAmountText(item);
  const time = formatTime(item.createdAt);
  // UI-R15: time only; the ride reference belongs to the transaction detail and ride details.
  const subtitle = time;
  const struck = item.reversed ? styles.struck : null;
  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={[label, amount, item.reversed ? WALLET_COPY.reversed : null, time]
        .filter(Boolean)
        .join(', ')}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: theme.colors.surfacePressed } : null]}
      testID={`wallet-transaction-${item.id}`}
    >
      <View style={[styles.icon, { backgroundColor: theme.colors.surfaceAlt }]}>
        <Icon name={transactionIcon(item)} size={20} color="textSecondary" />
      </View>
      <View style={styles.text}>
        <AppText variant="bodyStrong" numberOfLines={1} style={struck}>
          {label}
        </AppText>
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {item.reversed ? `${WALLET_COPY.reversed}${subtitle ? ` · ${subtitle}` : ''}` : subtitle}
        </AppText>
      </View>
      <AppText
        variant="numeric"
        color={item.reversed ? 'textMuted' : transactionAmountColor(item)}
        style={[styles.amount, struck]}
        numberOfLines={1}
        testID={`wallet-transaction-${item.id}-amount`}
      >
        {amount}
      </AppText>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 64,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: { flex: 1, minWidth: 0 },
  amount: { flexShrink: 0 },
  struck: { textDecorationLine: 'line-through' },
});
