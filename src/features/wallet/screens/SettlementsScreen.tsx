import React, { useCallback } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useIsFocused, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Button, Screen } from '../../../components/ui';
import { layout, space } from '../../../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { SettlementRow } from '../components/SettlementRow';
import { StateView } from '../components/StateView';
import { WALLET_COPY } from '../copy';
import { useCancelSettlement, useSettlements } from '../hooks';
import type { Settlement } from '../types';

/**
 * Driver: every commission payment report (GET /wallet/settlements) with its review status and
 * the reviewer's note; a pending one can be cancelled (DELETE /wallet/settlements/{id}).
 */
export default function SettlementsScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const isFocused = useIsFocused();
  const list = useSettlements(isFocused);
  const { cancel, cancellingId } = useCancelSettlement();
  const { replaceItem } = list;

  const onCancel = useCallback(
    async (settlement: Settlement) => {
      const cancelled = await cancel(settlement);
      if (cancelled) replaceItem((item) => item.id === cancelled.id, cancelled);
    },
    [cancel, replaceItem],
  );

  const renderItem = useCallback(
    ({ item }: { item: Settlement }) => (
      <SettlementRow settlement={item} onCancel={onCancel} cancelling={cancellingId === item.id} />
    ),
    [onCancel, cancellingId],
  );

  const separator = useCallback(
    () => <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />,
    [theme.colors.border],
  );

  const renderEmpty = () => {
    if (list.status === 'loading') return <StateView kind="loading" testID="settlements-loading" />;
    if (list.status === 'failed') {
      return (
        <StateView
          kind="error"
          message={list.error ?? WALLET_COPY.settlementsFailed}
          retryLabel={WALLET_COPY.retry}
          onRetry={list.reload}
          testID="settlements-error"
        />
      );
    }
    return (
      <StateView
        kind="empty"
        icon="receipt"
        title={WALLET_COPY.settlementsEmptyTitle}
        body={WALLET_COPY.settlementsEmptyBody}
        testID="settlements-empty"
      />
    );
  };

  const renderFooter = () => {
    if (list.status === 'loadingMore') {
      return (
        <View style={styles.footer}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      );
    }
    if (list.loadMoreError) {
      return (
        <View style={styles.footer}>
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
    <Screen testID="settlements-screen">
      <ScreenHeader
        title={WALLET_COPY.settlementsTitle}
        backLabel={WALLET_COPY.back}
        onBack={() => navigation.goBack()}
        testID="settlements"
      />
      {list.error && list.items.length > 0 ? (
        <AppText variant="bodySmall" color="danger" style={styles.refreshError}>
          {list.error}
        </AppText>
      ) : null}
      <FlatList
        testID="settlements-list"
        data={list.items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ItemSeparatorComponent={separator}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={[styles.content, list.items.length === 0 && styles.contentEmpty]}
        onEndReached={list.hasMore && !list.loadMoreError ? list.loadMore : undefined}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={list.status === 'refreshing'}
            onRefresh={list.refresh}
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
  separator: { height: StyleSheet.hairlineWidth, marginStart: space[4] },
  footer: { paddingVertical: space[4], alignItems: 'center', gap: space[2] },
  refreshError: { paddingHorizontal: space[4] },
});
