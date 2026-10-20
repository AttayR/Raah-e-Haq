import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDispatch, useSelector } from 'react-redux';
import type { DriverStackParamList } from '../../app/navigation/stacks/DriverStack';
import { haptics } from '../../core/haptics';
import { useDriverLastLocation } from '../../features/driver-location/hooks';
import { useAppIsActive } from '../../hooks/useAppIsActive';
import {
  usePendingRidePolling,
  useRideRequestActions,
  useRideRequestFeed,
  type RequestGoneKind,
} from '../../features/driver-requests/hooks';
import { useOfferClock, useOfferCountdown } from '../../features/driver-requests/countdown';
import { DRIVER_REQUESTS_COPY as COPY } from '../../features/driver-requests/copy';
import { selectDriverRequestsState, type DriverRequestsState } from '../../features/driver-requests/slice';
import { selectDriverActiveRide } from '../../features/driver-ride/slice';
import { selectDriverIsOnline, selectDriverIsOnRide } from '../../features/driver-status/slice';
import { useAutoAssignedRideWatch } from '../../features/driver-auto-accept/hooks';
import { dismissAutoAcceptedTakeover, selectAutoAcceptTakeoverRideId } from '../../features/driver-auto-accept/slice';
import {
  OFFER_VIEWED_DELAY_MS,
  reportOfferDeclined,
  reportOfferViewed,
} from '../../features/driver-auto-accept/offerReports';
import { componentTokens } from '../../theme';
import { formatMoney } from '../../utils/format';
import { AutoAcceptedCard, AutoAcceptedFooter, useAutoAcceptedAdvance } from './AutoAcceptedCard';
import { RequestSheet } from './request/RequestSheet';
import { RequestSheetContent } from './request/RequestSheetContent';
import { RequestFooter, RequestGoneContent } from './request/RequestParts';
import { useLingering } from './request/useLingering';

type Props = {
  /**
   * Called with true while a request (or the taken state, or the auto-accept takeover) is on
   * screen and false once it is gone, so the tabs hide the tab bar and open the Drive map (§8.3).
   */
  onRequestShownChange?: (shown: boolean) => void;
  /** The request sheet's height while shown (the Drive map frames the pins above it, R1). */
  onSheetHeightChange?: (height: number) => void;
  /**
   * The offer on screen (null for none, the taken state or the takeover), so the Drive map frames
   * that ride's pins and no other (R1).
   */
  onShownOfferChange?: (rideId: number | null) => void;
};

type Gone = { rideId: number; kind: RequestGoneKind };

/** Requests waiting behind the one on screen ("+N more"). */
const selectQueuedBehind = (state: { driverRequests: DriverRequestsState }): number =>
  Math.max(0, selectDriverRequestsState(state).items.length - 1);

/**
 * Incoming ride requests for every driver tab (T-408). Mounted once, by DriverBottomTabs, so
 * GET /rides/pending is polled (T-403) whenever the driver is online, has no ride, the app is in
 * the foreground and the tabs are on screen, whichever tab is open. UI-R11 (driver-incoming-
 * request § Request sheet v2): the request is the Drive sheet in its `request` form (RequestSheet)
 * with Decline + Accept and the decision countdown (`meta.offer_seconds`, else 20 s; at 0 it is a
 * decline). A 409 taken / gone swaps the content for 2 s; accepting (T-404) opens DriverRide.
 * Feed loading, empty and error states are the Drive sheet's subtitle (no card here). Keeps the
 * offer-viewed (1 s on screen) and offer-declined reports and the auto-accept takeover (T-587).
 */
export const RideRequestHost: React.FC<Props> = ({ onRequestShownChange, onSheetHeightChange, onShownOfferChange }) => {
  const navigation = useNavigation<NativeStackNavigationProp<DriverStackParamList>>();
  const { height: windowHeight } = useWindowDimensions();
  const compact = windowHeight < componentTokens.requestSheet.compactWindowHeight;

  const isFocused = useIsFocused();
  const location = useDriverLastLocation();
  usePendingRidePolling({ isFocused, location });
  const { view } = useRideRequestFeed(location);
  // A primitive: an unchanged poll does not re-render the sheet for the "+N more" badge.
  const moreCount = useSelector(selectQueuedBehind);
  const { acceptingId, accept, reject } = useRideRequestActions();

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

  // T-587 (§7.4): the driver turned the request down (or let it run out, R3); the server stops
  // offering it to them.
  const handleReject = useCallback(
    (rideId: number) => {
      reportOfferDeclined(rideId);
      reject(rideId);
    },
    [reject],
  );

  // R5: "Another driver took this ride" / "no longer available" in place for 2 s.
  const [gone, setGone] = useState<Gone | null>(null);
  useEffect(() => {
    if (!gone) return undefined;
    const timer = setTimeout(() => setGone(null), componentTokens.requestSheet.goneDismissMs);
    return () => clearTimeout(timer);
  }, [gone]);

  const handleAccept = useCallback(
    async (rideId: number) => {
      const ride = await accept(rideId, {
        onGone: kind => {
          haptics.notificationError();
          setGone({ rideId, kind });
        },
      });
      if (ride) {
        haptics.notificationSuccess();
        navigation.navigate('DriverRide');
      }
    },
    [accept, navigation],
  );

  const eligible = isFocused && isOnline && !isOnRide && !hasActiveRide;
  const takeoverShown = isFocused && takeoverRide !== null;
  const offer = eligible && view.kind === 'request' ? view.request : null;
  const goneShown = isFocused && gone !== null && !takeoverShown;
  const offerShown = !takeoverShown && !goneShown && offer !== null;
  const requestShown = takeoverShown || goneShown || offerShown;

  // T-587 (§7.4): POST offer-viewed once the request has been on screen for 1 s (once per ride),
  // only with the app in the foreground (never for a sheet behind the lock screen).
  const appActive = useAppIsActive();
  const shownOfferId = appActive && offerShown && offer ? offer.id : null;
  useEffect(() => {
    if (shownOfferId === null) return undefined;
    const timer = setTimeout(() => {
      // Still in the foreground and visible (iOS `inactive`: Control Centre, lock screen).
      if (AppState.currentState === 'active') reportOfferViewed(shownOfferId);
    }, OFFER_VIEWED_DELAY_MS);
    return () => clearTimeout(timer);
  }, [shownOfferId]);

  // R4 / R8: haptic and the arrival announcement once per request.
  const arrivedId = offerShown && offer ? offer.id : null;
  const offerRef = useRef(offer);
  offerRef.current = offer;
  useEffect(() => {
    const arrived = offerRef.current;
    if (arrivedId === null || !arrived) return;
    haptics.notificationWarning();
    const fare = arrived.estimatedFare !== null ? formatMoney(arrived.estimatedFare) : '';
    AccessibilityInfo.announceForAccessibility(
      arrived.estimatedPickupMin !== null
        ? COPY.arrivalA11y(fare, arrived.estimatedPickupMin)
        : COPY.arrivalNoEtaA11y(fare),
    );
  }, [arrivedId]);

  // R3: the clock starts once the sheet is fully up and the app is active; accepting pauses it;
  // at 0 the request counts as declined.
  const [sheetUp, setSheetUp] = useState(false);
  const clock = useOfferClock(
    offerShown ? offer : null,
    sheetUp && appActive,
    acceptingId !== null && acceptingId === offer?.id,
  );
  const announce = useOfferCountdown(clock, handleReject);
  useEffect(() => {
    if (announce !== null) AccessibilityInfo.announceForAccessibility(COPY.secondsLeftA11y(announce));
  }, [announce]);

  // R1: Android back declines (the same report) and never leaves the tab.
  useEffect(() => {
    if (!offerShown || !offer) return undefined;
    const rideId = offer.id;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleReject(rideId);
      return true;
    });
    return () => sub.remove();
  }, [handleReject, offer, offerShown]);

  const takeoverCountdown = useAutoAcceptedAdvance(takeoverShown && takeoverRide ? takeoverRide.id : null, goToPickup);

  // R1: the Drive map frames this ride (not the queue head, not the taken state).
  const framedOfferId = offerShown && offer ? offer.id : null;
  const onShownOfferRef = useRef(onShownOfferChange);
  onShownOfferRef.current = onShownOfferChange;
  useEffect(() => {
    onShownOfferRef.current?.(framedOfferId);
  }, [framedOfferId]);
  useEffect(() => () => onShownOfferRef.current?.(null), []);

  const onShownRef = useRef(onRequestShownChange);
  onShownRef.current = onRequestShownChange;
  useEffect(() => {
    onShownRef.current?.(requestShown);
  }, [requestShown]);
  // Unmount (sign-out, a ride screen replacing the tabs): the tab bar comes back.
  useEffect(() => () => onShownRef.current?.(false), []);

  let content: {
    key: string;
    body: React.ReactNode;
    footer: React.ReactNode;
  } | null = null;
  if (takeoverShown && takeoverRide) {
    content = {
      key: `takeover-${takeoverRide.id}`,
      body: <AutoAcceptedCard ride={takeoverRide} driverLocation={location} />,
      footer: <AutoAcceptedFooter onGo={goToPickup} countdown={takeoverCountdown} />,
    };
  } else if (goneShown && gone) {
    content = {
      key: `gone-${gone.rideId}`,
      body: <RequestGoneContent kind={gone.kind} />,
      footer: null,
    };
  } else if (offerShown && offer) {
    content = {
      key: `offer-${offer.id}`,
      body: <RequestSheetContent request={offer} moreCount={moreCount} compact={compact} />,
      footer: (
        <RequestFooter
          rideId={offer.id}
          onDecline={handleReject}
          onAccept={handleAccept}
          accepting={acceptingId === offer.id}
          disabled={acceptingId !== null}
          countdown={clock}
          announceSeconds={announce}
        />
      ),
    };
  }

  // D7: on decline, timeout or taken the sheet slides out with its last content.
  const lingering = useLingering(content);
  const { clear: clearLingering } = lingering;
  const onHidden = useCallback(() => {
    setSheetUp(false);
    clearLingering();
  }, [clearLingering]);
  const onShown = useCallback(() => setSheetUp(true), []);
  // The sheet starts leaving: a new offer arriving during the exit must wait for the next rise
  // before its clock starts.
  const contentVisible = content !== null;
  useEffect(() => {
    if (!contentVisible) setSheetUp(false);
  }, [contentVisible]);

  if (!lingering.value) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" testID="ride-request-host">
      <RequestSheet
        visible={content !== null}
        contentKey={lingering.value.key}
        footer={lingering.value.footer}
        onShown={onShown}
        onHidden={onHidden}
        onHeightChange={onSheetHeightChange}
        testID="ride-request-sheet"
      >
        {lingering.value.body}
      </RequestSheet>
    </View>
  );
};

export default RideRequestHost;
