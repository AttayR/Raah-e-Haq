import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import type { RootState } from '../../../store';
import { AppText, Button, Icon, Screen } from '../../../components/ui';
import { layout, space } from '../../../theme';
import { useKeyboardVisible } from '../../../hooks/useKeyboardVisible';
import { useAppIsActive } from '../../driver-requests/hooks';
import { selectActiveRide, type ActiveRideState } from '../../active-ride/slice';
import { selectDriverActiveRide, type DriverRideState } from '../../driver-ride/slice';
import { useRideCall } from '../../safety/hooks';
import { canCallOn } from '../../safety/rules';
import { ChatComposer } from '../components/ChatComposer';
import { ChatThreadHeader } from '../components/ChatThreadHeader';
import { MessageBubble } from '../components/MessageBubble';
import { CHAT_COPY, fallbackNameOf, formatChatDayTime, roleLabelOf } from '../copy';
import { useChatThread } from '../hooks';
import type { RideChatParams } from '../navigation';
import { seenMessageId, threadItemsNewestFirst, type ChatThreadState, type ThreadItem } from '../thread';
import { perLocale } from '../../../i18n';

type RideRoot = { activeRide: ActiveRideState; driverRide: DriverRideState };

/**
 * Whether Call is offered: the ride this thread belongs to (the passenger's active ride or the
 * driver's current one) says `contact.can_call` (BE-78). No phone number is ever involved: the
 * call goes through POST /rides/{id}/call (a masked proxy number).
 */
const useCanCall = (rideId: number): boolean => {
  const passengerRide = useSelector((s: RideRoot) => selectActiveRide(s));
  const driverRide = useSelector((s: RideRoot) => selectDriverActiveRide(s));
  if (driverRide?.id === rideId) return canCallOn(driverRide);
  if (passengerRide?.id === rideId) return canCallOn(passengerRide);
  return false;
};

/** Why the composer is hidden, as one line under the messages. */
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

/**
 * One ride's chat for both roles (T-510, BE-13). Polls for new messages only while focused and
 * in the foreground; the composer shows only while the server says `can_send`.
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
  const { state, reload, loadOlder, send, retry } = useChatThread(rideId, isFocused && appActive);
  const canCall = useCanCall(rideId);
  // T-520: a masked call; when calls are chat only the user is already here, so only the note.
  const rideCall = useRideCall(rideId);

  const party = state.meta?.otherParty ?? null;
  const name = party?.firstName ?? fallbackNameOf(party?.role);
  const items = useMemo(() => threadItemsNewestFirst(state), [state]);
  const seenId = seenMessageId(state);
  const bottomInset = keyboardVisible ? 0 : insets.bottom;

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const renderItem: ListRenderItem<ThreadItem> = useCallback(
    ({ item }) => (
      <MessageBubble
        item={item}
        seen={item.kind === 'message' && item.message.id === seenId}
        onRetry={retry}
        viewerId={viewerId}
      />
    ),
    [seenId, retry, viewerId],
  );

  const header = (
    <ChatThreadHeader
      name={state.status === 'ready' ? name : ''}
      subtitle={party ? roleLabelOf(party.role) : ''}
      photoUrl={party?.profileImageUrl ?? null}
      onBack={goBack}
      onCall={canCall && state.meta?.canSend && !rideCall.calling ? rideCall.call : undefined}
    />
  );

  if (state.status !== 'ready') {
    return (
      <Screen testID="chat-thread-screen">
        {header}
        <View style={styles.centered} testID={`chat-thread-${state.status}`}>
          {state.status === 'loading' ? (
            <ActivityIndicator color={theme.colors.primary} accessibilityLabel={CHAT_COPY.loading} testID="chat-thread-spinner" />
          ) : (
            <>
              <Icon name={state.status === 'error' ? 'warning' : 'lock'} size={48} color="textMuted" />
              <AppText variant="title" align="center">
                {STATUS_TITLES()[state.status]}
              </AppText>
              {state.status === 'error' && state.errorMessage ? (
                <AppText variant="bodySmall" color="textSecondary" align="center">
                  {state.errorMessage}
                </AppText>
              ) : null}
              {state.status === 'expired' || state.status === 'closed' ? (
                <AppText variant="bodySmall" color="textSecondary" align="center">
                  {state.status === 'expired' ? CHAT_COPY.threadExpiredBody : CHAT_COPY.threadClosedBody}
                </AppText>
              ) : null}
              {state.status === 'error' ? (
                <Button label={CHAT_COPY.retry} onPress={reload} leadingIcon="retry" fullWidth={false} testID="chat-thread-retry" />
              ) : (
                <Button label={CHAT_COPY.back} onPress={goBack} variant="outline" fullWidth={false} />
              )}
            </>
          )}
        </View>
      </Screen>
    );
  }

  const canSend = state.meta?.canSend === true;
  // BE-78: after the ride ended both sides may still write for 30 min; say until when.
  const closesAt = canSend && state.meta?.contactClosesAt ? formatChatDayTime(state.meta.contactClosesAt) : '';

  return (
    // Screen's keyboard avoidance (top-inset offset, T-512) keeps the composer above the keyboard.
    <Screen testID="chat-thread-screen" keyboardAvoiding>
      {header}
      <FlatList
        style={styles.fill}
        data={items}
        inverted
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={[styles.listContent, items.length === 0 ? styles.emptyContent : null]}
        ListFooterComponent={
          state.loadingOlder ? (
            <ActivityIndicator style={styles.older} color={theme.colors.textMuted} accessibilityLabel={CHAT_COPY.loadOlder} />
          ) : null
        }
        ListEmptyComponent={
          // VirtualizedList already turns the empty state upright in an inverted list.
          <View style={styles.empty} testID="chat-thread-empty">
            <Icon name="chat" size={48} color="textMuted" />
            <AppText variant="body" color="textSecondary" align="center">
              {CHAT_COPY.threadEmpty}
            </AppText>
          </View>
        }
        testID="chat-thread-list"
      />
      {closesAt ? (
        <AppText variant="caption" color="textSecondary" align="center" style={styles.closesAt} testID="chat-closes-at">
          {CHAT_COPY.closesAt(closesAt)}
        </AppText>
      ) : null}
      {canSend ? (
        <ChatComposer onSend={send} bottomInset={bottomInset} />
      ) : (
        <View
          style={[
            styles.notice,
            { backgroundColor: theme.colors.surfaceAlt, paddingBottom: space[3] + insets.bottom },
          ]}
          testID="chat-closed-notice"
          accessibilityLiveRegion="polite"
        >
          <Icon name="lock" size={20} color="textSecondary" />
          <AppText variant="bodySmall" color="textSecondary" style={styles.noticeText}>
            {closedNoticeOf(state)}
          </AppText>
        </View>
      )}
    </Screen>
  );
};

const STATUS_TITLES = perLocale((): Record<Exclude<ChatThreadState['status'], 'ready' | 'loading'>, string> => ({
  error: CHAT_COPY.threadError,
  expired: CHAT_COPY.threadExpired,
  closed: CHAT_COPY.threadClosed,
  forbidden: CHAT_COPY.threadForbidden,
}));

const styles = StyleSheet.create({
  closesAt: { paddingHorizontal: layout.gutter, paddingVertical: space[1] },
  fill: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    padding: layout.gutter,
  },
  listContent: { paddingVertical: space[3], width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center' },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: space[3], padding: layout.gutter },
  older: { paddingVertical: space[3] },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: layout.gutter,
    paddingTop: space[3],
  },
  noticeText: { flex: 1 },
});

export default ChatThreadScreen;
