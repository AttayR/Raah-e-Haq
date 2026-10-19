import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDispatch, useSelector } from 'react-redux';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import type { AppTheme } from '../../theme';
import type { DriverStackParamList } from '../../app/navigation/stacks/DriverStack';
import { useDriverLastLocation } from '../../features/driver-location/hooks';
import { useAppIsActive } from '../../hooks/useAppIsActive';
import {
  usePendingRidePolling,
  useRideRequestActions,
  useRideRequestFeed,
} from '../../features/driver-requests/hooks';
import { selectDriverRequestsState } from '../../features/driver-requests/slice';
import { selectDriverActiveRide } from '../../features/driver-ride/slice';
import { selectDriverIsOnline, selectDriverIsOnRide } from '../../features/driver-status/slice';
import { RideRequestPanel } from './IncomingRequestCard';
import { AutoAcceptedCard } from './AutoAcceptedCard';
import { useAutoAssignedRideWatch } from '../../features/driver-auto-accept/hooks';
import {
  dismissAutoAcceptedTakeover,
  selectAutoAcceptTakeoverRideId,
} from '../../features/driver-auto-accept/slice';
import {
  OFFER_VIEWED_DELAY_MS,
  reportOfferDeclined,
  reportOfferViewed,
} from '../../features/driver-auto-accept/offerReports';

type Props = {
  /** Distance from the bottom of the tab area to the panel: the tab bar when it shows, else the inset. */
  bottomOffset: number;
  /**
   * Called with true while a request (not an error) is on screen and false once it is gone, so
   * the tabs hide the tab bar and open the Drive map under it (§8.3).
   */
  onRequestShownChange?: (shown: boolean) => void;
};

/**
 * How many polls in a row have failed (0 after a good one). Counted when a poll finishes
 * (`isFetching` goes back to false).
 */
const useConsecutiveFeedFailures = (): number => {
  const { isFetching, loadStatus } = useSelector(selectDriverRequestsState);
  const [failures, setFailures] = useState(0);
  const wasFetching = useRef(isFetching);
  useEffect(() => {
    if (wasFetching.current && !isFetching) {
      setFailures((count) => (loadStatus === 'failed' ? count + 1 : 0));
    }
    wasFetching.current = isFetching;
  }, [isFetching, loadStatus]);
  return failures;
};

/**
 * Incoming ride requests for every driver tab (T-408). Mounted once, by DriverBottomTabs, so
 * GET /rides/pending is polled (T-403) whenever the driver is online, has no ride, the app is in
 * the foreground and the tabs are on screen, whichever tab is open. A request takes over the
 * Drive map (UI-R4, §8.3: the tabs switch to Drive and hide the tab bar through
 * `onRequestShownChange`). Accepting (T-404) opens the DriverRide screen. The position sent with
 * each poll is the location tracker's (T-402).
 */
export const RideRequestHost: React.FC<Props> = ({ bottomOffset, onRequestShownChange }) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<NativeStackNavigationProp<DriverStackParamList>>();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isFocused = useIsFocused();
  const location = useDriverLastLocation();
  usePendingRidePolling({ isFocused, location });
  const { view, retry } = useRideRequestFeed(location);
  const { acceptingId, accept, reject } = useRideRequestActions();

  const failures = useConsecutiveFeedFailures();
  const isOnline = useSelector(selectDriverIsOnline);
  const isOnRide = useSelector(selectDriverIsOnRide);
  const activeRide = useSelector(selectDriverActiveRide);
  const hasActiveRide = activeRide !== null;

  // T-587: a ride accepted for the driver (auto-accept) takes over the map until "Go to pickup".
  const dispatch = useDispatch();
  useAutoAssignedRideWatch();
  const takeoverRideId = useSelector(selectAutoAcceptTakeoverRideId);
  // Only while the ride is still at `accepted`: once the driver is on their way it is old news.
  const takeoverRide =
    takeoverRideId !== null && activeRide?.id === takeoverRideId && activeRide.status === 'accepted'
      ? activeRide
      : null;
  // The takeover the driver has had on screen (focused). One raised under a stack screen
  // (Wallet, Profile, ...) waits and shows when the tabs are focused again.
  const seenTakeoverId = useRef<number | null>(null);
  useEffect(() => {
    if (takeoverRideId === null) {
      seenTakeoverId.current = null;
      return;
    }
    // The ride ended, moved past `accepted` or was replaced: nothing to take over.
    if (takeoverRide === null) {
      dispatch(dismissAutoAcceptedTakeover());
      return;
    }
    if (isFocused) {
      seenTakeoverId.current = takeoverRideId;
    } else if (seenTakeoverId.current === takeoverRideId) {
      // Seen, then the driver left (DriverRide or another screen): over, it does not come back.
      dispatch(dismissAutoAcceptedTakeover());
    }
  }, [dispatch, takeoverRideId, takeoverRide, isFocused]);
  const goToPickup = useCallback(() => {
    dispatch(dismissAutoAcceptedTakeover());
    navigation.navigate('DriverRide');
  }, [dispatch, navigation]);

  // T-587 (§7.4): the driver turned the request down; the server stops offering it to them.
  const handleReject = useCallback(
    (rideId: number) => {
      reportOfferDeclined(rideId);
      reject(rideId);
    },
    [reject],
  );

  const handleAccept = useCallback(
    async (rideId: number) => {
      const ride = await accept(rideId);
      if (ride) {
        navigation.navigate('DriverRide');
      }
    },
    [accept, navigation],
  );

  // The first poll after going online can run before the tracker's first fix (422
  // LOCATION_REQUIRED); an error waits for a fix or a second failure in a row. Loading and
  // "no requests" are not shown here: the Drive sheet says "Looking for ride requests".
  const showError = location !== null || failures >= 2;
  const eligible = isFocused && isOnline && !isOnRide && !hasActiveRide;
  const takeoverShown = isFocused && takeoverRide !== null;
  const offerShown = eligible && view.kind === 'request';
  const requestShown = offerShown || takeoverShown;
  const visible = requestShown || (eligible && view.kind === 'error' && showError);

  // T-587 (§7.4): POST offer-viewed once the card has been on screen for 1 s (once per ride),
  // only with the app in the foreground (never for a card behind the lock screen).
  const appActive = useAppIsActive();
  const shownOfferId = appActive && offerShown && view.kind === 'request' ? view.request.id : null;
  useEffect(() => {
    if (shownOfferId === null) return undefined;
    const timer = setTimeout(() => {
      // Still in the foreground and visible (iOS `inactive`: Control Centre, lock screen).
      if (AppState.currentState === 'active') reportOfferViewed(shownOfferId);
    }, OFFER_VIEWED_DELAY_MS);
    return () => clearTimeout(timer);
  }, [shownOfferId]);

  const onShownRef = useRef(onRequestShownChange);
  onShownRef.current = onRequestShownChange;
  useEffect(() => {
    onShownRef.current?.(requestShown);
  }, [requestShown]);
  // Unmount (sign-out, a ride screen replacing the tabs): the tab bar comes back.
  useEffect(() => () => onShownRef.current?.(false), []);

  if (!visible) {
    return null;
  }

  const bottom = bottomOffset + theme.space[4];
  // T-552: the card is placed from the bottom; with several stops it must not grow past the top.
  const maxHeight = Math.max(0, windowHeight - insets.top - theme.space[4] - bottom);

  return (
    <View
      style={[styles.container, { bottom }]}
      pointerEvents="box-none"
      testID="ride-request-host"
    >
      {takeoverShown && takeoverRide ? (
        <AutoAcceptedCard ride={takeoverRide} driverLocation={location} onGo={goToPickup} />
      ) : (
        <RideRequestPanel
          view={view}
          maxHeight={maxHeight}
          acceptingId={acceptingId}
          onAccept={handleAccept}
          onReject={handleReject}
          onRetry={retry}
        />
      )}
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    // Positions the panel over the tab content; the card itself is themed (IncomingRequestCard).
    container: {
      position: 'absolute',
      left: theme.space[5],
      right: theme.space[5],
    },
  });

export default RideRequestHost;
