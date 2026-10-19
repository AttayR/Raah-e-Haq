import React from 'react';
import { StyleSheet, View } from 'react-native';
import { EmptyState, ErrorState, SkeletonGroup, SkeletonListItem } from '../../../components/ui';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { layout, radius, space } from '../../../theme';
import { NOTIFICATIONS_COPY } from '../copy';
import type { NotificationRole } from '../routing';
import type { NotificationFilter } from '../types';

export type NotificationsStateKind = 'loading' | 'error' | 'empty';

export type NotificationsStateProps = {
  kind: NotificationsStateKind;
  role: NotificationRole;
  filter: NotificationFilter;
  error?: string | null;
  onRetry: () => void;
};

/**
 * Inbox › Notifications without rows (UI-R14, shared-notifications "States"): six skeleton rows
 * in a card mirroring the real rows, the ErrorState with Try again, or the EmptyState (per role;
 * "You're all caught up" under the Unread filter). testIDs are the list's own
 * (`notifications-loading|error|empty`, `notifications-retry`).
 */
export function NotificationsState({ kind, role, filter, error, onRetry }: NotificationsStateProps) {
  const { theme } = useAppTheme();
  if (kind === 'loading') {
    return (
      <SkeletonGroup testID="notifications-loading" accessibilityLabel={NOTIFICATIONS_COPY.loadingA11y} style={styles.loading}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonListItem key={i} leading="tile" />
          ))}
        </View>
      </SkeletonGroup>
    );
  }
  if (kind === 'error') {
    return (
      <View testID="notifications-error">
        <ErrorState
          title={NOTIFICATIONS_COPY.loadFailedTitle}
          body={error ?? NOTIFICATIONS_COPY.loadFailed}
          onRetry={onRetry}
          retryLabel={NOTIFICATIONS_COPY.retry}
          testID="notifications"
        />
      </View>
    );
  }
  const unreadOnly = filter === 'unread';
  return (
    <EmptyState
      icon={unreadOnly ? 'checkMark' : 'bell'}
      title={unreadOnly ? NOTIFICATIONS_COPY.emptyUnreadTitle : NOTIFICATIONS_COPY.emptyTitle}
      body={
        unreadOnly
          ? NOTIFICATIONS_COPY.emptyUnreadBody
          : role === 'driver'
            ? NOTIFICATIONS_COPY.emptyBodyDriver
            : NOTIFICATIONS_COPY.emptyBodyPassenger
      }
      testID="notifications-empty"
    />
  );
}

const styles = StyleSheet.create({
  loading: { paddingHorizontal: layout.gutter, paddingTop: space[2] },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
});
