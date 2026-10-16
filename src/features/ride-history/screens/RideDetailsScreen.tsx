import React, { useCallback } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import {
  AppText,
  Button,
  EmptyState,
  ErrorState,
  Header,
  Screen,
  SkeletonCard,
  SkeletonGroup,
  useHeaderScroll,
} from '../../../components/ui';
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
import { OverchargeReportSection } from '../../fare/components/OverchargeReport';
import { AcReportSection } from '../../ac/components/AcReportSection';
import { SafetyReportSection } from '../../women-mode/components/SafetyReportSection';
import { ParcelReceiptCard } from '../../parcel/components/ParcelReceiptCard';
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

  // The header stays above the scrolling content, so Back is always reachable (T-543).
  const { scrollY, onScroll } = useHeaderScroll();
  const header = (
    <Header
      tone="background"
      title={RIDE_HISTORY_COPY.detailsTitle}
      backLabel={RIDE_HISTORY_COPY.back}
      onBack={() => navigation.goBack()}
      scrollY={scrollY}
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
    <Screen testID="ride-details-screen">
      {header}
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        testID="ride-details-scroll"
        refreshControl={
          <RefreshControl
            refreshing={status === 'refreshing'}
            onRefresh={refresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        <View style={styles.body}>
          {status === 'failed' && error ? (
            <AppText variant="bodySmall" color="danger" testID="ride-details-refresh-error">
              {error}
            </AppText>
          ) : null}
          <SummaryCard ride={ride} viewer={viewer} />
          <CancellationCard ride={ride} viewer={viewer} />
          <RouteCard ride={ride} />
          {ride.parcel ? (
            // BE-88 / T-559: the parcel's outcome, item, masked receiver, its steps and the photo.
            <ParcelReceiptCard parcel={ride.parcel} times={ride} />
          ) : null}
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
          {viewer === 'passenger' ? (
            // BE-82: "Driver asked for more?" for 24 h after the ride, then the report's status.
            <OverchargeReportSection
              rideId={ride.id}
              state={ride.overcharge}
              fare={ride.fareLock?.acceptedFare ?? ride.totalFare}
              onReported={() => {
                refresh();
              }}
              testID="ride-details-overcharge"
            />
          ) : null}
          {viewer === 'passenger' && ride.acReport ? (
            // BE-86: "AC not working?" on an AC ride, then the report's refund status.
            <AcReportSection rideId={ride.id} state={ride.acReport} onReported={() => refresh()} testID="ride-details-ac-report" />
          ) : null}
          <ReceiptCard ride={ride} viewer={viewer} />
          {/* A parcel's steps are on its own card (picked up / delivered, not started / completed). */}
          {ride.parcel ? null : <TimelineCard ride={ride} />}
          {viewer === 'passenger' && ride.safetyReport ? (
            // BE-87 / BE-105: a women's-safety report while the server allows it, then its status.
            <SafetyReportSection rideId={ride.id} state={ride.safetyReport} onReported={() => refresh()} testID="ride-details-safety-report" />
          ) : null}
        </View>
      </Animated.ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: space[8] },
  body: { paddingHorizontal: space[4], paddingTop: space[2], gap: space[3], width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center' },
  skeleton: { paddingHorizontal: space[4], paddingTop: space[2], gap: space[3] },
  unavailable: { flexGrow: 1, alignItems: 'center', paddingBottom: space[8] },
});
