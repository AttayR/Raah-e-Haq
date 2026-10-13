import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
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
  Header,
  Screen,
  SegmentedControl,
  SkeletonList,
} from '../../../components/ui';
import { componentTokens, layout, space } from '../../../theme';
import { BalanceCard } from '../components/BalanceCard';
import { CommissionCard } from '../components/CommissionCard';
import { TransactionRow } from '../components/TransactionRow';
import { WALLET_COPY } from '../copy';
import { groupByDay, type TransactionSection } from '../format';
import { useCancelSettlement, useWallet, useWalletTransactions } from '../hooks';
import type { Settlement, TransactionFilter, WalletTransaction } from '../types';

const FILTERS = [
  { value: 'all', label: WALLET_COPY.filterAll },
  { value: 'credit', label: WALLET_COPY.filterIn },
  { value: 'debit', label: WALLET_COPY.filterOut },
] as const;

/**
 * Wallet for both roles (T-508, BE-09): balance and totals from GET /wallet, the cash-only
 * note, and the ledger from GET /wallet/transactions grouped by day with a direction filter,
 * pull to refresh and infinite scroll. Drivers also get the commission owed, "Pay commission"
 * and their payment reports. Cash only: no top-up, no payment methods.
 */
export default function WalletScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const isFocused = useIsFocused();
  const isDriver = useSelector((state: RootState) => state.apiAuth.user?.role === 'driver');
  const [filter, setFilter] = useState<TransactionFilter>('all');

  const wallet = useWallet(isFocused);
  const list = useWalletTransactions(filter, isFocused);
  const { cancel, cancellingId } = useCancelSettlement();
  const sections = useMemo(() => groupByDay(list.items), [list.items]);

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

  const header = (
    <Header
      title={WALLET_COPY.title}
      backLabel={WALLET_COPY.back}
      onBack={() => navigation.goBack()}
      tone="background"
      testID="wallet"
    />
  );

  // No wallet yet: the whole body is the loading or error state.
  if (!walletData) {
    const failed = wallet.status === 'failed';
    return (
      <Screen testID="wallet-screen">
        {header}
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
      </Screen>
    );
  }

  const listHeader = (
    <View style={styles.headerBlock}>
      <BalanceCard wallet={walletData} isDriver={isDriver} />
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
      <SegmentedControl<TransactionFilter>
        options={FILTERS}
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
        icon="receipt"
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
    <Screen testID="wallet-screen">
      {header}
      <SectionList
        testID="wallet-transactions"
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingBottom: space[8] },
  contentEmpty: { flexGrow: 1 },
  headerBlock: { paddingHorizontal: space[4], paddingTop: space[2], paddingBottom: space[2], gap: space[3] },
  sectionTitle: { marginTop: space[3] },
  dayHeader: { minHeight: 32, justifyContent: 'center', paddingHorizontal: space[4] },
  footer: { paddingVertical: space[4], alignItems: 'center', gap: space[2] },
});
