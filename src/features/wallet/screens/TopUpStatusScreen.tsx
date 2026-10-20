import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';
import {
  StackActions,
  useIsFocused,
  useNavigation,
  useRoute,
  type NavigationProp,
  type ParamListBase,
  type RouteProp,
} from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import type { RootState } from '../../../store';
import { AppText, Button, Card, ErrorState, Header, Icon, Screen, SkeletonCard, SkeletonGroup } from '../../../components/ui';
import { formatMoney } from '../../../core/format/money';
import { triggerHaptic } from '../../../core/haptics';
import { t } from '../../../i18n';
import { componentTokens, layout, radius, space } from '../../../theme';
import { ADD_MONEY_ROUTE, type WalletRoutes } from '../navigation';
import { providerDisplayName, topUpStatusView } from '../topUpFormat';
import { isTerminalTopUp, useAppActive, useTopUpStatus } from '../topUpHooks';
import type { TopUp } from '../types';

type Row = { label: string; value: string; testID?: string };

const detailRows = (topUp: TopUp, providerName: string): Row[] =>
  [
    { label: t('topUp.statusAmount'), value: formatMoney(topUp.amount, { currency: topUp.currency }), testID: 'top-up-status-amount' },
    { label: t('topUp.statusProvider'), value: providerName },
    topUp.mobileNumber ? { label: t('topUp.statusAccount'), value: topUp.mobileNumber } : null,
    topUp.transactionId ? { label: t('topUp.statusReference'), value: topUp.transactionId } : null,
  ].filter((row): row is Row => row !== null);

/**
 * One top-up's result (T-515, BE-74). Polls GET /wallet/topups/{id} every 3 s while the screen
 * is focused and the app is in the foreground, until it succeeds, fails or expires (the browser
 * redirect is only a "come back" signal; the status always comes from the server). Pending,
 * succeeded, failed/expired (with "Try again") and "still waiting" after `expires_at`. Back to
 * wallet returns to the wallet, which reloads its balance and history on focus.
 */
export default function TopUpStatusScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { params } = useRoute<RouteProp<WalletRoutes, 'TopUpStatus'>>();
  const isDriver = useSelector((state: RootState) => state.apiAuth.user?.role === 'driver');
  const appActive = useAppActive();
  const isFocused = useIsFocused();
  const { result, error, gone, timedOut, checkAgain } = useTopUpStatus(params.id, params.result ?? null, isFocused && appActive);

  const topUp = result?.topUp ?? null;
  const status = topUp?.status ?? null;

  // One haptic when the result arrives on this screen.
  const announced = useRef(status !== null && isTerminalTopUp(status));
  useEffect(() => {
    if (!status || !isTerminalTopUp(status) || announced.current) return;
    announced.current = true;
    triggerHaptic(status === 'succeeded' ? 'notificationSuccess' : 'notificationError');
  }, [status]);

  const backToWallet = () => {
    navigation.dispatch(
      isDriver
        ? StackActions.popTo('Wallet')
        : StackActions.popTo('PassengerTabs', { screen: 'Activity', params: { segment: 'wallet' } }),
    );
  };

  const header = (
    <Header title={t('topUp.statusTitle')} backLabel={t('topUp.backToWallet')} onBack={backToWallet} tone="background" testID="top-up-status" />
  );

  if (!topUp) {
    return (
      <Screen testID="top-up-status-screen">
        {header}
        {error ? (
          <ErrorState
            title={t('topUp.statusLoadFailed')}
            body={error}
            retryLabel={t('topUp.checkAgain')}
            onRetry={checkAgain}
            testID="top-up-status-error"
          />
        ) : (
          <SkeletonGroup testID="top-up-status-loading" style={styles.body}>
            <SkeletonCard height={200} />
          </SkeletonGroup>
        )}
      </Screen>
    );
  }

  const providerName = params.providerName ?? providerDisplayName(topUp.provider);
  const view = topUpStatusView(topUp, providerName, timedOut);
  const open = !isTerminalTopUp(topUp.status);
  const polling = open && !timedOut && !gone;
  const failed = topUp.status === 'failed' || topUp.status === 'expired' || topUp.status === 'cancelled';
  const rows = detailRows(topUp, providerName);

  return (
    <Screen scroll testID="top-up-status-screen" contentStyle={styles.content}>
      {header}
      <View style={styles.body}>
        <View style={styles.hero} accessible accessibilityRole="summary" accessibilityLiveRegion="polite" testID="top-up-status-hero">
          <View style={[styles.heroIcon, { backgroundColor: theme.colors.surfaceAlt }]}>
            {polling ? (
              <ActivityIndicator color={theme.colors.primary} testID="top-up-status-polling" />
            ) : (
              <Icon name={view.icon} size={32} color={view.color} />
            )}
          </View>
          <AppText variant="h2" align="center" testID="top-up-status-title">
            {view.title}
          </AppText>
          <AppText variant="body" color="textSecondary" align="center" testID="top-up-status-body">
            {view.body}
          </AppText>
        </View>

        {error && !gone ? (
          <AppText variant="bodySmall" color="danger" align="center" testID="top-up-status-refresh-error">
            {error}
          </AppText>
        ) : null}

        <Card padding="none">
          {rows.map((row, index) => (
            <View
              key={row.label}
              style={[styles.row, index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border } : null]}
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

        <View style={styles.actions}>
          {topUp.status === 'succeeded' ? (
            <Button label={t('topUp.done')} onPress={backToWallet} testID="top-up-status-done" />
          ) : null}
          {failed ? (
            <Button
              label={t('topUp.tryAgain')}
              onPress={() => navigation.dispatch(StackActions.replace(ADD_MONEY_ROUTE))}
              testID="top-up-status-retry"
            />
          ) : null}
          {open && (timedOut || gone) ? (
            <Button label={t('topUp.checkAgain')} onPress={checkAgain} testID="top-up-status-check-again" />
          ) : null}
          {topUp.status !== 'succeeded' ? (
            <Button label={t('topUp.backToWallet')} variant="ghost" onPress={backToWallet} testID="top-up-status-wallet" />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space[8] },
  body: { paddingHorizontal: space[4], gap: space[4], width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center' },
  hero: { alignItems: 'center', gap: space[2], paddingVertical: space[6] },
  heroIcon: { width: componentTokens.wallet.statusIcon, height: componentTokens.wallet.statusIcon, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] },
  rowLabel: { flexShrink: 0, maxWidth: '45%' },
  rowValue: { flex: 1, minWidth: 0 },
  actions: { gap: space[2] },
});
