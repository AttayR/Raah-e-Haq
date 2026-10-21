import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Icon } from '../../../components/ui';
import { componentTokens, layout, radius, space } from '../../../theme';
import { formatTime, keepMoneyTogether } from '../../../utils/format';
import { NOTIFICATIONS_COPY } from '../copy';
import { notificationTone } from '../format';
import { SUPPORT_TYPE } from '../routing';
import type { AppNotification } from '../types';

/** Where the row sits in its day's card: the card's corners follow the first and last row. */
export type RowPosition = 'only' | 'first' | 'middle' | 'last';

export const rowPosition = (index: number, count: number): RowPosition => {
  if (count <= 1) return 'only';
  if (index === 0) return 'first';
  return index === count - 1 ? 'last' : 'middle';
};

export type NotificationRowProps = {
  item: AppNotification;
  onPress: (item: AppNotification) => void;
  /** Long press (and the screen-reader action) marks an unread row read without opening it. */
  onMarkRead?: (item: AppNotification) => void;
  position?: RowPosition;
};

const k = componentTokens.listItem;

/**
 * One notification (UI-R14, DESIGN_SYSTEM §12.4, shared-notifications): a 40 tile whose glyph
 * and tone follow the category, the title (one line), the body (two lines) and the send time
 * ("2:30 PM"; the day header above gives the date). Unread: title 600 and an 8pt `primary` dot
 * at the end; the row stays `surface`. Rows of one day form one card (radius 16).
 */
function NotificationRowBase({ item, onPress, onMarkRead, position = 'only' }: NotificationRowProps) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const unread = item.readAt === null;
  const tone = notificationTone(item.category);
  const time = formatTime(item.createdAt);
  // UI-R19 review: the server's "Rs 150" never wraps between "Rs" and the amount.
  const title = keepMoneyTogether(item.title);
  const body = item.body ? keepMoneyTogether(item.body) : '';
  const label = [unread ? NOTIFICATIONS_COPY.unreadA11y : null, item.title, item.body, time]
    .filter(Boolean)
    .join(', ');
  const canMarkRead = unread && !!onMarkRead;

  const markRead = useCallback(() => onMarkRead?.(item), [onMarkRead, item]);
  // T-581: a long press only marks read. Marking read re-renders the row as read, which used to
  // drop `onLongPress` mid-press; Pressability then saw no long-press handler on release and ran
  // onPress too, opening the target. The handler now stays for the row's whole life (a read row's
  // long press does nothing), so the release after a long press never opens.
  const onLongPress = useCallback(() => {
    if (item.readAt === null) onMarkRead?.(item);
  }, [onMarkRead, item]);
  const handlePress = useCallback(() => onPress(item), [onPress, item]);
  const onAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === 'markRead') markRead();
    },
    [markRead],
  );

  return (
    <Pressable
      testID={`notification-row-${item.id}`}
      onPress={handlePress}
      onLongPress={onMarkRead ? onLongPress : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityActions={canMarkRead ? [{ name: 'markRead', label: NOTIFICATIONS_COPY.markRead }] : undefined}
      onAccessibilityAction={canMarkRead ? onAction : undefined}
      style={({ pressed }) => [
        styles.row,
        cornerStyle[position],
        { backgroundColor: pressed ? c.surfacePressed : c.surface },
      ]}
    >
      <View style={[styles.tile, { backgroundColor: c[tone.tile] }]}>
        <Icon name={item.type === SUPPORT_TYPE ? 'support' : tone.icon} size={k.tileIconSize} color={tone.glyph} />
      </View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <AppText variant={unread ? 'title' : 'body'} numberOfLines={2} style={styles.title}>
            {title}
          </AppText>
          {time ? (
            <AppText variant="caption" color="textMuted" numberOfLines={1}>
              {time}
            </AppText>
          ) : null}
        </View>
        {body ? (
          <AppText variant="bodySmall" color="textSecondary" numberOfLines={2}>
            {body}
          </AppText>
        ) : null}
      </View>
      <View style={styles.dotSlot}>
        {unread ? (
          <View testID={`notification-unread-${item.id}`} style={[styles.dot, { backgroundColor: c.primary }]} />
        ) : null}
      </View>
    </Pressable>
  );
}

export const NotificationRow = memo(NotificationRowBase);

const cornerStyle = StyleSheet.create({
  only: { borderRadius: radius.lg },
  first: { borderTopStartRadius: radius.lg, borderTopEndRadius: radius.lg },
  middle: {},
  last: { borderBottomStartRadius: radius.lg, borderBottomEndRadius: radius.lg },
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: layout.gutter,
    // ListItem §5.8: padding 16, tile 40 → 16 → text (x = 72 inside the card).
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[4],
    minHeight: k.minHeight.two,
  },
  tile: {
    width: k.tile,
    height: k.tile,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  text: { flex: 1, minWidth: 0, gap: space[1] },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: space[2] },
  title: { flex: 1, minWidth: 0 },
  dotSlot: { width: componentTokens.badge.dot, alignItems: 'center', flexShrink: 0 },
  dot: { width: componentTokens.badge.dot, height: componentTokens.badge.dot, borderRadius: radius.pill },
});
