import React, { useCallback } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useIsFocused, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Button, Icon, IconButton, Screen, SegmentedControl } from '../../../components/ui';
import { layout, space } from '../../../theme';
import { NotificationRow } from '../components/NotificationRow';
import { PushPermissionBanner } from '../components/PushPermissionBanner';
import { NOTIFICATIONS_COPY } from '../copy';
import { useNotificationsList } from '../hooks';
import { openNotificationTarget } from '../navigation';
import { resolveNotificationTarget, type NotificationRole } from '../routing';
import type { AppNotification, NotificationFilter } from '../types';

export type NotificationsScreenProps = {
  role: NotificationRole;
  /** Shows a back button (the passenger's stack route; the tabs have none). */
  showBack?: boolean;
};

const FILTERS = [
  { value: 'all', label: NOTIFICATIONS_COPY.filterAll },
  { value: 'unread', label: NOTIFICATIONS_COPY.filterUnread },
] as const;

/**
 * Notifications list for both roles (T-502, BE-11): GET /notifications with pull-to-refresh,
 * infinite scroll, loading / error / empty states, All/Unread, mark read on open and
 * mark all read. Opening a row goes to its ride, chat or history (routing.ts).
 */
export function NotificationsScreen({ role, showBack = false }: NotificationsScreenProps) {
  const { theme } = useAppTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const isFocused = useIsFocused();
  const { state, hasMore, refresh, loadMore, reload, setFilter, markRead, markAllRead } =
    useNotificationsList(isFocused);
  const { items, status, error, loadMoreError, filter, unreadCount, markingAll } = state;

  const onOpen = useCallback(
    (item: AppNotification) => {
      if (item.readAt === null) markRead(item.id);
      const target = resolveNotificationTarget(
        { category: item.category, type: item.type, rideId: item.data.rideId },
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
          <Button label={NOTIFICATIONS_COPY.retry} variant="outline" size="md" onPress={reload} testID="notifications-retry" />
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

  return (
    <Screen testID={`notifications-screen-${role}`}>
      <View style={styles.column}>
        <View style={styles.header}>
          {showBack ? (
            <IconButton
              icon="back"
              accessibilityLabel={NOTIFICATIONS_COPY.back}
              onPress={() => navigation.goBack()}
              testID="notifications-back"
            />
          ) : null}
          <AppText variant="h1" accessibilityRole="header" style={styles.title} numberOfLines={1}>
            {NOTIFICATIONS_COPY.title}
          </AppText>
          <Button
            label={NOTIFICATIONS_COPY.markAllRead}
            variant="ghost"
            size="sm"
            onPress={() => {
              markAllRead();
            }}
            disabled={unreadCount === 0 || markingAll}
            loading={markingAll}
            testID="notifications-mark-all"
          />
        </View>
        <View style={styles.controls}>
          <SegmentedControl<NotificationFilter>
            options={FILTERS}
            value={filter}
            onChange={setFilter}
            accessibilityLabel={NOTIFICATIONS_COPY.filterLabel}
            testID="notifications-filter"
          />
          <PushPermissionBanner />
          {error && items.length > 0 ? (
            <AppText variant="bodySmall" color="danger" testID="notifications-refresh-error">
              {error}
            </AppText>
          ) : null}
        </View>
      </View>
      <FlatList
        testID="notifications-list"
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ItemSeparatorComponent={separator}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={[styles.listContent, items.length === 0 && styles.listEmpty]}
        style={styles.list}
        onEndReached={hasMore && !loadMoreError ? loadMore : undefined}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={status === 'refreshing'}
            onRefresh={refresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingTop: space[2],
  },
  title: { flex: 1, minWidth: 0 },
  controls: { paddingHorizontal: space[4], paddingVertical: space[3], gap: space[3] },
  list: { flex: 1 },
  listContent: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingBottom: space[6] },
  listEmpty: { flexGrow: 1 },
  separator: { height: StyleSheet.hairlineWidth, marginStart: space[4] + 40 + space[3] },
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
