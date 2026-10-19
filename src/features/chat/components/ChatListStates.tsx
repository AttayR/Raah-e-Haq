import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { EmptyState, ErrorState, Skeleton, SkeletonGroup } from '../../../components/ui';
import { componentTokens, layout, radius, space } from '../../../theme';
import { CHAT_COPY } from '../copy';
import type { ChatRole } from '../types';
import { CHAT_AVATAR_SIZE } from './ChatRow';

export type ChatListStateProps = {
  kind: 'loading' | 'error' | 'empty';
  role: ChatRole;
  error?: string | null;
  onRetry: () => void;
};

/**
 * Inbox › Messages without rows (UI-R14, shared-chat-list "States"): four skeleton rows (48
 * circle + two lines) in a card, the ErrorState with Try again, or the EmptyState naming the
 * other side. testIDs are the list's own (`chat-list-loading|error|empty`, `chat-list-retry`).
 */
export function ChatListState({ kind, role, error, onRetry }: ChatListStateProps) {
  const { theme } = useAppTheme();
  if (kind === 'loading') {
    return (
      <SkeletonGroup testID="chat-list-loading" accessibilityLabel={CHAT_COPY.listLoadingA11y} style={styles.loading}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          {Array.from({ length: 4 }, (_, i) => (
            <View key={i} style={styles.row}>
              <Skeleton width={CHAT_AVATAR_SIZE} height={CHAT_AVATAR_SIZE} shape="pill" />
              <View style={styles.lines}>
                <Skeleton width="40%" textVariant="title" />
                <Skeleton width="75%" textVariant="bodySmall" />
              </View>
            </View>
          ))}
        </View>
      </SkeletonGroup>
    );
  }
  if (kind === 'error') {
    return (
      <View testID="chat-list-error">
        <ErrorState
          title={CHAT_COPY.listErrorTitle}
          body={error ?? CHAT_COPY.listError}
          onRetry={onRetry}
          retryLabel={CHAT_COPY.retry}
          testID="chat-list"
        />
      </View>
    );
  }
  return (
    <EmptyState
      icon="chat"
      title={CHAT_COPY.listEmptyTitle}
      body={role === 'driver' ? CHAT_COPY.listEmptyDriver : CHAT_COPY.listEmptyPassenger}
      testID="chat-list-empty"
    />
  );
}

const styles = StyleSheet.create({
  loading: { paddingHorizontal: layout.gutter, paddingTop: space[3] },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    minHeight: componentTokens.listItem.minHeight.two,
  },
  lines: { flex: 1, gap: space[2] },
});
