import React, { useCallback, useMemo } from 'react';
import { FlatList, Platform, RefreshControl, StyleSheet, View, type ListRenderItem } from 'react-native';
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import type { RootState } from '../../../store';
import { Banner, Button, EmptyState, ErrorState, Header, Screen } from '../../../components/ui';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import { useKeyboardVisible } from '../../../hooks/useKeyboardVisible';
import { ChatComposer } from '../../chat/components/ChatComposer';
import { ChatClosedBar, ChatDayPill, ChatThreadSkeleton } from '../../chat/components/ChatThreadStates';
import { MessageBubble } from '../../chat/components/MessageBubble';
import { chatRowsNewestFirst, type ThreadRow } from '../../chat/rows';
import { threadItemsNewestFirst } from '../../chat/thread';
import { MESSAGE_MAX } from '../api';
import { ResolvedBanner, SupportSender, TicketSummaryCard } from '../components/TicketParts';
import { ticketTopicLabel } from '../format';
import { useSupportCategories } from '../hooks';
import type { SupportNavigator, SupportRoutes } from '../navigation';
import { ticketMessages } from '../thread';
import { useTicketThread } from '../useTicketThread';

const sender = <SupportSender />;

/**
 * One request as a conversation, both roles (shared-support-invite §H5, on the ride chat's
 * bubbles, day pills, composer and closed bar). The summary card sits at the top of the list;
 * the description is the first bubble; support replies carry the brand badge and never an
 * agent's details. Solved: an info Banner above the composer (a reply reopens it). Closed: the
 * closed bar with "New request". Read on open, on focus, on pull and on a support push; never
 * polled.
 */
export default function SupportTicketScreen() {
  const navigation = useNavigation<SupportNavigator>();
  const { params } = useRoute<RouteProp<SupportRoutes, 'SupportTicket'>>();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const viewerRole = useSelector((s: RootState) => (s.apiAuth.user?.role === 'driver' ? 'driver' : 'passenger'));
  const thread = useTicketThread(params.id, useIsFocused());
  const categories = useSupportCategories();

  const ticket = thread.data?.kind === 'ticket' ? thread.data.ticket : null;
  const messages = useMemo(() => (ticket ? ticketMessages(ticket, viewerRole) : []), [ticket, viewerRole]);
  const rows = useMemo(
    () => chatRowsNewestFirst(threadItemsNewestFirst({ messages, pending: thread.pending })),
    [messages, thread.pending],
  );

  const renderItem: ListRenderItem<ThreadRow> = useCallback(
    ({ item: row }) =>
      row.kind === 'day' ? (
        <ChatDayPill label={row.label} />
      ) : (
        <MessageBubble
          item={row.item}
          seen={false}
          firstInRun={row.firstInRun}
          lastInRun={row.lastInRun}
          onRetry={thread.retry}
          sender={sender}
        />
      ),
    [thread.retry],
  );

  const goBack = () => navigation.goBack();
  const header = (
    <Header
      tone="background"
      title={ticket?.subject ?? t('support.requestsTitle')}
      backLabel={t('support.back')}
      onBack={goBack}
      testID="support-ticket-header"
    />
  );

  if (!ticket) {
    let body: React.ReactNode;
    if (thread.data?.kind === 'gone') {
      body = <EmptyState icon="chat" title={t('support.ticketGone')} testID="support-ticket-gone" />;
    } else if (thread.status === 'failed') {
      body = (
        <ErrorState
          title={t('support.ticketFailed')}
          body={thread.error ?? undefined}
          retryLabel={t('support.tryAgain')}
          onRetry={thread.reload}
          testID="support-ticket-error"
        />
      );
    } else {
      body = <ChatThreadSkeleton />;
    }
    return (
      <Screen testID="support-ticket-screen">
        {header}
        {body}
      </Screen>
    );
  }

  const closed = ticket.status === 'closed';
  const topic = ticketTopicLabel(ticket.category, categories.data);

  return (
    <Screen testID="support-ticket-screen" keyboardAvoiding>
      {header}
      <FlatList
        style={[styles.fill, { backgroundColor: theme.colors.background }]}
        data={rows}
        inverted
        keyExtractor={(row) => row.key}
        renderItem={renderItem}
        initialNumToRender={20}
        windowSize={11}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={styles.listContent}
        // Inverted: the footer is drawn at the top, above the oldest message.
        ListFooterComponent={
          <TicketSummaryCard
            ticket={ticket}
            topic={topic}
            onOpenRide={(rideId) => navigation.navigate('RideDetails', { rideId })}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={thread.status === 'refreshing'}
            onRefresh={thread.refresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        testID="support-ticket-list"
      />
      {thread.waitSeconds !== null ? (
        <Banner
          tone="warning"
          text={t('support.replyRateLimited', { seconds: thread.waitSeconds })}
          // Announced once: the label keeps the starting wait and the live region is on only for
          // the first second, so TalkBack / VoiceOver do not re-read the ticking number.
          accessibilityLabel={t('support.replyRateLimited', { seconds: thread.waitTotal ?? thread.waitSeconds })}
          announce={thread.waitSeconds === thread.waitTotal}
          style={styles.banner}
          testID="support-ticket-wait"
        />
      ) : null}
      {closed ? (
        <View>
          <ChatClosedBar text={t('support.closedBar')} bottomInset={0} />
          <View style={[styles.closedAction, { backgroundColor: theme.colors.surface, paddingBottom: Math.max(insets.bottom, space[2]) }]}>
            <Button
              label={t('support.newRequest')}
              variant="ghost"
              size="sm"
              fullWidth={false}
              onPress={() => navigation.navigate('SupportNewRequest')}
              testID="support-ticket-new"
            />
          </View>
        </View>
      ) : (
        <>
          {ticket.status === 'resolved' ? <ResolvedBanner /> : null}
          <ChatComposer
            onSend={thread.send}
            bottomInset={keyboardVisible ? 0 : insets.bottom}
            placeholder={t('support.replyPlaceholder')}
            maxLength={MESSAGE_MAX}
            sendBlocked={thread.waitSeconds !== null}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  listContent: { paddingVertical: space[3], width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center' },
  banner: { marginHorizontal: layout.gutter, marginBottom: space[2] },
  closedAction: { alignItems: 'center' },
});
