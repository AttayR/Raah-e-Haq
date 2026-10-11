import React, { useCallback } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View, type ListRenderItem } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Avatar, Badge, Button, Icon, ListItem, Screen } from '../../../components/ui';
import { layout, space } from '../../../theme';
import { CHAT_COPY, fallbackNameOf, formatChatTime } from '../copy';
import { useChatList } from '../hooks';
import { openRideChat, type RideChatNavigator } from '../navigation';
import type { ChatSummary } from '../types';

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

/**
 * The Chat tab for both roles (T-510): the caller's ride chats from GET /chats, newest first.
 * Loaded on every visit and on pull-to-refresh; tapping a row opens the ride's thread.
 */
const ChatListScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const navigation = useNavigation<RideChatNavigator>();
  const isFocused = useIsFocused();
  const { chats, status, errorMessage, refreshing, refresh } = useChatList(isFocused);

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
          accessibilityLabel={`${name}, ${previewOf(item)}${unread ? `, ${CHAT_COPY.unreadA11y(item.unreadCount)}` : ''}`}
          testID={`chat-row-${item.rideId}`}
        />
      );
    },
    [navigation],
  );

  const title = (
    <AppText variant="h1" accessibilityRole="header" style={styles.title}>
      {CHAT_COPY.listTitle}
    </AppText>
  );

  if (status === 'loading') {
    return (
      <Screen testID="chat-list-screen">
        {title}
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} testID="chat-list-loading" />
        </View>
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen testID="chat-list-screen">
        {title}
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
          <Button label={CHAT_COPY.retry} onPress={refresh} leadingIcon="retry" fullWidth={false} testID="chat-list-retry" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen testID="chat-list-screen">
      {title}
      <FlatList
        data={chats}
        keyExtractor={(item) => String(item.rideId)}
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.primary} />}
        contentContainerStyle={[styles.listContent, chats.length === 0 ? styles.emptyContent : null]}
        ListEmptyComponent={
          <View style={styles.centered} testID="chat-list-empty">
            <Icon name="chat" size={48} color="textMuted" />
            <AppText variant="title" align="center">
              {CHAT_COPY.listEmptyTitle}
            </AppText>
            <AppText variant="body" color="textSecondary" align="center">
              {CHAT_COPY.listEmpty}
            </AppText>
          </View>
        }
        testID="chat-list"
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  title: { paddingHorizontal: layout.gutter, paddingTop: space[4], paddingBottom: space[2] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3], padding: layout.gutter },
  listContent: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingBottom: space[4] },
  emptyContent: { flexGrow: 1 },
  separator: { height: StyleSheet.hairlineWidth, marginStart: space[4] + 48 + space[4] },
});

export default ChatListScreen;
