import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Icon } from '../../../components/ui';
import { radius, space } from '../../../theme';
import { NOTIFICATIONS_COPY } from '../copy';
import { categoryIcon, formatNotificationTime } from '../format';
import type { AppNotification } from '../types';

export type NotificationRowProps = {
  item: AppNotification;
  onPress: (item: AppNotification) => void;
  /** Injected for tests; defaults to now. */
  now?: number;
};

/**
 * One notification (DESIGN_SYSTEM §5.8 list row): category tile, title, body (3 lines), time.
 * Unread rows have a bold title, a `primarySoft` tile and a dot; text wraps with font scaling.
 */
function NotificationRowBase({ item, onPress, now }: NotificationRowProps) {
  const { theme } = useAppTheme();
  const unread = item.readAt === null;
  const time = formatNotificationTime(item.createdAt, now);
  const label = [unread ? NOTIFICATIONS_COPY.unreadA11y : null, item.title, item.body, time]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      testID={`notification-row-${item.id}`}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.surface },
      ]}
    >
      <View
        style={[styles.tile, { backgroundColor: unread ? theme.colors.primarySoft : theme.colors.surfaceAlt }]}
      >
        <Icon name={categoryIcon(item.category)} size={20} color={unread ? 'onPrimarySoft' : 'textSecondary'} />
      </View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <AppText variant={unread ? 'bodyStrong' : 'body'} numberOfLines={2} style={styles.title}>
            {item.title}
          </AppText>
          {time ? (
            <AppText variant="caption" color="textMuted" numberOfLines={1}>
              {time}
            </AppText>
          ) : null}
        </View>
        {item.body ? (
          <AppText variant="bodySmall" color="textSecondary" numberOfLines={3}>
            {item.body}
          </AppText>
        ) : null}
      </View>
      <View style={styles.dotSlot}>
        {unread ? (
          <View testID={`notification-unread-${item.id}`} style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
        ) : null}
      </View>
    </Pressable>
  );
}

export const NotificationRow = memo(NotificationRowBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[3],
    minHeight: 72,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: { flex: 1, minWidth: 0, gap: space[1] },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  title: { flex: 1, minWidth: 0 },
  dotSlot: { width: 8, paddingTop: space[2], flexShrink: 0 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
