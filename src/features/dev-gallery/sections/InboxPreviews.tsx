import React from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, FilterChips, Header, Screen, ScrollHairline, SegmentedControl } from '../../../components/ui';
import { perLocale, t } from '../../../i18n';
import { componentTokens, layout, space } from '../../../theme';
import { NotificationRow, rowPosition } from '../../notifications/components/NotificationRow';
import { NotificationsState, type NotificationsStateKind } from '../../notifications/components/NotificationsStates';
import { NOTIFICATIONS_COPY } from '../../notifications/copy';
import { groupNotificationsByDay } from '../../notifications/format';
import { CHAT_DIVIDER_INSET, ChatRow } from '../../chat/components/ChatRow';
import { chatSections } from '../../chat/components/ChatList';
import { ChatListState } from '../../chat/components/ChatListStates';
import { ChatThreadHeader } from '../../chat/components/ChatThreadHeader';
import { MessageBubble } from '../../chat/components/MessageBubble';
import { ChatComposer } from '../../chat/components/ChatComposer';
import { QuickReplies } from '../../chat/components/QuickReplies';
import { ChatClosedBar, ChatDayPill, ChatThreadSkeleton } from '../../chat/components/ChatThreadStates';
import { CHAT_COPY } from '../../chat/copy';
import { chatRowsNewestFirst } from '../../chat/rows';
import { threadItemsNewestFirst } from '../../chat/thread';
import { GALLERY_CHATS, GALLERY_MESSAGES, GALLERY_NOTIFICATIONS } from '../fixtures/inboxFixtures';

/**
 * Debug gallery (UI-R14): Inbox › Notifications, Inbox › Messages and the chat thread built from
 * the screens' own pieces (rows, day grouping, states, bubbles, composer) over fake local data,
 * for design screenshots of states live data cannot produce on demand. Shown with
 * `-RHKitGallerySection screen-inbox-…|screen-chat-…`.
 */
const noop = () => undefined;
const SEGMENTS = perLocale(() => [
  { value: 'notifications' as const, label: t('inbox.notifications') },
  { value: 'messages' as const, label: t('inbox.messages') },
]);
const FILTERS = perLocale(() => [
  { value: 'all' as const, label: NOTIFICATIONS_COPY.filterAll },
  { value: 'unread' as const, label: NOTIFICATIONS_COPY.filterUnread },
]);

function InboxFrame({
  segment,
  unread = false,
  children,
}: React.PropsWithChildren<{ segment: 'notifications' | 'messages'; unread?: boolean }>) {
  return (
    <Screen testID={`preview-inbox-${segment}`}>
      <Header
        variant="large"
        inlineTitle
        title={t('inbox.title')}
        tone="background"
        // Like the live screen: only on Notifications, and only while something is unread.
        trailingText={segment === 'notifications' && unread ? { label: t('inbox.markAllRead'), onPress: noop } : undefined}
      />
      <View style={styles.segments}>
        <SegmentedControl options={SEGMENTS()} value={segment} onChange={noop} accessibilityLabel={t('inbox.segmentLabel')} />
      </View>
      {segment === 'notifications' ? (
        <View style={styles.chips}>
          <FilterChips options={FILTERS()} value="all" onChange={noop} accessibilityLabel={NOTIFICATIONS_COPY.filterLabel} />
        </View>
      ) : null}
      <ScrollHairline />
      <ScrollView contentContainerStyle={styles.scroll}>{children}</ScrollView>
    </Screen>
  );
}

function Divider({ inset }: { inset: number }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.track, { backgroundColor: theme.colors.surface }]}>
      <View style={[styles.divider, { marginStart: inset, backgroundColor: theme.colors.border }]} />
    </View>
  );
}

export function InboxNotificationsPreview() {
  const sections = groupNotificationsByDay(GALLERY_NOTIFICATIONS);
  return (
    <InboxFrame segment="notifications" unread={GALLERY_NOTIFICATIONS.some((n) => n.readAt === null)}>
      {sections.map((section) => (
        <View key={section.key}>
          <View style={styles.dayHeader}>
            <AppText variant="caption" color="textMuted">
              {section.title}
            </AppText>
          </View>
          {section.data.map((item, index) => (
            <View key={item.id}>
              {index > 0 ? <Divider inset={componentTokens.listItem.dividerInset.tile} /> : null}
              <NotificationRow item={item} onPress={noop} onMarkRead={noop} position={rowPosition(index, section.data.length)} />
            </View>
          ))}
        </View>
      ))}
    </InboxFrame>
  );
}

export function InboxNotificationsStatePreview({ kind, role }: { kind: NotificationsStateKind; role: 'passenger' | 'driver' }) {
  return (
    <InboxFrame segment="notifications">
      <NotificationsState kind={kind} role={role} filter="all" error={kind === 'error' ? t('kitGallery.errorNetworkBody') : null} onRetry={noop} />
    </InboxFrame>
  );
}

export function InboxMessagesPreview() {
  return (
    <InboxFrame segment="messages">
      {chatSections(GALLERY_CHATS).map((section, s) => (
        <View key={section.key}>
          <View style={[styles.overline, s > 0 ? styles.laterOverline : null]}>
            <AppText variant="overline" color="textMuted">
              {section.title}
            </AppText>
          </View>
          {section.data.map((chat, index) => (
            <View key={chat.rideId}>
              {index > 0 ? <Divider inset={CHAT_DIVIDER_INSET} /> : null}
              <ChatRow chat={chat} onPress={noop} position={rowPosition(index, section.data.length)} />
            </View>
          ))}
        </View>
      ))}
    </InboxFrame>
  );
}

export function InboxMessagesStatePreview({ kind, role }: { kind: 'loading' | 'error' | 'empty'; role: 'passenger' | 'driver' }) {
  return (
    <InboxFrame segment="messages">
      <ChatListState kind={kind} role={role} error={kind === 'error' ? t('kitGallery.errorNetworkBody') : null} onRetry={noop} />
    </InboxFrame>
  );
}

export function ChatThreadPreview({ state }: { state: 'open' | 'closed' | 'loading' }) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const rows = chatRowsNewestFirst(threadItemsNewestFirst({ messages: GALLERY_MESSAGES, pending: [] }));
  return (
    <Screen testID={`preview-chat-thread-${state}`} edges={[]}>
      <ChatThreadHeader
        name="Bilal"
        subtitle="Suzuki Alto · LEC-1234"
        photoUrl={null}
        onBack={noop}
        onCall={state === 'open' ? noop : undefined}
      />
      {state === 'loading' ? (
        <ChatThreadSkeleton />
      ) : (
        // Inverted like the real thread, so the newest messages are in view.
        <FlatList
          inverted
          data={rows}
          keyExtractor={(row) => row.key}
          style={[styles.fill, { backgroundColor: theme.colors.background }]}
          contentContainerStyle={styles.thread}
          renderItem={({ item: row }) =>
            row.kind === 'day' ? (
              <ChatDayPill label={row.label} />
            ) : (
              <MessageBubble
                item={row.item}
                seen={row.item.kind === 'message' && row.item.message.id === 5}
                read={row.item.kind === 'message' && row.item.message.isMine}
                firstInRun={row.firstInRun}
                lastInRun={row.lastInRun}
                onRetry={noop}
                viewerId={9}
              />
            )
          }
        />
      )}
      {state === 'open' ? (
        <>
          <QuickReplies role="passenger" onSend={() => false} />
          <ChatComposer onSend={() => false} bottomInset={insets.bottom} placeholder={CHAT_COPY.composerPlaceholderTo('Bilal')} />
        </>
      ) : state === 'closed' ? (
        <ChatClosedBar text={CHAT_COPY.closedNotice} bottomInset={insets.bottom} />
      ) : (
        <ChatComposer onSend={() => false} bottomInset={insets.bottom} disabled />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingBottom: space[8] },
  thread: { paddingVertical: space[3] },
  segments: { paddingHorizontal: layout.gutter, paddingBottom: space[3] },
  chips: { paddingHorizontal: layout.gutter, paddingTop: space[1], paddingBottom: space[3] },
  dayHeader: { minHeight: space[8], justifyContent: 'center', paddingHorizontal: layout.gutter + space[4] },
  overline: { paddingHorizontal: layout.gutter + space[4], paddingTop: space[3], paddingBottom: space[2] },
  laterOverline: { paddingTop: space[6] },
  track: { marginHorizontal: layout.gutter },
  divider: { height: StyleSheet.hairlineWidth },
});
