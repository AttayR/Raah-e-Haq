import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useDispatch, useStore } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Button, FilterChips, ScrollHairline, useHeaderScroll } from '../../../components/ui';
import { componentTokens, layout, space } from '../../../theme';
import { NotificationRow, rowPosition } from './NotificationRow';
import { NotificationsState } from './NotificationsStates';
import { PushPermissionBanner } from './PushPermissionBanner';
import { NOTIFICATIONS_COPY } from '../copy';
import { groupNotificationsByDay, type NotificationSection } from '../format';
import type { NotificationsList as NotificationsListState } from '../hooks';
import { confirmPassengerLiveRide } from '../liveRideTarget';
import { openNotificationTarget } from '../navigation';
import { resolveNotificationTarget, type NotificationRole } from '../routing';
import type { AppNotification, NotificationFilter } from '../types';
import { perLocale } from '../../../i18n';
import { TabScrollToTop } from '../../../hooks/TabScrollToTop';

export type NotificationsListProps = {
  role: NotificationRole;
  /** `useNotificationsList(...)`, owned by the host so its header can offer "Mark all read". */
  list: NotificationsListState;
};

const FILTERS = perLocale((): ReadonlyArray<{ value: NotificationFilter; label: string }> => [
  { value: 'all', label: NOTIFICATIONS_COPY.filterAll },
  { value: 'unread', label: NOTIFICATIONS_COPY.filterUnread },
]);

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList<AppNotification, NotificationSection>);

/**
 * Inbox › Notifications for both roles (T-502, BE-11; UI-R4 moved it into the Inbox tab; UI-R14
 * content): GET /notifications with pull-to-refresh, infinite scroll, All / Unread chips and mark
 * read on open (long press marks read without opening). Rows are grouped by day ("Today",
 * "Yesterday", "Mon, 28 Sep"), each day one card; skeleton, error and empty states come from
 * `NotificationsState`. Opening a row goes to its ride, chat or history (routing.ts). UI-R15b:
 * the chips stay pinned above the list with a hairline once it scrolls.
 */
export function NotificationsList({ role, list }: NotificationsListProps) {
  const { theme } = useAppTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { state, hasMore, refresh, loadMore, reload, setFilter, markRead } = list;
  const { items, status, error, loadMoreError, filter } = state;
  const sections = useMemo(() => groupNotificationsByDay(items), [items]);
  const { scrollY, onScroll } = useHeaderScroll();
  // T-577: re-tapping the selected tab scrolls this list to the top.
  const listRef = useRef<SectionList<AppNotification, NotificationSection>>(null);

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

  const store = useStore<RootState>();
  const dispatch = useDispatch<AppDispatch>();
  // T-581: one ride check at a time (a double tap opens one screen).
  const checkingRide = useRef(false);
  const onOpen = useCallback(
    (item: AppNotification) => {
      if (item.readAt === null) markRead(item.id);
      const target = resolveNotificationTarget(
        { category: item.category, type: item.type, rideId: item.data.rideId, requeued: item.data.requeued, noDriver: item.data.noDriver },
        role,
      );
      if (role !== 'passenger' || target.kind !== 'ride') {
        openNotificationTarget(navigation, role, target, 'list');
        return;
      }
      // T-581: a passenger's ride row opens Booking only while that ride is still live.
      if (checkingRide.current) return;
      checkingRide.current = true;
      confirmPassengerLiveRide(target, { getState: store.getState, dispatch, subscribe: store.subscribe })
        .then((confirmed) => openNotificationTarget(navigation, role, confirmed, 'list'))
        .finally(() => {
          checkingRide.current = false;
        });
    },
    [markRead, navigation, role, store, dispatch],
  );

  const onMarkRead = useCallback((item: AppNotification) => markRead(item.id), [markRead]);

  const renderItem = useCallback(
    ({ item, index, section }: { item: AppNotification; index: number; section: NotificationSection }) => (
      <NotificationRow
        item={item}
        onPress={onOpen}
        onMarkRead={onMarkRead}
        position={rowPosition(index, section.data.length)}
      />
    ),
    [onOpen, onMarkRead],
  );

  const background = theme.colors.background;
  const renderSectionHeader = useCallback(
    ({ section }: { section: NotificationSection }) =>
      section.title ? (
        <View style={[styles.dayHeader, { backgroundColor: background }]} testID={`notifications-day-${section.key}`}>
          <AppText variant="caption" color="textMuted" accessibilityRole="header">
            {section.title}
          </AppText>
        </View>
      ) : null,
    [background],
  );

  const separatorColor = theme.colors.border;
  const surface = theme.colors.surface;
  const separator = useCallback(
    () => (
      <View style={[styles.separatorTrack, { backgroundColor: surface }]}>
        <View style={[styles.separator, { backgroundColor: separatorColor }]} />
      </View>
    ),
    [separatorColor, surface],
  );

  const firstLoad = status === 'idle' || (status === 'loading' && items.length === 0);

  const renderEmpty = () => (
    <NotificationsState
      kind={firstLoad ? 'loading' : status === 'failed' ? 'error' : 'empty'}
      role={role}
      filter={filter}
      error={error}
      onRetry={reload}
    />
  );

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
          <Button label={NOTIFICATIONS_COPY.retry} variant="ghost" size="sm" fullWidth={false} onPress={loadMore} />
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
      <TabScrollToTop scrollRef={listRef} />
      <AnimatedSectionList
        ref={listRef}
        testID="notifications-list"
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        ItemSeparatorComponent={separator}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={[styles.listContent, items.length === 0 && styles.listEmpty]}
        style={styles.list}
        onScroll={onScroll}
        scrollEventThrottle={16}
        initialNumToRender={10}
        windowSize={7}
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
  listContent: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingBottom: space[8] },
  listEmpty: { flexGrow: 1 },
  // Day header: caption, 32 high, on the page colour so it reads over rows when sticky.
  dayHeader: { minHeight: space[8], justifyContent: 'center', paddingHorizontal: layout.gutter + space[4] },
  // Divider inside the day card, inset to the text column (72, §5.8).
  separatorTrack: { marginHorizontal: layout.gutter },
  separator: { height: StyleSheet.hairlineWidth, marginStart: componentTokens.listItem.dividerInset.tile },
  footer: { paddingVertical: space[4], alignItems: 'center', gap: space[2] },
});
