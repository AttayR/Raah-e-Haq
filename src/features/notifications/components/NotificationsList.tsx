import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Button, FilterChips, Icon, ScrollHairline, useHeaderScroll } from '../../../components/ui';
import { componentTokens, layout, space } from '../../../theme';
import { NotificationRow } from './NotificationRow';
import { PushPermissionBanner } from './PushPermissionBanner';
import { NOTIFICATIONS_COPY } from '../copy';
import type { NotificationsList as NotificationsListState } from '../hooks';
import { openNotificationTarget } from '../navigation';
import { resolveNotificationTarget, type NotificationRole } from '../routing';
import type { AppNotification, NotificationFilter } from '../types';
import { perLocale } from '../../../i18n';

export type NotificationsListProps = {
  role: NotificationRole;
  /** `useNotificationsList(...)`, owned by the host so its header can offer "Mark all read". */
  list: NotificationsListState;
};

const FILTERS = perLocale((): ReadonlyArray<{ value: NotificationFilter; label: string }> => [
  { value: 'all', label: NOTIFICATIONS_COPY.filterAll },
  { value: 'unread', label: NOTIFICATIONS_COPY.filterUnread },
]);

/**
 * Inbox › Notifications for both roles (T-502, BE-11; UI-R4 moved it into the Inbox tab): GET
 * /notifications with pull-to-refresh, infinite scroll, loading / error / empty states, All /
 * Unread chips and mark read on open. Opening a row goes to its ride, chat or history
 * (routing.ts). Content styling is UI-R14. UI-R15b: the chips stay pinned above the list (under
 * the Inbox segments) with a hairline once it scrolls, like Activity › Rides.
 */
export function NotificationsList({ role, list }: NotificationsListProps) {
  const { theme } = useAppTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { state, hasMore, refresh, loadMore, reload, setFilter, markRead } = list;
  const { items, status, error, loadMoreError, filter } = state;
  const { scrollY, onScroll } = useHeaderScroll();

  // A fresh filter starts at the top: the hairline follows it.
  useEffect(() => {
    scrollY.value = 0;
  }, [filter, scrollY]);

  // The spinner shows for a pull only: the quiet reload on focus (T-513) toggling `refreshing`
  // left iOS's content inset behind and pushed the large title down (UI-R4 QA).
  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    if (pulling && status !== 'refreshing') setPulling(false);
  }, [pulling, status]);
  const onPull = useCallback(() => {
    setPulling(true);
    refresh();
  }, [refresh]);

  const onOpen = useCallback(
    (item: AppNotification) => {
      if (item.readAt === null) markRead(item.id);
      const target = resolveNotificationTarget(
        { category: item.category, type: item.type, rideId: item.data.rideId, requeued: item.data.requeued },
        role,
      );
      openNotificationTarget(navigation, role, target, 'list');
    },
    [markRead, navigation, role],
  );

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => <NotificationRow item={item} onPress={onOpen} />,
    [onOpen],
  );

  const separator = useCallback(
    () => <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />,
    [theme.colors.border],
  );

  const firstLoad = status === 'idle' || (status === 'loading' && items.length === 0);

  const renderEmpty = () => {
    if (firstLoad) {
      return (
        <View style={styles.centered} testID="notifications-loading">
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      );
    }
    if (status === 'failed') {
      return (
        <View style={styles.centered} testID="notifications-error">
          <Icon name="warning" size={32} color="danger" />
          <AppText variant="body" align="center">
            {error ?? NOTIFICATIONS_COPY.loadFailed}
          </AppText>
          <Button
            label={NOTIFICATIONS_COPY.retry}
            variant="outline"
            size="md"
            onPress={reload}
            testID="notifications-retry"
          />
        </View>
      );
    }
    const unreadOnly = filter === 'unread';
    return (
      <View style={styles.centered} testID="notifications-empty">
        <Icon name="bell" size={48} color="textMuted" />
        <AppText variant="title" align="center">
          {unreadOnly ? NOTIFICATIONS_COPY.emptyUnreadTitle : NOTIFICATIONS_COPY.emptyTitle}
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" align="center">
          {unreadOnly ? NOTIFICATIONS_COPY.emptyUnreadBody : NOTIFICATIONS_COPY.emptyBody}
        </AppText>
      </View>
    );
  };

  const renderFooter = () => {
    if (status === 'loadingMore') {
      return (
        <View style={styles.footer} testID="notifications-loading-more">
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      );
    }
    if (loadMoreError) {
      return (
        <View style={styles.footer} testID="notifications-load-more-error">
          <AppText variant="bodySmall" color="textSecondary" align="center">
            {loadMoreError}
          </AppText>
          <Button label={NOTIFICATIONS_COPY.retry} variant="ghost" size="sm" onPress={loadMore} />
        </View>
      );
    }
    return null;
  };

  const listHeader = (
    <View style={styles.listHeader}>
      <PushPermissionBanner style={styles.headerItem} />
      {error && items.length > 0 ? (
        <AppText variant="bodySmall" color="danger" style={styles.headerItem} testID="notifications-refresh-error">
          {error}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <View style={styles.list}>
      <View style={styles.pinned}>
        <FilterChips<NotificationFilter>
          options={FILTERS()}
          value={filter}
          onChange={setFilter}
          accessibilityLabel={NOTIFICATIONS_COPY.filterLabel}
          testID="notifications-filter"
        />
      </View>
      <ScrollHairline scrollY={scrollY} testID="notifications-hairline" />
      <Animated.FlatList
        testID="notifications-list"
        data={items}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        ItemSeparatorComponent={separator}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={[styles.listContent, items.length === 0 && styles.listEmpty]}
        style={styles.list}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onEndReached={hasMore && !loadMoreError ? loadMore : undefined}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={onPull}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Chips pinned under the Inbox segments: 4 top / 12 bottom (§5.2 revised UI-R15).
  pinned: { paddingHorizontal: layout.gutter, paddingTop: space[1], paddingBottom: space[3] },
  // Banner and refresh error scroll with the rows; each keeps 12 below it, nothing when absent.
  listHeader: { paddingHorizontal: layout.gutter },
  headerItem: { marginBottom: space[3] },
  list: { flex: 1 },
  listContent: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingBottom: space[6] },
  listEmpty: { flexGrow: 1 },
  // Inset to the text column: gutter + 40 icon tile + 12 (§12.4).
  separator: {
    height: StyleSheet.hairlineWidth,
    marginStart: layout.gutter + componentTokens.iconButton.visual + space[3],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    paddingHorizontal: space[6],
    paddingVertical: space[8],
  },
  footer: { paddingVertical: space[4], alignItems: 'center', gap: space[2] },
});
