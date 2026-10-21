import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Avatar, Badge, type AvatarSize } from '../../../components/ui';
import { componentTokens, layout, radius, space, textStyles } from '../../../theme';
import { keepMoneyTogether } from '../../../utils/format';
import { CHAT_COPY, fallbackNameOf, formatChatListTime } from '../copy';
import type { ChatSummary } from '../types';

/** Avatar size of a conversation row (§12.4). */
export const CHAT_AVATAR_SIZE: AvatarSize = componentTokens.chat.rowAvatar;
/** Divider inset to the row's text: padding 16 + Avatar 48 + 16 = 80 (§5.8, UI-R14 ruling). */
export const CHAT_DIVIDER_INSET = space[4] + CHAT_AVATAR_SIZE + space[4];

/** Where the row sits in its section's card (the card's corners follow the first and last row). */
export type ChatRowPosition = 'only' | 'first' | 'middle' | 'last';

/** Ride statuses whose chat counts as the current ride (the API maps arrived/started too). */
const CURRENT_STATUSES = ['accepted', 'arrived', 'started', 'ongoing'];

export const isCurrentChat = (chat: Pick<ChatSummary, 'rideStatus'>): boolean =>
  CURRENT_STATUSES.includes(chat.rideStatus);

/**
 * The one-line preview: "You: …" on your own last message; newlines folded so rows keep height.
 * UI-R19 review: "Rs 150" keeps its no-break space (joined after the fold, which would undo it).
 */
export const chatPreviewOf = (chat: ChatSummary): string => {
  const last = chat.lastMessage;
  if (!last) return CHAT_COPY.noMessagesYet;
  const text = keepMoneyTogether(last.body.replace(/\s+/g, ' ').trim());
  return last.isMine ? CHAT_COPY.youPrefix(text) : text;
};

type Props = {
  chat: ChatSummary;
  /** T-580: with the other person's first name, when known. */
  onPress: (rideId: number, name?: string) => void;
  position?: ChatRowPosition;
};

/**
 * One conversation (UI-R14, DESIGN_SYSTEM §12.4 chat row, shared-chat-list): Avatar 48 (initials
 * fallback), first name `title`, last message one line (`textPrimary` 600 while unread), and a
 * trailing column with the time over the unread count. A chat that can no longer send shows a
 * neutral "Ended" pill instead of a count, and its preview in `textMuted`.
 */
function ChatRowBase({ chat, onPress, position = 'only' }: Props) {
  const { theme } = useAppTheme();
  const name = chat.otherParty?.firstName ?? fallbackNameOf(chat.otherParty?.role);
  const unread = chat.unreadCount > 0;
  const ended = !chat.canSend;
  const preview = chatPreviewOf(chat);
  const time = formatChatListTime(chat.lastMessage?.createdAt);
  const label = [
    name,
    preview,
    time,
    unread ? CHAT_COPY.unreadA11y(chat.unreadCount) : null,
    ended ? CHAT_COPY.endedA11y : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={() => onPress(chat.rideId, chat.otherParty?.firstName ?? undefined)}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={`chat-row-${chat.rideId}`}
      style={({ pressed }) => [
        styles.row,
        cornerStyle[position],
        { backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.surface },
      ]}
    >
      <Avatar name={name} uri={chat.otherParty?.profileImageUrl ?? null} size={CHAT_AVATAR_SIZE} />
      <View style={styles.text}>
        <AppText variant="title" numberOfLines={1}>
          {name}
        </AppText>
        <AppText
          variant="bodySmall"
          style={unread ? styles.unreadPreview : undefined}
          color={unread ? 'textPrimary' : ended ? 'textMuted' : 'textSecondary'}
          numberOfLines={1}
        >
          {preview}
        </AppText>
      </View>
      <View style={styles.trailing}>
        {time ? (
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {time}
          </AppText>
        ) : null}
        {unread ? (
          <Badge
            variant="count"
            count={chat.unreadCount}
            accessibilityLabel={CHAT_COPY.unreadA11y(chat.unreadCount)}
            testID={`chat-unread-${chat.rideId}`}
          />
        ) : ended ? (
          <Badge label={CHAT_COPY.ended} tone="neutral" testID={`chat-ended-${chat.rideId}`} />
        ) : null}
      </View>
    </Pressable>
  );
}

export const ChatRow = memo(ChatRowBase);

const cornerStyle = StyleSheet.create({
  only: { borderRadius: radius.lg },
  first: { borderTopStartRadius: radius.lg, borderTopEndRadius: radius.lg },
  middle: {},
  last: { borderBottomStartRadius: radius.lg, borderBottomEndRadius: radius.lg },
});

const styles = StyleSheet.create({
  // ListItem §5.8: padding 16, Avatar 48 → 16 → text (x = 80 inside the card).
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    marginHorizontal: layout.gutter,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    minHeight: componentTokens.listItem.minHeight.two,
  },
  text: { flex: 1, minWidth: 0, gap: space[1] },
  unreadPreview: { fontWeight: textStyles.bodyStrong.fontWeight },
  trailing: { alignItems: 'flex-end', gap: space[1], flexShrink: 0 },
});
