import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, type ListRenderItem } from 'react-native';
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import type { RootState } from '../../../store';
import { AppText, Screen } from '../../../components/ui';
import { layout, space } from '../../../theme';
import { useKeyboardVisible } from '../../../hooks/useKeyboardVisible';
import { useAppIsActive } from '../../driver-requests/hooks';
import { selectActiveRide, type ActiveRideState } from '../../active-ride/slice';
import { driverCardOf } from '../../active-ride/stage';
import { selectDriverActiveRide, type DriverRideState } from '../../driver-ride/slice';
import { useRideCall } from '../../safety/hooks';
import { canCallOn } from '../../safety/rules';
import { ChatComposer } from '../components/ChatComposer';
import { ChatThreadHeader } from '../components/ChatThreadHeader';
import {
  ChatClosedBar,
  ChatDayPill,
  ChatThreadEmptyNote,
  ChatThreadSkeleton,
  ChatThreadUnavailable,
} from '../components/ChatThreadStates';
import { MessageBubble } from '../components/MessageBubble';
import { QuickReplies } from '../components/QuickReplies';
import { CHAT_COPY, fallbackNameOf, formatChatDayTime } from '../copy';
import { useChatThread } from '../hooks';
import type { RideChatParams } from '../navigation';
import { chatRowsNewestFirst, type ThreadRow } from '../rows';
import { seenMessageId, threadItemsNewestFirst, type ChatThreadState } from '../thread';
import type { ChatParty } from '../types';

type RideRoot = { activeRide: ActiveRideState; driverRide: DriverRideState };

/**
 * The ride this thread belongs to, from the store: the passenger's active ride or the driver's
 * current one. Whether Call is offered comes from its `contact.can_call` (BE-78; the call goes
 * through POST /rides/{id}/call, a masked number, never a phone number). A passenger also gets
 * the vehicle line for the header.
 */
const useThreadRide = (rideId: number): { canCall: boolean; vehicleLine: string } => {
  const passengerRide = useSelector((s: RideRoot) => selectActiveRide(s));
  const driverRide = useSelector((s: RideRoot) => selectDriverActiveRide(s));
  if (driverRide?.id === rideId) return { canCall: canCallOn(driverRide), vehicleLine: '' };
  if (passengerRide?.id === rideId) {
    const card = driverCardOf(passengerRide);
    return {
      canCall: canCallOn(passengerRide),
      vehicleLine: [card.vehicleName, card.plate].filter(Boolean).join(' · '),
    };
  }
  return { canCall: false, vehicleLine: '' };
};

/** Why the composer is hidden, as one line in the closed bar. */
const closedNoticeOf = (state: ChatThreadState): string => {
  const meta = state.meta;
  if (meta?.readOnlyUntil) {
    const time = formatChatDayTime(meta.readOnlyUntil);
    return time ? CHAT_COPY.closedUntil(time) : CHAT_COPY.closedNotice;
  }
  if (meta && !meta.otherParty) return CHAT_COPY.notOpenNotice;
  if (meta && (meta.contactClosesAt || ['completed', 'cancelled'].includes(meta.rideStatus))) return CHAT_COPY.closedNotice;
  return CHAT_COPY.cannotSendNotice;
};

const subtitleOf = (party: ChatParty | null, vehicleLine: string): string => {
  if (!party) return '';
  if (party.role === 'driver') return vehicleLine || CHAT_COPY.yourDriver;
  return CHAT_COPY.yourPassenger;
};

/**
 * One ride's chat for both roles (T-510, BE-13; UI-R14 shared-chat-thread). Polls for new
 * messages only while focused and in the foreground; the composer shows only while the server
 * says `can_send`, else a closed bar explains why (history stays readable). Bubbles group into
 * runs with day pills; quick replies sit above the composer while the thread is empty or the
 * last message is theirs.
 */
const ChatThreadScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ RideChat: RideChatParams }, 'RideChat'>>();
  const rideId = route.params.rideId;
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const isFocused = useIsFocused();
  const appActive = useAppIsActive();
  // BE-89: who sent a flagged message decides the safety note's wording.
  const viewerId = useSelector((s: RootState) => s.apiAuth.user?.id ?? null);
  const viewerRole = useSelector((s: RootState) => (s.apiAuth.user?.role === 'driver' ? 'driver' : 'passenger'));
  const { state, reload, loadOlder, send, retry } = useChatThread(rideId, isFocused && appActive);
  const ride = useThreadRide(rideId);
  // T-520: a masked call; when calls are chat only the user is already here, so only the note.
  const rideCall = useRideCall(rideId);

  const party = state.meta?.otherParty ?? null;
  const name = party?.firstName ?? fallbackNameOf(party?.role);
  const items = useMemo(() => threadItemsNewestFirst(state), [state]);
  const rows = useMemo(() => chatRowsNewestFirst(items), [items]);
  const seenId = seenMessageId(state);
  const readUpTo = state.meta?.otherPartyReadUpToId ?? 0;
  const bottomInset = keyboardVisible ? 0 : insets.bottom;

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const renderItem: ListRenderItem<ThreadRow> = useCallback(
    ({ item: row }) => {
      if (row.kind === 'day') return <ChatDayPill label={row.label} />;
      const message = row.item.kind === 'message' ? row.item.message : null;
      return (
        <MessageBubble
          item={row.item}
          seen={message !== null && message.id === seenId}
          read={message !== null && message.isMine && message.id <= readUpTo}
          firstInRun={row.firstInRun}
          lastInRun={row.lastInRun}
          onRetry={retry}
          viewerId={viewerId}
        />
      );
    },
    [seenId, readUpTo, retry, viewerId],
  );

  const header = (
    <ChatThreadHeader
      name={state.status === 'ready' ? name : ''}
      subtitle={subtitleOf(party, ride.vehicleLine)}
      photoUrl={party?.profileImageUrl ?? null}
      onBack={goBack}
      onCall={ride.canCall && state.meta?.canSend && !rideCall.calling ? rideCall.call : undefined}
    />
  );

  if (state.status !== 'ready') {
    return (
      // edges={[]}: the header's `surface` runs under the status bar (UI-R14 ruling).
      <Screen testID="chat-thread-screen" edges={[]}>
        {header}
        {state.status === 'loading' ? (
          <>
            <ChatThreadSkeleton />
            {/* The composer is already in place while loading, so nothing jumps when it opens. */}
            <ChatComposer
              onSend={() => false}
              bottomInset={insets.bottom}
              disabled
              // T-580: the name the opener passed, so the placeholder does not change on load.
              placeholder={route.params.name ? CHAT_COPY.composerPlaceholderTo(route.params.name) : undefined}
            />
          </>
        ) : (
          <ChatThreadUnavailable status={state.status} errorMessage={state.errorMessage} onRetry={reload} onBack={goBack} />
        )}
      </Screen>
    );
  }

  const canSend = state.meta?.canSend === true;
  // BE-78: after the ride ended both sides may still write for 30 min; say until when.
  const closesAt = canSend && state.meta?.contactClosesAt ? formatChatDayTime(state.meta.contactClosesAt) : '';
  const newest = items[0];
  const showQuickReplies = canSend && (!newest || (newest.kind === 'message' && !newest.message.isMine));

  return (
    // Screen's keyboard avoidance (top-inset offset, T-512) keeps the composer above the keyboard.
    <Screen testID="chat-thread-screen" edges={[]} keyboardAvoiding>
      {header}
      <FlatList
        style={[styles.fill, { backgroundColor: theme.colors.background }]}
        data={rows}
        inverted
        keyExtractor={(row) => row.key}
        renderItem={renderItem}
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        initialNumToRender={20}
        windowSize={11}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={[styles.listContent, rows.length === 0 ? styles.emptyContent : null]}
        ListFooterComponent={
          state.loadingOlder ? (
            <ActivityIndicator style={styles.older} color={theme.colors.textMuted} accessibilityLabel={CHAT_COPY.loadOlder} />
          ) : null
        }
        ListEmptyComponent={
          // VirtualizedList already turns the empty state upright in an inverted list.
          <ChatThreadEmptyNote
            text={canSend ? (viewerRole === 'driver' ? CHAT_COPY.threadEmptyDriver : CHAT_COPY.threadEmptyPassenger) : CHAT_COPY.noMessagesYet}
          />
        }
        testID="chat-thread-list"
      />
      {closesAt ? (
        <AppText variant="caption" color="textSecondary" align="center" style={styles.closesAt} testID="chat-closes-at">
          {CHAT_COPY.closesAt(closesAt)}
        </AppText>
      ) : null}
      {showQuickReplies ? <QuickReplies role={viewerRole} onSend={send} /> : null}
      {canSend ? (
        <ChatComposer
          onSend={send}
          bottomInset={bottomInset}
          placeholder={party?.firstName ? CHAT_COPY.composerPlaceholderTo(party.firstName) : undefined}
        />
      ) : (
        <ChatClosedBar text={closedNoticeOf(state)} bottomInset={insets.bottom} />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  closesAt: { paddingHorizontal: layout.gutter, paddingVertical: space[1] },
  fill: { flex: 1 },
  listContent: { paddingVertical: space[3], width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center' },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  older: { paddingVertical: space[3] },
});

export default ChatThreadScreen;
