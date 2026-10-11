import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText } from '../../../components/ui';
import { radius, space } from '../../../theme';
import { CHAT_COPY, formatChatTime } from '../copy';
import { isRetryableSendError, type ThreadItem } from '../thread';

type Props = {
  item: ThreadItem;
  /** This is your newest message the other party has read. */
  seen: boolean;
  onRetry: (clientId: string) => void;
};

/**
 * One chat bubble (T-510). Your messages sit at the end in `primary`, the other party's at the
 * start on `surface`. The body is plain text (BE-13), never parsed as markup. A pending
 * message shows "Sending…"; a failed one says why and, when it can be resent, retries on tap.
 */
export const MessageBubble: React.FC<Props> = ({ item, seen, onRetry }) => {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const mine = item.kind === 'pending' || item.message.isMine;
  const body = item.kind === 'pending' ? item.pending.body : item.message.body;
  const failed = item.kind === 'pending' && item.pending.status === 'failed';
  const retryable = failed && item.kind === 'pending' && !!item.pending.error && isRetryableSendError(item.pending.error);

  let meta: string;
  if (item.kind === 'pending') {
    meta = failed
      ? `${CHAT_COPY.sendErrors[item.pending.error ?? 'unknown']}${retryable ? ` ${CHAT_COPY.tapToRetry}` : ''}`
      : CHAT_COPY.sending;
  } else {
    const time = formatChatTime(item.message.createdAt);
    meta = seen ? `${time} · ${CHAT_COPY.seen}` : time;
  }

  const bubble = (
    <View
      style={[
        styles.bubble,
        mine
          ? [styles.mine, { backgroundColor: failed ? c.dangerSoft : c.primary }]
          : [styles.theirs, { backgroundColor: c.surface, borderColor: c.border, borderWidth: theme.borderWidth.thin }],
        item.kind === 'pending' && !failed ? styles.sending : null,
      ]}
    >
      <AppText variant="body" color={mine ? (failed ? 'textPrimary' : 'onPrimary') : 'textPrimary'} selectable>
        {body}
      </AppText>
    </View>
  );

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]} testID={`chat-bubble-${item.key}`}>
      {retryable && item.kind === 'pending' ? (
        <Pressable
          onPress={() => onRetry(item.pending.clientId)}
          accessibilityRole="button"
          accessibilityLabel={`${body}. ${meta}`}
          accessibilityHint={CHAT_COPY.retrySendA11y}
          testID={`chat-retry-${item.pending.clientId}`}
        >
          {bubble}
        </Pressable>
      ) : (
        bubble
      )}
      {meta ? (
        <AppText
          variant="caption"
          color={failed ? 'danger' : 'textMuted'}
          style={[styles.meta, mine ? styles.metaMine : null]}
          testID={seen ? 'chat-seen' : undefined}
        >
          {meta}
        </AppText>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { paddingHorizontal: space[4], paddingVertical: space[1], maxWidth: '100%' },
  rowMine: { alignItems: 'flex-end' },
  rowTheirs: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.lg,
  },
  mine: { borderBottomEndRadius: radius.xs },
  theirs: { borderBottomStartRadius: radius.xs },
  sending: { opacity: 0.7 },
  meta: { marginTop: space[1], marginHorizontal: space[1] },
  metaMine: { textAlign: 'right' },
});
