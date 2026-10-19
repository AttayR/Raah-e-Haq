import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsFocused, useRoute, type RouteProp } from '@react-navigation/native';
import { Header, Screen, SegmentedControl } from '../../components/ui';
import { perLocale, t } from '../../i18n';
import { layout, space } from '../../theme';
import { ChatList } from '../chat/components/ChatList';
import { NotificationsList } from '../notifications/components/NotificationsList';
import { useNotificationsList } from '../notifications/hooks';
import type { NotificationRole } from '../notifications/routing';

export type InboxSegment = 'notifications' | 'messages';

/** Tab params: a push or a notification row may open a given segment. */
export type InboxParams = { segment?: InboxSegment };

const SEGMENTS = perLocale((): ReadonlyArray<{ value: InboxSegment; label: string }> => [
  { value: 'notifications', label: t('inbox.notifications') },
  { value: 'messages', label: t('inbox.messages') },
]);

type InboxRoute = RouteProp<{ Inbox: InboxParams | undefined }, 'Inbox'>;

/**
 * Inbox tab for both roles (UI-R4 structure, UI-R15b layout, DESIGN_SYSTEM §5.2 revised UI-R15):
 * the "Inbox" title sits in the bar itself, at the same height as on every other tab root, the
 * Notifications | Messages segments stay pinned under it, and each list draws its own hairline
 * once it scrolls. "Mark all read" sits in the bar on Notifications only. Only the chosen list is
 * mounted, so a hidden one never fetches; the unread-count poll stays with the role stack (T-502),
 * the tab badge reads the store.
 */
export default function InboxScreen({ role }: { role: NotificationRole }) {
  const route = useRoute<InboxRoute>();
  const isFocused = useIsFocused();
  const requested = route.params?.segment;
  const [segment, setSegment] = useState<InboxSegment>(requested ?? 'notifications');

  // A navigation with a segment (push tap, notification route) selects it, even when it repeats.
  useEffect(() => {
    if (requested) setSegment(requested);
  }, [requested, route.params]);

  const list = useNotificationsList(isFocused && segment === 'notifications');
  const { unreadCount, markingAll } = list.state;

  return (
    <Screen testID={`inbox-screen-${role}`}>
      <Header
        variant="large"
        inlineTitle
        title={t('inbox.title')}
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
      <View style={styles.segments}>
        <SegmentedControl<InboxSegment>
          options={SEGMENTS()}
          value={segment}
          onChange={setSegment}
          accessibilityLabel={t('inbox.segmentLabel')}
          testID="inbox-segments"
        />
      </View>
      {segment === 'notifications' ? <NotificationsList role={role} list={list} /> : <ChatList visible={isFocused} role={role} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segments: { paddingHorizontal: layout.gutter, paddingBottom: space[3] },
});
