import React, { useCallback } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View, type ListRenderItem } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Button, EmptyState, ErrorState, Header, Screen, Skeleton, SkeletonGroup } from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, layout, radius, space } from '../../../theme';
import { TicketRow } from '../components/TicketRow';
import { useTicketList } from '../hooks';
import type { SupportNavigator } from '../navigation';
import type { SupportTicket } from '../types';

const keyOf = (ticket: SupportTicket) => String(ticket.id);

/**
 * All requests (shared-support-invite §H3): the §H2 rows in one grouped card, 20 a page from the
 * server, a spinner row while the next page loads and "That's all your requests." at the end.
 * Pull to refresh; full-size empty and error states with "New request".
 */
export default function SupportRequestsScreen() {
  const navigation = useNavigation<SupportNavigator>();
  const { theme } = useAppTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const list = useTicketList(useIsFocused());
  const onOpen = useCallback((ticket: SupportTicket) => navigation.navigate('SupportTicket', { id: ticket.id }), [navigation]);
  const newRequest = useCallback(() => navigation.navigate('SupportNewRequest'), [navigation]);

  const count = list.items.length;
  const renderItem: ListRenderItem<SupportTicket> = useCallback(
    ({ item, index }) => (
      <View
        style={[
          styles.cell,
          {
            backgroundColor: c.surface,
            borderColor: c.border,
            borderStartWidth: theme.borderWidth.thin,
            borderEndWidth: theme.borderWidth.thin,
          },
          index === 0 ? [styles.first, { borderTopWidth: theme.borderWidth.thin }] : null,
          index === count - 1 ? [styles.last, { borderBottomWidth: theme.borderWidth.thin }] : null,
        ]}
      >
        {index > 0 ? <View style={[styles.divider, { backgroundColor: c.border, height: theme.borderWidth.hairline }]} /> : null}
        <TicketRow ticket={item} onPress={onOpen} />
      </View>
    ),
    [c, theme.borderWidth, count, onOpen],
  );

  const header = (
    <Header
      tone="background"
      title={t('support.requestsTitle')}
      backLabel={t('support.back')}
      onBack={() => navigation.goBack()}
      actions={[{ icon: 'add', onPress: newRequest, accessibilityLabel: t('support.newRequest'), testID: 'support-requests-add' }]}
      testID="support-requests-header"
    />
  );

  let body: React.ReactNode = null;
  if (count === 0 && list.status === 'loading') {
    body = (
      <SkeletonGroup testID="support-requests-loading" style={styles.padded}>
        <Skeleton shape="block" height={componentTokens.listItem.minHeight.two * 3} />
      </SkeletonGroup>
    );
  } else if (count === 0 && list.status === 'failed') {
    body = (
      <ErrorState
        title={t('support.requestsFailed')}
        body={list.error ?? undefined}
        retryLabel={t('support.tryAgain')}
        onRetry={list.reload}
        testID="support-requests-error"
      />
    );
  } else if (count === 0 && list.status === 'ready') {
    body = (
      <EmptyState
        icon="chat"
        title={t('support.emptyTitle')}
        body={t('support.emptyBody')}
        action={{ label: t('support.newRequest'), onPress: newRequest, testID: 'support-requests-empty-new' }}
        testID="support-requests-empty"
      />
    );
  }

  const footer = () => {
    if (list.status === 'loadingMore') {
      return (
        <View style={styles.footer}>
          <ActivityIndicator color={c.textMuted} accessibilityLabel={t('support.loadingMore')} />
        </View>
      );
    }
    if (list.loadMoreError) {
      return (
        <View style={styles.footer}>
          <AppText variant="caption" color="danger">
            {t('support.loadMoreFailed')}
          </AppText>
          <Button label={t('support.tryAgain')} variant="ghost" size="sm" fullWidth={false} onPress={list.loadMore} />
        </View>
      );
    }
    if (!list.hasMore && count > 0) {
      return (
        <AppText variant="caption" color="textMuted" align="center" style={styles.end} testID="support-requests-end">
          {t('support.endOfList')}
        </AppText>
      );
    }
    return null;
  };

  return (
    <Screen testID="support-requests-screen">
      {header}
      {body ?? (
        <FlatList
          data={list.items}
          keyExtractor={keyOf}
          renderItem={renderItem}
          onEndReached={list.hasMore && !list.loadMoreError ? list.loadMore : undefined}
          onEndReachedThreshold={0.5}
          ListFooterComponent={footer}
          contentContainerStyle={[styles.padded, { paddingBottom: Math.max(insets.bottom + space[2], space[8]) }]}
          refreshControl={
            <RefreshControl
              refreshing={list.status === 'refreshing'}
              onRefresh={list.refresh}
              tintColor={c.primary}
              colors={[c.primary]}
            />
          }
          testID="support-requests-list"
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  padded: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingHorizontal: layout.gutter, paddingTop: space[2] },
  cell: { overflow: 'hidden' },
  first: { borderTopStartRadius: radius.lg, borderTopEndRadius: radius.lg },
  last: { borderBottomStartRadius: radius.lg, borderBottomEndRadius: radius.lg },
  divider: { marginStart: componentTokens.listItem.dividerInset.tile },
  footer: { minHeight: componentTokens.support.footerRow, alignItems: 'center', justifyContent: 'center', gap: space[1] },
  end: { paddingVertical: space[4] },
});
