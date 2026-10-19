import React, { useCallback, useRef } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View, type ListRenderItem } from 'react-native';
import Animated from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Avatar, Badge, Button, Icon, ListItem, ScrollHairline, useHeaderScroll } from '../../../components/ui';
import { layout, space } from '../../../theme';
import { CHAT_COPY, fallbackNameOf, formatChatTime } from '../copy';
import { useChatList } from '../hooks';
import { openRideChat, type RideChatNavigator } from '../navigation';
import type { ChatSummary } from '../types';
import { TabScrollToTop } from '../../../hooks/TabScrollToTop';

const previewOf = (chat: ChatSummary): string => {
  const last = chat.lastMessage;
  if (!last) return CHAT_COPY.noMessagesYet;
  // One line: newlines in the body would make the row jump in height.
  const text = last.body.replace(/\s+/g, ' ');
  const time = formatChatTime(last.createdAt);
  return time ? `${text} · ${time}` : text;
};

const Separator: React.FC = () => {
  const { theme } = useAppTheme();
  return <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />;
};

export type ChatListProps = {
  /** True while the list is on screen (tab focused and the Messages segment chosen). */
  visible: boolean;
};

/**
 * Inbox › Messages for both roles (T-510; UI-R4 moved it from the Chat tab into Inbox): the
 * caller's ride chats from GET /chats, newest first. Loaded each time it becomes visible and on
 * pull-to-refresh; tapping a row opens the ride's thread. Content styling is UI-R14. UI-R15b: it
 * sits under the pinned Inbox segments and draws their hairline once it scrolls.
 */
export function ChatList({ visible }: ChatListProps) {
  const { theme } = useAppTheme();
  const { scrollY, onScroll } = useHeaderScroll();
  // T-577: re-tapping the selected tab scrolls this list to the top.
  const listRef = useRef<FlatList<ChatSummary>>(null);
  const navigation = useNavigation<RideChatNavigator>();
  const { chats, status, errorMessage, refreshing, refresh } = useChatList(visible);

  const renderItem: ListRenderItem<ChatSummary> = useCallback(
    ({ item }) => {
      const name = item.otherParty?.firstName ?? fallbackNameOf(item.otherParty?.role);
      const unread = item.unreadCount > 0;
      return (
        <ListItem
          title={name}
          subtitle={previewOf(item)}
          leading={<Avatar name={name} uri={item.otherParty?.profileImageUrl ?? null} size={48} />}
          trailing={
            unread ? (
              <Badge label={String(item.unreadCount)} tone="info" testID={`chat-unread-${item.rideId}`} />
            ) : item.readOnlyUntil ? (
              <Badge label={CHAT_COPY.readOnly} />
            ) : undefined
          }
          chevron={!unread && !item.readOnlyUntil}
          onPress={() => openRideChat(navigation, item.rideId)}
          accessibilityLabel={`${name}, ${previewOf(item)}${
            unread ? `, ${CHAT_COPY.unreadA11y(item.unreadCount)}` : ''
          }`}
          testID={`chat-row-${item.rideId}`}
        />
      );
    },
    [navigation],
  );

  const renderEmpty = () => {
    if (status === 'loading') {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} testID="chat-list-loading" />
        </View>
      );
    }
    if (status === 'error') {
      return (
        <View style={styles.centered} testID="chat-list-error">
          <Icon name="warning" size={48} color="textMuted" />
          <AppText variant="title" align="center">
            {CHAT_COPY.listError}
          </AppText>
          {errorMessage ? (
            <AppText variant="bodySmall" color="textSecondary" align="center">
              {errorMessage}
            </AppText>
          ) : null}
          <Button
            label={CHAT_COPY.retry}
            onPress={refresh}
            leadingIcon="retry"
            fullWidth={false}
            testID="chat-list-retry"
          />
        </View>
      );
    }
    return (
      <View style={styles.centered} testID="chat-list-empty">
        <Icon name="chat" size={48} color="textMuted" />
        <AppText variant="title" align="center">
          {CHAT_COPY.listEmptyTitle}
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          {CHAT_COPY.listEmpty}
        </AppText>
      </View>
    );
  };

  // Rows only once loaded: a failed first load keeps no stale list.
  const data = status === 'ready' ? chats : [];

  return (
    <View style={styles.list}>
      <ScrollHairline scrollY={scrollY} testID="chat-list-hairline" />
      <TabScrollToTop scrollRef={listRef} />
      <Animated.FlatList
        ref={listRef}
        data={data}
        keyExtractor={item => String(item.rideId)}
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={renderEmpty}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.primary} />}
        contentContainerStyle={[styles.listContent, data.length === 0 ? styles.emptyContent : null]}
        style={styles.list}
        testID="chat-list"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3], padding: layout.gutter },
  listContent: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingBottom: space[4] },
  emptyContent: { flexGrow: 1 },
  separator: { height: StyleSheet.hairlineWidth, marginStart: space[4] + 48 + space[4] },
});
