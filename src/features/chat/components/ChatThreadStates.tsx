import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, EmptyState, ErrorState, Icon, Skeleton, SkeletonGroup } from '../../../components/ui';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { componentTokens, layout, space } from '../../../theme';
import { perLocale } from '../../../i18n';
import { CHAT_COPY } from '../copy';
import type { ChatThreadState } from '../thread';

const k = componentTokens.chat;

/** Three skeleton bubbles alternating sides (shared-chat-thread "Loading"). */
export function ChatThreadSkeleton() {
  return (
    <SkeletonGroup testID="chat-thread-loading" accessibilityLabel={CHAT_COPY.loading} style={styles.skeleton}>
      <View style={styles.theirs}>
        <Skeleton width="55%" height={k.skeletonBubbleHeight} shape="card" />
      </View>
      <View style={styles.mine}>
        <Skeleton width="45%" height={k.skeletonBubbleHeight} shape="card" />
      </View>
      <View style={styles.theirs}>
        <Skeleton width="65%" height={k.skeletonBubbleHeight} shape="card" />
      </View>
    </SkeletonGroup>
  );
}

type Ended = Exclude<ChatThreadState['status'], 'ready' | 'loading'>;

const TITLES = perLocale((): Record<Ended, string> => ({
  error: CHAT_COPY.threadError,
  expired: CHAT_COPY.threadExpired,
  closed: CHAT_COPY.threadClosed,
  forbidden: CHAT_COPY.threadForbidden,
}));

type StateProps = {
  status: Ended;
  errorMessage: string | null;
  onRetry: () => void;
  onBack: () => void;
};

/**
 * A thread that cannot be shown (T-510, BE-78): the ErrorState with Try again, or a lock
 * EmptyState ("Chat closed", "This chat has expired", "not available to you") with Back.
 * The wrapper keeps the screen's `chat-thread-{status}` testID.
 */
export function ChatThreadUnavailable({ status, errorMessage, onRetry, onBack }: StateProps) {
  if (status === 'error') {
    return (
      <View style={styles.fill} testID="chat-thread-error">
        <ErrorState title={TITLES().error} body={errorMessage ?? undefined} onRetry={onRetry} retryLabel={CHAT_COPY.retry} testID="chat-thread" />
      </View>
    );
  }
  const body =
    status === 'expired' ? CHAT_COPY.threadExpiredBody : status === 'closed' ? CHAT_COPY.threadClosedBody : undefined;
  return (
    <View style={styles.fill} testID={`chat-thread-${status}`}>
      <EmptyState
        icon="lock"
        title={TITLES()[status]}
        body={body}
        action={{ label: CHAT_COPY.back, onPress: onBack, testID: 'chat-thread-back' }}
      />
    </View>
  );
}

/** Centred note in an open, empty thread: who can read the messages. */
export function ChatThreadEmptyNote({ text }: { text: string }) {
  return (
    <View style={styles.empty} testID="chat-thread-empty">
      <AppText variant="bodySmall" color="textMuted" align="center">
        {text}
      </AppText>
    </View>
  );
}

/** The bar that replaces the composer once sending closed (shared-chat-thread "Closed"). */
export function ChatClosedBar({ text, bottomInset }: { text: string; bottomInset: number }) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.closed,
        { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border, paddingBottom: space[2] + bottomInset },
      ]}
      testID="chat-closed-notice"
      accessibilityLiveRegion="polite"
    >
      <Icon name="lock" size={k.closedIconSize} color="textSecondary" />
      <AppText variant="bodySmall" color="textSecondary" style={styles.closedText}>
        {text}
      </AppText>
    </View>
  );
}

/** "Today" / "Yesterday" / "Mon, 28 Sep" pill between days. */
export function ChatDayPill({ label }: { label: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.dayRow} accessibilityRole="header">
      <View style={[styles.dayPill, { backgroundColor: theme.colors.surfaceAlt }]}>
        <AppText variant="caption" color="textMuted">
          {label}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  skeleton: { flex: 1, paddingHorizontal: layout.gutter, paddingTop: space[4], gap: space[4] },
  theirs: { alignItems: 'flex-start' },
  mine: { alignItems: 'flex-end' },
  empty: { paddingHorizontal: space[8], paddingVertical: space[6], alignItems: 'center' },
  closed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: k.closedBarHeight,
    paddingHorizontal: layout.gutter,
    paddingTop: space[2],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  closedText: { flex: 1 },
  dayRow: { alignItems: 'center', paddingTop: space[4] },
  dayPill: {
    minHeight: k.dayPillHeight,
    paddingHorizontal: space[3],
    borderRadius: k.dayPillHeight / 2,
    justifyContent: 'center',
  },
});
