import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSelector } from 'react-redux';
import { useIsFocused, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import type { RootState } from '../../../store';
import {
  AppText,
  Banner,
  Button,
  EmptyState,
  ErrorState,
  FilterChips,
  Header,
  Screen,
  ScrollHairline,
  SkeletonList,
  useHeaderScroll,
} from '../../../components/ui';
import { perLocale, t } from '../../../i18n';
import { formatMoney } from '../../../core/format/money';
import { componentTokens, layout, space } from '../../../theme';
import { BalanceCard } from '../components/BalanceCard';
import { CommissionCard } from '../components/CommissionCard';
import { TransactionRow } from '../components/TransactionRow';
import { WALLET_COPY } from '../copy';
import { ADD_MONEY_ROUTE, passengerOwedBannerAmount, passengerOwedNote, topUpParamsFor } from '../navigation';
import { groupByDay, type TransactionSection } from '../format';
import { useCancelSettlement, useWallet, useWalletTransactions } from '../hooks';
import type { Settlement, TransactionFilter, WalletTransaction } from '../types';

const FILTERS = perLocale(() => [
  { value: 'all', label: WALLET_COPY.filterAll },
  { value: 'credit', label: WALLET_COPY.filterIn },
  { value: 'debit', label: WALLET_COPY.filterOut },
] as const);

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList<WalletTransaction, TransactionSection>);

export type WalletBodyProps = {
  /** True while the wallet is on screen (loads then, quietly again on each return). */
  visible: boolean;
};

/**
 * Wallet for both roles (T-508, BE-09): balance and totals from GET /wallet, the cash-only
 * note, and the ledger from GET /wallet/transactions grouped by day with a direction filter,
 * pull to refresh and infinite scroll. Drivers also get the commission owed, "Pay commission"
 * and their payment reports. Rides stay cash; "Add money" (T-515, BE-74) appears when the server
 * says `can_top_up`. The body is also the passenger's Activity › Wallet (UI-R4), under the
 * pinned Rides | Wallet segments with a hairline once it scrolls (UI-R15); the driver opens the
 * screen from Earnings.
 */
export function WalletBody({ visible }: WalletBodyProps) {
  const { theme } = useAppTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const isDriver = useSelector((state: RootState) => state.apiAuth.user?.role === 'driver');
  const [filter, setFilter] = useState<TransactionFilter>('all');

  const wallet = useWallet(visible);
  const list = useWalletTransactions(filter, visible);
  const { cancel, cancellingId } = useCancelSettlement();
  const sections = useMemo(() => groupByDay(list.items), [list.items]);
  const { scrollY, onScroll } = useHeaderScroll();

  const { data: walletData, refresh: refreshWallet } = wallet;
  const { refresh: refreshList, reload: reloadList } = list;

  // The spinner shows for a pull only, not for the quiet refresh on focus.
  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    if (pulling && wallet.status !== 'refreshing' && list.status !== 'refreshing') setPulling(false);
  }, [pulling, wallet.status, list.status]);

  const onRefresh = useCallback(() => {
    setPulling(true);
    refreshWallet();
    refreshList();
  }, [refreshWallet, refreshList]);

  const onOpen = useCallback(
    (item: WalletTransaction) => navigation.navigate('WalletTransaction', { id: item.id, transaction: item }),
    [navigation],
  );

  const onCancel = useCallback(
    async (settlement: Settlement) => {
      const cancelled = await cancel(settlement);
      if (cancelled) refreshWallet();
    },
    [cancel, refreshWallet],
  );

  const renderItem = useCallback(
    ({ item }: { item: WalletTransaction }) => <TransactionRow item={item} onPress={onOpen} />,
    [onOpen],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: TransactionSection }) => (
      <View style={[styles.dayHeader, { backgroundColor: theme.colors.background }]}>
        <AppText variant="caption" color="textMuted" accessibilityRole="header">
          {section.title}
        </AppText>
      </View>
    ),
    [theme.colors.background],
  );

  // No wallet yet: the whole body is the loading or error state.
  if (!walletData) {
    const failed = wallet.status === 'failed';
    return (
      <View style={styles.fill}>
        {failed ? (
          <ErrorState
            title={WALLET_COPY.loadFailed}
            body={wallet.error ?? undefined}
            retryLabel={WALLET_COPY.retry}
            onRetry={() => {
              wallet.reload();
              reloadList();
            }}
            testID="wallet-error"
          />
        ) : (
          <SkeletonList heroHeight={componentTokens.skeleton.heights.walletHero} rows={5} testID="wallet-loading" />
        )}
      </View>
    );
  }

  const owedAmount = isDriver ? null : passengerOwedBannerAmount(walletData);
  const owedNote = isDriver ? null : passengerOwedNote(walletData);

  const listHeader = (
    <View>
      <View style={styles.headerBlock}>
        <BalanceCard wallet={walletData} isDriver={isDriver} />
        {owedAmount !== null ? (
          // BE-85/BE-100: cancellation or no-show fees block the next booking; a top-up clears them.
          <Banner
            tone="warning"
            title={t('fare.owedTitle', { amount: formatMoney(owedAmount, { currency: walletData.currency }) })}
            text={t('fare.owedWalletBody')}
            action={
              walletData.canTopUp && walletData.topUp
                ? {
                    label: t('fare.owedTopUp'),
                    // T-543: Add money opens with the amount owed filled in.
                    onPress: () => navigation.navigate(ADD_MONEY_ROUTE, topUpParamsFor(owedAmount)),
                    testID: 'wallet-owed-top-up',
                  }
                : undefined
            }
            testID="wallet-amount-owed"
          />
        ) : null}
        {owedNote ? (
          // T-547 (BE-100): fees under the booking limit; booking still works, no top-up pressure.
          <Banner
            tone="info"
            text={t('fare.owedUnderLimitNote', {
              owed: formatMoney(owedNote.owed, { currency: walletData.currency }),
              limit: formatMoney(owedNote.limit, { currency: walletData.currency }),
            })}
            testID="wallet-owed-note"
          />
        ) : null}
        {walletData.canTopUp && walletData.topUp ? (
          <Button
            label={t('topUp.addMoney')}
            leadingIcon="topUp"
            variant="secondary"
            accessibilityLabel={t('topUp.addMoneyA11y')}
            onPress={() => navigation.navigate(ADD_MONEY_ROUTE)}
            testID="wallet-add-money"
          />
        ) : null}
        {walletData.status !== 'active' ? (
          <Banner tone="warning" text={WALLET_COPY.walletSuspended} testID="wallet-suspended" />
        ) : null}
        <Banner
          tone="info"
          icon="cash"
          title={WALLET_COPY.cashOnlyTitle}
          text={isDriver ? WALLET_COPY.cashOnlyDriver : WALLET_COPY.cashOnlyPassenger}
          testID="wallet-cash-only"
        />
        {isDriver ? (
          <CommissionCard
            wallet={walletData}
            onPay={() =>
              navigation.navigate('PayCommission', { owed: walletData.commissionOwed, currency: walletData.currency })
            }
            onOpenReports={() => navigation.navigate('WalletSettlements')}
            onCancel={onCancel}
            cancellingId={cancellingId}
          />
        ) : null}
        {wallet.error ? (
          <AppText variant="bodySmall" color="danger" testID="wallet-refresh-error">
            {wallet.error}
          </AppText>
        ) : null}
        <AppText variant="overline" color="textMuted" accessibilityRole="header" style={styles.sectionTitle}>
          {WALLET_COPY.transactions}
        </AppText>
        <FilterChips<TransactionFilter>
          options={FILTERS()}
          value={filter}
          onChange={setFilter}
          accessibilityLabel={WALLET_COPY.filterLabel}
          testID="wallet-filter"
        />
        {list.error && list.items.length > 0 ? (
          <AppText variant="bodySmall" color="danger" testID="wallet-transactions-refresh-error">
            {list.error}
          </AppText>
        ) : null}
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (list.status === 'loading') return <SkeletonList rows={4} testID="wallet-transactions-loading" />;
    if (list.status === 'failed') {
      return (
        <ErrorState
          title={WALLET_COPY.transactionsFailed}
          body={list.error ?? undefined}
          retryLabel={WALLET_COPY.retry}
          onRetry={reloadList}
          placement="center"
          testID="wallet-transactions-error"
        />
      );
    }
    const filtered = filter !== 'all';
    return (
      <EmptyState
        placement="center"
        icon="activity"
        title={filtered ? WALLET_COPY.emptyFilteredTitle : WALLET_COPY.emptyTitle}
        body={filtered ? WALLET_COPY.emptyFilteredBody : WALLET_COPY.emptyBody}
        testID="wallet-transactions-empty"
      />
    );
  };

  const renderFooter = () => {
    if (list.status === 'loadingMore') {
      return (
        <View style={styles.footer} testID="wallet-loading-more">
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      );
    }
    if (list.loadMoreError) {
      return (
        <View style={styles.footer} testID="wallet-load-more-error">
          <AppText variant="bodySmall" color="textSecondary" align="center">
            {list.loadMoreError}
          </AppText>
          <Button label={WALLET_COPY.retry} variant="ghost" size="sm" fullWidth={false} onPress={list.loadMore} />
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.fill}>
      <ScrollHairline scrollY={scrollY} testID="wallet-hairline" />
      <AnimatedSectionList
        testID="wallet-transactions"
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.fill}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={[styles.content, sections.length === 0 && styles.contentEmpty]}
        onEndReached={list.hasMore && !list.loadMoreError ? list.loadMore : undefined}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      />
    </View>
  );
}

/** The driver's Earnings → Wallet route: a standard Header with back over the body. */
export default function WalletScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const isFocused = useIsFocused();
  return (
    <Screen testID="wallet-screen">
      <Header
        title={WALLET_COPY.title}
        backLabel={WALLET_COPY.back}
        onBack={() => navigation.goBack()}
        tone="background"
        testID="wallet"
      />
      <WalletBody visible={isFocused} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingBottom: space[8] },
  contentEmpty: { flexGrow: 1 },
  headerBlock: { paddingHorizontal: space[4], paddingTop: space[2], paddingBottom: space[3], gap: space[3] },
  sectionTitle: { marginTop: space[3] },
  dayHeader: { minHeight: space[8], justifyContent: 'center', paddingHorizontal: space[4] },
  footer: { paddingVertical: space[4], alignItems: 'center', gap: space[2] },
});
