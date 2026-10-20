import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { Header, OfflineBanner, Screen } from '../../../components/ui';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import { useRecentRides, useRideViewer } from '../../ride-history/hooks';
import { HelpContactGroup, HelpEmergencyGroup } from '../components/HelpContactGroups';
import { HelpRequestsSection } from '../components/HelpRequestsSection';
import { HelpTopicsGroup } from '../components/HelpTopicsGroup';
import { HelpTripPlaceholder, HelpTripSection } from '../components/HelpTripSection';
import { useRecentTickets, useSupportCategories, useSupportContacts } from '../hooks';
import type { SupportNavigator, SupportTripPrefill } from '../navigation';
import type { SupportTicket } from '../types';

/**
 * Help & support, both roles (UI-R18, shared-support-invite §H1): the last trip (hidden without
 * rides), topics from GET /support/categories, the three newest requests with "See all", the
 * contact rows GET /settings/public sends, and the emergency row, always last. At most three
 * reads on open (recent ride from the shared cache, tickets page 1, topics cached for a day);
 * public settings once per session. Pull to refresh re-reads requests and public settings.
 */
export default function SupportScreen() {
  const navigation = useNavigation<SupportNavigator>();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const viewer = useRideViewer();

  const rides = useRecentRides(1, isFocused, { reuseCached: true });
  const categories = useSupportCategories(isFocused);
  const tickets = useRecentTickets(isFocused);
  const support = useSupportContacts(isFocused);
  const [pulling, setPulling] = useState(false);

  const onRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await Promise.all([tickets.refresh(), support.refresh()]);
    } finally {
      setPulling(false);
    }
  }, [tickets, support]);

  const newRequest = useCallback(
    (params?: { trip?: SupportTripPrefill; category?: string }) => navigation.navigate('SupportNewRequest', params),
    [navigation],
  );
  const onTrip = useCallback((trip: SupportTripPrefill) => newRequest({ trip }), [newRequest]);
  const onTopic = useCallback((slug: string | undefined) => newRequest(slug ? { category: slug } : undefined), [newRequest]);
  const onOpenTicket = useCallback((ticket: SupportTicket) => navigation.navigate('SupportTicket', { id: ticket.id }), [navigation]);
  const onChooseAnother = useCallback(() => {
    if (viewer === 'driver') navigation.navigate('RideHistory');
    else navigation.navigate('PassengerTabs', { screen: 'Activity', params: { segment: 'rides' } });
  }, [navigation, viewer]);

  const lastRide = rides.data?.[0] ?? null;

  return (
    <Screen testID="support-screen">
      <Header
        tone="background"
        title={t('support.title')}
        backLabel={t('support.back')}
        onBack={() => navigation.goBack()}
        testID="support-header"
      />
      <OfflineBanner style={styles.offline} testID="support-offline" />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + space[2], space[8]) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
        }
        testID="support-scroll"
      >
        {lastRide ? (
          <HelpTripSection ride={lastRide} viewer={viewer} onPress={onTrip} onChooseAnother={onChooseAnother} />
        ) : rides.status === 'loading' ? (
          <HelpTripPlaceholder />
        ) : null}
        <HelpTopicsGroup categories={categories.data} loading={categories.status === 'loading'} onPick={onTopic} />
        <HelpRequestsSection
          page={tickets.data}
          loading={tickets.status === 'loading'}
          failed={tickets.status === 'failed'}
          onRetry={tickets.reload}
          onNew={() => newRequest()}
          onOpen={onOpenTicket}
          onSeeAll={() => navigation.navigate('SupportRequests')}
        />
        <HelpContactGroup contacts={support.contacts} />
        <HelpEmergencyGroup />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  offline: { marginHorizontal: layout.gutter, marginBottom: space[2] },
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space[2],
    gap: layout.sectionGap,
  },
});
