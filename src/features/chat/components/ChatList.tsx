import React, { useCallback, useMemo, useRef } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, ScrollHairline, useHeaderScroll } from '../../../components/ui';
import { layout, space } from '../../../theme';
import { CHAT_COPY } from '../copy';
import { useChatList } from '../hooks';
import { openRideChat, type RideChatNavigator } from '../navigation';
import type { ChatRole, ChatSummary } from '../types';
import { TabScrollToTop } from '../../../hooks/TabScrollToTop';
import { CHAT_DIVIDER_INSET, ChatRow, isCurrentChat } from './ChatRow';
import { ChatListState } from './ChatListStates';

export interface ChatSection {
  key: 'current' | 'earlier';
  title: string;
  data: ChatSummary[];
}

/** UI-R14: the chat of a ride in progress under "Current ride", every other one under "Earlier". */
export const chatSections = (chats: ReadonlyArray<ChatSummary>): ChatSection[] => {
  const current = chats.filter(isCurrentChat);
  const earlier = chats.filter((chat) => !isCurrentChat(chat));
  const sections: ChatSection[] = [];
  if (current.length) sections.push({ key: 'current', title: CHAT_COPY.sectionCurrent, data: current });
  if (earlier.length) sections.push({ key: 'earlier', title: CHAT_COPY.sectionEarlier, data: earlier });
  return sections;
};

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList<ChatSummary, ChatSection>);

const positionOf = (index: number, count: number) => {
  if (count <= 1) return 'only' as const;
  if (index === 0) return 'first' as const;
  return index === count - 1 ? ('last' as const) : ('middle' as const);
};

export type ChatListProps = {
  /** True while the list is on screen (tab focused and the Messages segment chosen). */
  visible: boolean;
  /** The viewer's role: the empty state names the other side. */
  role?: ChatRole;
};

/**
 * Inbox › Messages for both roles (T-510; UI-R4 moved it into Inbox; UI-R14 content): the
 * caller's ride chats from GET /chats, newest first, split into "Current ride" and "Earlier"
 * cards. Loaded each time it becomes visible and on pull-to-refresh; tapping a row opens the
 * ride's thread. UI-R15b: it sits under the pinned Inbox segments and draws their hairline once
 * it scrolls.
 */
export function ChatList({ visible, role = 'passenger' }: ChatListProps) {
  const { theme } = useAppTheme();
  const { scrollY, onScroll } = useHeaderScroll();
  // T-577: re-tapping the selected tab scrolls this list to the top.
  const listRef = useRef<SectionList<ChatSummary, ChatSection>>(null);
  const navigation = useNavigation<RideChatNavigator>();
  const { chats, status, errorMessage, refreshing, refresh } = useChatList(visible);

  // Rows only once loaded: a failed first load keeps no stale list.
  const sections = useMemo(() => (status === 'ready' ? chatSections(chats) : []), [status, chats]);

  const onOpen = useCallback((rideId: number) => openRideChat(navigation, rideId), [navigation]);

  const renderItem = useCallback(
    ({ item, index, section }: { item: ChatSummary; index: number; section: ChatSection }) => (
      <ChatRow chat={item} onPress={onOpen} position={positionOf(index, section.data.length)} />
    ),
    [onOpen],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: ChatSection }) => (
      <View
        style={[styles.sectionHeader, section.key === 'earlier' && sections.length > 1 ? styles.laterSection : null]}
        testID={`chat-section-${section.key}`}
      >
        <AppText variant="overline" color="textMuted" accessibilityRole="header">
          {section.title}
        </AppText>
      </View>
    ),
    [sections.length],
  );

  const surface = theme.colors.surface;
  const border = theme.colors.border;
  const separator = useCallback(
    () => (
      <View style={[styles.separatorTrack, { backgroundColor: surface }]}>
        <View style={[styles.separator, { backgroundColor: border }]} />
      </View>
    ),
    [surface, border],
  );

  const renderEmpty = () => (
    <ChatListState
      kind={status === 'loading' ? 'loading' : status === 'error' ? 'error' : 'empty'}
      role={role}
      error={errorMessage}
      onRetry={refresh}
    />
  );

  return (
    <View style={styles.list}>
      <ScrollHairline scrollY={scrollY} testID="chat-list-hairline" />
      <TabScrollToTop scrollRef={listRef} />
      <AnimatedSectionList
        ref={listRef}
        sections={sections}
        keyExtractor={(item) => String(item.rideId)}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        ItemSeparatorComponent={separator}
        ListEmptyComponent={renderEmpty}
        onScroll={onScroll}
        scrollEventThrottle={16}
        initialNumToRender={10}
        windowSize={7}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.primary} />}
        contentContainerStyle={[styles.listContent, sections.length === 0 ? styles.emptyContent : null]}
        style={styles.list}
        testID="chat-list"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingBottom: space[8] },
  emptyContent: { flexGrow: 1 },
  // Grouped list header (§5.8): overline at x=16 from the gutter, 8 above the card; 24 between groups.
  sectionHeader: { paddingHorizontal: layout.gutter + space[4], paddingTop: space[3], paddingBottom: space[2] },
  laterSection: { paddingTop: space[6] },
  separatorTrack: { marginHorizontal: layout.gutter },
  // Inset to the text column (80).
  separator: { height: StyleSheet.hairlineWidth, marginStart: CHAT_DIVIDER_INSET },
});
