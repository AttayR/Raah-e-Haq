import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Icon, type IconName } from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, space } from '../../../theme';
import { CHAT_COPY, formatChatTime } from '../copy';
import { chatSafetyNoteOf } from '../safety';
import { isRetryableSendError, type ThreadItem } from '../thread';

type Props = {
  item: ThreadItem;
  /** This is your newest message the other party has read (carries the `chat-seen` marker). */
  seen: boolean;
  onRetry: (clientId: string) => void;
  /** The signed-in user's id, so a BE-89 safety note is worded for sender or recipient. */
  viewerId?: number | null;
  /** Oldest bubble of a run from one side: 16 above it, 4 between bubbles of a run. */
  firstInRun?: boolean;
  /** Newest bubble of a run: the time (and, for yours, the status) shows under it. */
  lastInRun?: boolean;
  /** Your message the other party has read (read receipts are cumulative, BE-13). */
  read?: boolean;
  /**
   * UI-R18 support thread: drawn above the first bubble of the other side's run (the
   * "Raah-e-Haq support" badge and name). The ride chat passes nothing.
   */
  sender?: React.ReactNode;
};

const k = componentTokens.chat;

/**
 * One chat bubble (T-510; UI-R14 shared-chat-thread). Yours sit at the end on `primary` with
 * `onPrimary` text, the other party's at the start on `surface` (`surfaceAlt` in dark, with a
 * hairline `border` in light); radius 18 with a 6 corner on the sender's side, at most 75 % wide.
 * Under the last bubble of a run: the time, and for yours sending (clock), sent (check) or read
 * (double check). A pending bubble is at 60 % until it lands; a failed one says why in `danger`
 * and, when it can be resent, retries on tap. The body is plain text (BE-13), never markup. A
 * message with a BE-89 `safety_warning` gets a warning note under it (not a modal).
 */
function MessageBubbleBase({ item, seen, onRetry, viewerId, firstInRun = true, lastInRun = true, read = false, sender }: Props) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const dark = theme.mode === 'dark';
  const mine = item.kind === 'pending' || item.message.isMine;
  const body = item.kind === 'pending' ? item.pending.body : item.message.body;
  const sending = item.kind === 'pending' && item.pending.status === 'sending';
  const failed = item.kind === 'pending' && item.pending.status === 'failed';
  const retryable = failed && item.kind === 'pending' && !!item.pending.error && isRetryableSendError(item.pending.error);

  const safety = item.kind === 'message' ? chatSafetyNoteOf(item.message, viewerId) : null;

  const time = formatChatTime(item.kind === 'pending' ? item.pending.createdAt : item.message.createdAt);
  let status: { icon: IconName; label: string; read: boolean } | null = null;
  if (mine && !failed) {
    if (sending) status = { icon: 'clock', label: CHAT_COPY.sending, read: false };
    else if (read || seen) status = { icon: 'checkAll', label: CHAT_COPY.seen, read: true };
    else status = { icon: 'checkMark', label: CHAT_COPY.sent, read: false };
  }
  // T-581 (spec "Sending"): "Not sent. Tap to retry." for a dropped connection or an unknown
  // failure; a refusal that needs words (wait a moment, chat closed) keeps its reason.
  const failError = item.kind === 'pending' ? (item.pending.error ?? 'unknown') : 'unknown';
  const failText = !failed
    ? ''
    : retryable && (failError === 'network' || failError === 'unknown')
      ? CHAT_COPY.notSentRetry
      : `${CHAT_COPY.sendErrors[failError]}${retryable ? ` ${CHAT_COPY.tapToRetry}` : ''}`;
  const showMeta = failed || sending || seen || lastInRun;

  const bubble = (
    <View
      style={[
        styles.bubble,
        mine ? styles.mine : styles.theirs,
        mine
          ? { backgroundColor: c.primary }
          : dark
            ? { backgroundColor: c.surfaceAlt }
            : { backgroundColor: c.surface, borderColor: c.border, borderWidth: theme.borderWidth.thin },
        sending || failed ? styles.pending : null,
      ]}
    >
      <AppText variant="body" color={mine ? 'onPrimary' : 'textPrimary'} selectable>
        {body}
      </AppText>
    </View>
  );

  return (
    <View
      style={[styles.row, mine ? styles.rowMine : styles.rowTheirs, firstInRun ? styles.runStart : null]}
      testID={`chat-bubble-${item.key}`}
    >
      {sender && !mine && firstInRun ? sender : null}
      {retryable && item.kind === 'pending' ? (
        <Pressable
          onPress={() => onRetry(item.pending.clientId)}
          accessibilityRole="button"
          accessibilityLabel={`${body}. ${failText}`}
          accessibilityHint={CHAT_COPY.retrySendA11y}
          testID={`chat-retry-${item.pending.clientId}`}
          style={styles.pressable}
        >
          {bubble}
        </Pressable>
      ) : (
        bubble
      )}
      {failed ? (
        <View style={[styles.meta, styles.metaMine]}>
          <Icon name="error" size={k.metaIconSize} color="danger" />
          <AppText variant="caption" color="danger" style={styles.failText}>
            {failText}
          </AppText>
        </View>
      ) : showMeta ? (
        <View
          style={[styles.meta, mine ? styles.metaMine : null]}
          accessible
          accessibilityLabel={[time, status?.label].filter(Boolean).join(', ')}
          testID={seen ? 'chat-seen' : undefined}
        >
          {time ? (
            <AppText variant="caption" color="textMuted">
              {time}
            </AppText>
          ) : null}
          {status ? <Icon name={status.icon} size={k.metaIconSize} color={status.read ? 'primaryText' : 'textMuted'} /> : null}
        </View>
      ) : null}
      {safety ? (
        <View
          style={[styles.safety, { backgroundColor: c.warningSoft, borderColor: c.warning, borderWidth: theme.borderWidth.thin }]}
          accessible
          accessibilityRole="text"
          accessibilityLabel={t('chatSafety.noteA11y', { text: safety.text })}
          testID={`chat-safety-${item.key}`}
        >
          <Icon name="alertTriangle" size={k.metaIconSize} color="warning" />
          <AppText variant="caption" color="textPrimary" style={styles.safetyText} testID={`chat-safety-${safety.audience}`}>
            {safety.text}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleBase);

const styles = StyleSheet.create({
  row: { paddingHorizontal: space[4], paddingTop: k.runGap, maxWidth: '100%' },
  runStart: { paddingTop: k.runBreak },
  rowMine: { alignItems: 'flex-end' },
  rowTheirs: { alignItems: 'flex-start' },
  pressable: { maxWidth: k.bubbleMaxWidth, alignItems: 'flex-end' },
  bubble: {
    maxWidth: k.bubbleMaxWidth,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: k.bubbleRadius,
  },
  mine: { borderBottomEndRadius: k.bubbleTailRadius },
  theirs: { borderBottomStartRadius: k.bubbleTailRadius },
  pending: { opacity: k.pendingOpacity },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space[1], marginTop: space[1], marginHorizontal: space[1] },
  metaMine: { justifyContent: 'flex-end' },
  failText: { flexShrink: 1 },
  safety: {
    maxWidth: k.bubbleMaxWidth,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    marginTop: space[1],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: k.noteRadius,
  },
  safetyText: { flexShrink: 1 },
});
