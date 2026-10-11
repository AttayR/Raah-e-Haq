import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Button, Icon, Screen } from '../../../components/ui';
import { layout, space } from '../../../theme';
import { toast } from '../../../core/toast';
import { useKeyboardVisible } from '../../../hooks/useKeyboardVisible';
import { useAppIsActive } from '../../driver-requests/hooks';
import { selectActiveRide, type ActiveRideState } from '../../active-ride/slice';
import { selectDriverActiveRide, type DriverRideState } from '../../driver-ride/slice';
import { getPassengerPhone } from '../../driver-ride/steps';
import { getDriverPhone } from '../../../services/rideService';
import { ChatComposer } from '../components/ChatComposer';
import { ChatThreadHeader } from '../components/ChatThreadHeader';
import { MessageBubble } from '../components/MessageBubble';
import { CHAT_COPY, fallbackNameOf, formatChatTime, roleLabelOf } from '../copy';
import { useChatThread } from '../hooks';
import type { RideChatParams } from '../navigation';
import { seenMessageId, threadItemsNewestFirst, type ChatThreadState, type ThreadItem } from '../thread';

type PhoneRoot = { activeRide: ActiveRideState; driverRide: DriverRideState };

/**
 * The other party's phone for Call, only from this ride while it is active: the driver's on
 * the passenger's active ride, the passenger's on the driver's current ride (BE-20). The chat
 * API itself never carries a phone number. Never logged.
 */
const useRidePhone = (rideId: number): string | null => {
  const passengerRide = useSelector((s: PhoneRoot) => selectActiveRide(s));
  const driverRide = useSelector((s: PhoneRoot) => selectDriverActiveRide(s));
  if (driverRide?.id === rideId) return getPassengerPhone(driverRide);
  if (passengerRide?.id === rideId) return getDriverPhone(passengerRide);
  return null;
};

/** Why the composer is hidden, as one line under the messages. */
const closedNoticeOf = (state: ChatThreadState): string => {
  const meta = state.meta;
  if (meta?.readOnlyUntil) {
    const time = formatChatTime(meta.readOnlyUntil);
    return time ? CHAT_COPY.closedUntil(time) : CHAT_COPY.closedNotice;
  }
  if (meta && !meta.otherParty) return CHAT_COPY.notOpenNotice;
  if (meta && ['completed', 'cancelled'].includes(meta.rideStatus)) return CHAT_COPY.closedNotice;
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
  const { state, reload, loadOlder, send, retry } = useChatThread(rideId, isFocused && appActive);
  const phone = useRidePhone(rideId);

  const party = state.meta?.otherParty ?? null;
  const name = party?.firstName ?? fallbackNameOf(party?.role);
  const items = useMemo(() => threadItemsNewestFirst(state), [state]);
  const seenId = seenMessageId(state);
  const bottomInset = keyboardVisible ? 0 : insets.bottom;

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const onCall = useCallback(() => {
    if (!phone) return;
    Linking.openURL(`tel:${encodeURIComponent(phone)}`).catch(() => toast.error(CHAT_COPY.callFailed));
  }, [phone]);

  const renderItem: ListRenderItem<ThreadItem> = useCallback(
    ({ item }) => (
      <MessageBubble item={item} seen={item.kind === 'message' && item.message.id === seenId} onRetry={retry} />
    ),
    [seenId, retry],
  );

  const header = (
    <ChatThreadHeader
      name={state.status === 'ready' ? name : ''}
      subtitle={party ? roleLabelOf(party.role) : ''}
      photoUrl={party?.profileImageUrl ?? null}
      onBack={goBack}
      onCall={phone && state.meta?.canSend ? onCall : undefined}
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
                {state.status === 'error'
                  ? CHAT_COPY.threadError
                  : state.status === 'expired'
                    ? CHAT_COPY.threadExpired
                    : CHAT_COPY.threadForbidden}
              </AppText>
              {state.status === 'error' && state.errorMessage ? (
                <AppText variant="bodySmall" color="textSecondary" align="center">
                  {state.errorMessage}
                </AppText>
              ) : null}
              {state.status === 'expired' ? (
                <AppText variant="bodySmall" color="textSecondary" align="center">
                  {CHAT_COPY.threadExpiredBody}
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

  return (
    <Screen testID="chat-thread-screen">
      {header}
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
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
