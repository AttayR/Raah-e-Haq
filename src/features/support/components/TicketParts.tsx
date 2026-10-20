import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Badge, Banner, Card } from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, layout, space } from '../../../theme';
import { formatRelativeDate } from '../../../utils/format';
import { ticketStatusPill } from '../format';
import type { SupportTicket } from '../types';
import { RequestTripCard } from './RequestTripCard';

const k = componentTokens.support;
const LOGO = require('../../../assets/images/logo.png');

/** Above the first bubble of a support run: the brand badge (logo on a `surface` disc) and the name. */
export function SupportSender() {
  const { theme } = useAppTheme();
  return (
    <View style={styles.sender} testID="support-sender">
      <View style={[styles.badge, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: theme.borderWidth.thin }]}>
        <Image source={LOGO} style={styles.logo} accessibilityIgnoresInvertColors />
      </View>
      <AppText variant="caption" color="textMuted">
        {t('support.supportName')}
      </AppText>
    </View>
  );
}

type SummaryProps = { ticket: SupportTicket; topic: string; onOpenRide: (rideId: number) => void };

/**
 * The summary at the top of the thread (§H5, not sticky): "#{number} · {date}" and the status
 * pill, the linked trip (opens its details) and the topic.
 */
export function TicketSummaryCard({ ticket, topic, onOpenRide }: SummaryProps) {
  const pill = ticketStatusPill(ticket.status);
  const date = formatRelativeDate(ticket.createdAt);
  const ride = ticket.ride;
  return (
    <Card style={styles.summary} testID="support-ticket-summary">
      <View
        style={styles.row}
        accessible
        accessibilityLabel={t('support.summaryA11y', { number: ticket.ticketNumber, status: pill.label, date })}
      >
        <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.flex}>
          {t('support.ticketMeta', { number: ticket.ticketNumber, date })}
        </AppText>
        <Badge tone={pill.tone} label={pill.label} testID="support-ticket-status" />
      </View>
      {ride ? (
        <RequestTripCard
          trip={{ id: ride.id, pickupAddress: ride.pickupAddress, dropoffAddress: ride.dropoffAddress, at: ride.completedAt }}
          onPress={() => onOpenRide(ride.id)}
          testID="support-ticket-ride"
        />
      ) : null}
      <AppText variant="caption" color="textSecondary" testID="support-ticket-topic">
        {topic}
      </AppText>
    </Card>
  );
}

/** "Marked as solved. Reply if you still need help." above the composer of a solved request. */
export function ResolvedBanner() {
  return <Banner tone="info" text={t('support.resolvedBanner')} style={styles.banner} testID="support-ticket-resolved" />;
}

const styles = StyleSheet.create({
  sender: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[1] },
  badge: { width: k.brandBadge, height: k.brandBadge, borderRadius: k.brandBadge / 2, alignItems: 'center', justifyContent: 'center' },
  logo: { width: k.brandLogo, height: k.brandLogo, resizeMode: 'contain' },
  summary: { marginHorizontal: layout.gutter, marginBottom: space[2], gap: space[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  flex: { flex: 1, minWidth: 0 },
  banner: { marginHorizontal: layout.gutter, marginBottom: space[2] },
});
