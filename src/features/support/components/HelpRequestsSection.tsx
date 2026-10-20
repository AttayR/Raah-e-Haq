import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Card, EmptyState, ErrorState, ListGroup, ListItem, Skeleton, SkeletonGroup } from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, layout, space } from '../../../theme';
import type { SupportTicket, TicketPage } from '../types';
import { TicketRow } from './TicketRow';

/** Help shows this many requests; more go behind "See all requests". */
export const HELP_TICKET_COUNT = 3;

type Props = {
  page: TicketPage | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onNew: () => void;
  onOpen: (ticket: SupportTicket) => void;
  onSeeAll: () => void;
};

/**
 * "Your requests" (shared-support-invite §H1.3): the overline with "New request" at its end, then
 * the three newest requests and "See all requests" when there are more. Empty: a compact
 * EmptyState in a Card (the header button is the action). Error: a compact ErrorState.
 */
export function HelpRequestsSection({ page, loading, failed, onRetry, onNew, onOpen, onSeeAll }: Props) {
  const header = (
    <View style={styles.header}>
      <AppText variant="overline" color="textMuted" accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {t('support.requestsOverline')}
      </AppText>
      <Button
        label={t('support.newRequest')}
        variant="ghost"
        size="sm"
        fullWidth={false}
        leadingIcon="add"
        onPress={onNew}
        testID="support-new-request"
      />
    </View>
  );

  let body: React.ReactNode;
  if (!page && loading) {
    body = (
      <SkeletonGroup testID="support-requests-loading">
        <Skeleton shape="block" height={componentTokens.listItem.minHeight.two * 2} />
      </SkeletonGroup>
    );
  } else if (!page && failed) {
    body = (
      <Card>
        <ErrorState
          size="compact"
          title={t('support.requestsFailed')}
          retryLabel={t('support.tryAgain')}
          onRetry={onRetry}
          testID="support-requests-error"
        />
      </Card>
    );
  } else if (!page || page.items.length === 0) {
    body = (
      <Card>
        <EmptyState
          size="compact"
          icon="chat"
          title={t('support.emptyTitle')}
          body={t('support.emptyBody')}
          testID="support-requests-empty"
        />
      </Card>
    );
  } else {
    const shown = page.items.slice(0, HELP_TICKET_COUNT);
    body = (
      <ListGroup inset="tile" testID="support-requests">
        {shown.map((ticket) => (
          <TicketRow key={ticket.id} ticket={ticket} onPress={onOpen} />
        ))}
        {page.total > HELP_TICKET_COUNT ? (
          <ListItem title={t('support.seeAll')} onPress={onSeeAll} testID="support-see-all" />
        ) : null}
      </ListGroup>
    );
  }

  return (
    <View testID="support-requests-section">
      {header}
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    marginBottom: layout.sectionHeaderGap - space[2],
    marginStart: space[4],
  },
  title: { flex: 1 },
});
