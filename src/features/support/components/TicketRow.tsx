import React, { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { Badge, ListItem } from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, space } from '../../../theme';
import { ticketMeta, ticketPreview, ticketStatusPill, topicGlyph } from '../format';
import type { SupportTicket } from '../types';

type Props = { ticket: SupportTicket; onPress: (ticket: SupportTicket) => void };

const k = componentTokens.support;

/**
 * One request (shared-support-invite §H2), on Help and on Your requests: topic tile, subject (one
 * line), the newest message (one line), "#{number} · {date}" and the status pill; an unread
 * support reply adds a `primary` dot before the pill. The pill's word is in the row label.
 */
export const TicketRow = memo(function TicketRow({ ticket, onPress }: Props) {
  const { theme } = useAppTheme();
  const pill = ticketStatusPill(ticket.status);
  const preview = ticketPreview(ticket);
  const meta = ticketMeta(ticket);
  const handlePress = useCallback(() => onPress(ticket), [onPress, ticket]);
  const label = t(ticket.unread ? 'support.rowUnreadA11y' : 'support.rowA11y', {
    subject: ticket.subject,
    status: pill.label,
    preview,
    meta,
  });
  return (
    <ListItem
      variant="content"
      icon={topicGlyph(ticket.category)}
      title={ticket.subject}
      titleNumberOfLines={1}
      subtitle={preview}
      subtitleNumberOfLines={1}
      meta={meta}
      trailing={
        <View style={styles.trailing}>
          {ticket.unread ? (
            <View
              style={[styles.dot, { backgroundColor: theme.colors.primary }]}
              testID={`support-ticket-${ticket.id}-unread`}
            />
          ) : null}
          <Badge tone={pill.tone} label={pill.label} testID={`support-ticket-${ticket.id}-status`} />
        </View>
      }
      chevron={false}
      onPress={handlePress}
      accessibilityLabel={label}
      testID={`support-ticket-${ticket.id}`}
    />
  );
});

const styles = StyleSheet.create({
  trailing: { flexDirection: 'row', alignItems: 'center', gap: space[2], flexShrink: 0 },
  dot: { width: k.unreadDot, height: k.unreadDot, borderRadius: k.unreadDot / 2 },
});
