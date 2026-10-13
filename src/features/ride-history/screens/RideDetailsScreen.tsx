import React, { useCallback } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Button, EmptyState, ErrorState, Header, Screen, SkeletonCard, SkeletonGroup } from '../../../components/ui';
import { componentTokens, layout, space } from '../../../theme';

const skeletonHeights = componentTokens.skeleton.heights;
import { openRideChat, type RideChatNavigator } from '../../chat/navigation';
import {
  CancellationCard,
  PersonCard,
  ReceiptCard,
  RouteCard,
  SummaryCard,
  TimelineCard,
} from '../components/RideDetailsSections';
import { RIDE_HISTORY_COPY } from '../copy';
import { canOpenChat, otherParty } from '../format';
import { RideRatingSection } from '../../rating/components/RideRatingSection';
import type { RideRatingState } from '../../rating/types';
import { useRideDetail, useRideViewer } from '../hooks';
import type { RideHistoryRoutes } from '../navigation';

/**
 * One ride for either role (T-501, shared-ride-details spec): GET /rides/{id} with the status,
 * times, route and stops, distance and duration, the other party (first name; the car for a
 * passenger; never a phone), the receipt from the server's fare breakdown (the driver also sees
 * the platform fee and their earnings), why it was cancelled, and "Message" while the ride's
 * chat can still be read. Opened from ride history, Earnings and wallet entries.
 */
export default function RideDetailsScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<RideChatNavigator & { goBack(): void }>();
  const { params } = useRoute<RouteProp<RideHistoryRoutes, 'RideDetails'>>();
  const viewer = useRideViewer();
  const { data, status, error, reload, refresh, setData } = useRideDetail(params.rideId, params.ride ?? null);

  const onMessage = useCallback(() => openRideChat(navigation, params.rideId), [navigation, params.rideId]);
  const shownRide = data?.kind === 'ride' ? data.ride : null;
  // T-505: a new rating (or the re-read after a 409) updates the ride shown here.
  const onRatingChange = useCallback(
    (state: RideRatingState) => {
      if (shownRide) setData({ kind: 'ride', ride: { ...shownRide, myRating: state.myRating, canRate: state.canRate } });
    },
    [setData, shownRide],
  );

  const header = (
    <Header
      tone="background"
      title={RIDE_HISTORY_COPY.detailsTitle}
      backLabel={RIDE_HISTORY_COPY.back}
      onBack={() => navigation.goBack()}
      testID="ride-details"
    />
  );

  if (!data || data.kind === 'unavailable') {
    let body: React.ReactNode;
    if (data?.kind === 'unavailable') {
      body = (
        <View style={styles.unavailable}>
          <EmptyState
            icon="rides"
            title={RIDE_HISTORY_COPY.unavailableTitle}
            body={RIDE_HISTORY_COPY.unavailableBody}
            testID="ride-details-unavailable"
          />
          <Button label={RIDE_HISTORY_COPY.goBack} variant="outline" fullWidth={false} onPress={() => navigation.goBack()} />
        </View>
      );
    } else if (status === 'failed') {
      body = (
        <ErrorState
          title={RIDE_HISTORY_COPY.detailsFailed}
          body={error ?? undefined}
          retryLabel={RIDE_HISTORY_COPY.retry}
          onRetry={reload}
          testID="ride-details-error"
        />
      );
    } else {
      body = (
        <SkeletonGroup testID="ride-details-loading" style={styles.skeleton}>
          <SkeletonCard height={skeletonHeights.rideSummary} />
          <SkeletonCard height={skeletonHeights.rideRoute} />
          <SkeletonCard height={skeletonHeights.rideReceipt} />
        </SkeletonGroup>
      );
    }
    return (
      <Screen testID="ride-details-screen">
        {header}
        {body}
      </Screen>
    );
  }

  const { ride } = data;
  const rated = otherParty(ride, viewer);

  return (
    <Screen
      scroll
      testID="ride-details-screen"
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={status === 'refreshing'}
          onRefresh={refresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      {header}
      <View style={styles.body}>
        {status === 'failed' && error ? (
          <AppText variant="bodySmall" color="danger" testID="ride-details-refresh-error">
            {error}
          </AppText>
        ) : null}
        <SummaryCard ride={ride} viewer={viewer} />
        <CancellationCard ride={ride} viewer={viewer} />
        <RouteCard ride={ride} />
        <PersonCard ride={ride} viewer={viewer} canMessage={canOpenChat(ride)} onMessage={onMessage} />
        <RideRatingSection
          rideId={ride.id}
          role={viewer}
          myRating={ride.myRating}
          canRate={ride.canRate}
          personName={rated?.name ?? null}
          photoUri={rated?.profileImageUrl ?? null}
          onChange={onRatingChange}
        />
        <ReceiptCard ride={ride} viewer={viewer} />
        <TimelineCard ride={ride} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space[8] },
  body: { paddingHorizontal: space[4], paddingTop: space[2], gap: space[3], width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center' },
  skeleton: { paddingHorizontal: space[4], paddingTop: space[2], gap: space[3] },
  unavailable: { flexGrow: 1, alignItems: 'center', paddingBottom: space[8] },
});
