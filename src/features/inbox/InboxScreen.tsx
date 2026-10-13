import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsFocused, useRoute, type RouteProp } from '@react-navigation/native';
import { Header, HeaderLargeTitle, Screen, SegmentedControl, useHeaderScroll } from '../../components/ui';
import { t } from '../../i18n';
import { layout, space } from '../../theme';
import { ChatList } from '../chat/components/ChatList';
import { NotificationsList } from '../notifications/components/NotificationsList';
import { useNotificationsList } from '../notifications/hooks';
import type { NotificationRole } from '../notifications/routing';

export type InboxSegment = 'notifications' | 'messages';

/** Tab params: a push or a notification row may open a given segment. */
export type InboxParams = { segment?: InboxSegment };

const SEGMENTS: ReadonlyArray<{ value: InboxSegment; label: string }> = [
  { value: 'notifications', label: t('inbox.notifications') },
  { value: 'messages', label: t('inbox.messages') },
];

type InboxRoute = RouteProp<{ Inbox: InboxParams | undefined }, 'Inbox'>;

/**
 * Inbox tab for both roles (UI-R4, DESIGN_SYSTEM §8.1/§8.2): `large` Header "Inbox" that
 * collapses on scroll, SegmentedControl Notifications | Messages, "Mark all read" in the bar on
 * Notifications only. Only the chosen list is mounted, so a hidden one never fetches; the
 * unread-count poll stays with the role stack (T-502), the tab badge reads the store.
 */
export default function InboxScreen({ role }: { role: NotificationRole }) {
  const route = useRoute<InboxRoute>();
  const isFocused = useIsFocused();
  const requested = route.params?.segment;
  const [segment, setSegment] = useState<InboxSegment>(requested ?? 'notifications');
  const { scrollY, onScroll } = useHeaderScroll();

  // A navigation with a segment (push tap, notification route) selects it, even when it repeats.
  useEffect(() => {
    if (requested) setSegment(requested);
  }, [requested, route.params]);

  // A fresh list starts at the top: the bar title and hairline follow it.
  useEffect(() => {
    scrollY.value = 0;
  }, [segment, scrollY]);

  const list = useNotificationsList(isFocused && segment === 'notifications');
  const { unreadCount, markingAll } = list.state;
  const title = t('inbox.title');

  const header = (
    <View>
      <HeaderLargeTitle title={title} scrollY={scrollY} />
      <View style={styles.segments}>
        <SegmentedControl<InboxSegment>
          options={SEGMENTS}
          value={segment}
          onChange={setSegment}
          accessibilityLabel={t('inbox.segmentLabel')}
          testID="inbox-segments"
        />
      </View>
    </View>
  );

  return (
    <Screen testID={`inbox-screen-${role}`}>
      <Header
        variant="large"
        title={title}
        scrollY={scrollY}
        tone="background"
        trailingText={
          segment === 'notifications' && unreadCount > 0 && !markingAll
            ? {
                label: t('inbox.markAllRead'),
                onPress: () => {
                  list.markAllRead();
                },
                testID: 'notifications-mark-all',
              }
            : undefined
        }
        testID="inbox-header"
      />
      {segment === 'notifications' ? (
        <NotificationsList role={role} list={list} header={header} onScroll={onScroll} />
      ) : (
        <ChatList visible={isFocused} header={header} onScroll={onScroll} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segments: { paddingHorizontal: layout.gutter, paddingBottom: space[3] },
});
