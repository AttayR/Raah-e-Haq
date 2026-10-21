import React, { useCallback, useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { haptics } from '../../core/haptics';
import { toastClearance } from '../../core/toast';
import type { PendingRideRequest } from '../../features/driver-requests/api';
import { offerDurationMs, useOfferClock, useOfferCountdown } from '../../features/driver-requests/countdown';
import { DRIVER_REQUESTS_COPY as COPY } from '../../features/driver-requests/copy';
import { useOfferSession } from '../../features/driver-requests/offerSession';
import { dismissRideRequest, type DriverRequestsState } from '../../features/driver-requests/slice';
import { selectDriverActiveRide } from '../../features/driver-ride/slice';
import { selectDriverIsOnline, selectDriverIsOnRide } from '../../features/driver-status/slice';
import {
  OFFER_VIEWED_DELAY_MS,
  reportOfferDeclined,
  reportOfferViewed,
} from '../../features/driver-auto-accept/offerReports';
import { useAppIsActive } from '../../hooks/useAppIsActive';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { componentTokens, layout, motionPatterns, radius, space } from '../../theme';
import { formatDistance, formatMoney } from '../../utils/format';
import { AppText, type TextColor } from '../ui/AppText';
import { CountdownRing } from '../ui/CountdownRing';
import { Icon } from '../ui/Icon';

/** The feed's head (the request the Drive sheet would show). */
const selectHeadRequest = (state: { driverRequests: DriverRequestsState }): PendingRideRequest | null =>
  state.driverRequests.items[0] ?? null;

const m = motionPatterns.toast;
const ENTER_EASING = Easing.bezier(0.2, 0, 0, 1);

type Props = {
  /** Opens the Drive tab, where the request sheet takes over (same clock). */
  onOpen: () => void;
};

/**
 * T-708 (QA 2026-10-21 question 6): an incoming request while the driver is online and the Drive
 * tab is not on screen (another tab, or a driver screen such as Wallet or Profile). Mounted by
 * DriverRequestLayer only then; it draws nothing while offline, on a ride or with no request.
 * One request at a time (the feed's head), keyed by ride so each request enters on its own.
 */
export function IncomingRequestBanner({ onOpen }: Props) {
  const request = useSelector(selectHeadRequest);
  const isOnline = useSelector(selectDriverIsOnline);
  const isOnRide = useSelector(selectDriverIsOnRide);
  const hasActiveRide = useSelector(selectDriverActiveRide) !== null;
  if (!request || !isOnline || isOnRide || hasActiveRide) {
    return null;
  }
  return <IncomingRequestBannerCard key={request.id} request={request} onOpen={onOpen} />;
}

/** The fare, "You keep" and pickup distance, from the feed only (never computed here). */
const bannerParts = (request: PendingRideRequest) => {
  const fare = request.estimatedFare !== null ? formatMoney(request.estimatedFare) : null;
  const net = request.driverNet !== null ? formatMoney(request.driverNet) : null;
  const distance = request.estimatedDistanceKm !== null ? formatDistance(request.estimatedDistanceKm) : null;
  return { fare, net, distance };
};

function IncomingRequestBannerCard({ request, onOpen }: { request: PendingRideRequest; onOpen: () => void }) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const reduce = useReducedMotion();
  const appActive = useAppIsActive();
  const session = useOfferSession();
  const rideId = request.id;

  const { fare, net, distance } = bannerParts(request);
  const details = [net ? COPY.youKeepNoRate(net) : null, distance ? `${distance} ${COPY.metricToPickup}` : null]
    .filter((part): part is string => part !== null)
    .join(' · ');
  const label = [
    fare ? COPY.arrivalNoEtaA11y(fare) : COPY.bannerTitle,
    net ? COPY.youKeepNoRate(net) : null,
    distance ? COPY.metricToPickupA11y(distance) : null,
  ]
    .filter((part): part is string => part !== null)
    .join(', ');

  // The decision clock (`meta.offer_seconds`, else 20 s), shared with the Drive sheet; at 0 the
  // request counts as declined, the same as on the sheet (R3).
  const clock = useOfferClock(request, appActive, false, session);
  const decline = useCallback(
    (id: number) => {
      reportOfferDeclined(id);
      dispatch(dismissRideRequest(id));
    },
    [dispatch],
  );
  useOfferCountdown(clock, decline);

  // Haptic and one announcement per request (never again when the sheet or a remount shows it).
  const labelRef = useRef(label);
  labelRef.current = label;
  const requestRef = useRef(request);
  requestRef.current = request;
  useEffect(() => {
    if (!(session?.claimAlert(rideId) ?? true)) return;
    haptics.notificationWarning();
    const seconds = Math.ceil(offerDurationMs(requestRef.current, Date.now()) / 1000);
    AccessibilityInfo.announceForAccessibility(`${labelRef.current}. ${COPY.secondsLeftA11y(seconds)}`);
  }, [rideId, session]);

  // T-587 (§7.4): seen for 1 s in the foreground counts as viewed (once per ride).
  useEffect(() => {
    if (!appActive) return undefined;
    const timer = setTimeout(() => {
      if (AppState.currentState === 'active') reportOfferViewed(rideId);
    }, OFFER_VIEWED_DELAY_MS);
    return () => clearTimeout(timer);
  }, [appActive, rideId]);

  // Toast motion (§5.16): −16 → 0 and fade in; reduced motion fades only.
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(reduce ? 0 : m.in.translateY)).current;
  useEffect(() => {
    const enter = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: m.in.duration, easing: ENTER_EASING, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: m.in.duration, easing: ENTER_EASING, useNativeDriver: true }),
    ]);
    enter.start();
    return () => enter.stop();
  }, [opacity, translateY]);

  // A Toast shown meanwhile sits below the banner, never over it (cleared when it leaves).
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    toastClearance.set(event.nativeEvent.layout.height + space[2]);
  }, []);
  useEffect(() => () => toastClearance.set(0), []);

  // Always an inverse surface, like the Toast: readable over any screen in both modes.
  const dark = theme.mode === 'dark';
  const fill = dark ? theme.colors.surfaceRaised : theme.colors.textPrimary;
  const ink: TextColor = dark ? 'textPrimary' : 'textInverse';

  return (
    <Animated.View
      testID="incoming-request-banner"
      onLayout={onLayout}
      style={[
        styles.container,
        { top: insets.top + space[2] + componentTokens.header.barHeight },
        theme.elevation[4],
        { backgroundColor: fill, opacity, transform: [{ translateY }] },
        dark ? { borderWidth: theme.borderWidth.thin, borderColor: theme.colors.border } : null,
      ]}
    >
      <Pressable
        onPress={onOpen}
        style={styles.body}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={COPY.bannerHint}
        testID="incoming-request-banner-open"
      >
        {clock ? (
          <CountdownRing
            startedAt={clock.startedAt}
            durationMs={clock.durationMs}
            color={ink}
            testID="incoming-request-banner-countdown"
          />
        ) : (
          <View style={styles.ringSpace} />
        )}
        <View style={styles.text}>
          <AppText variant="label" color={ink} numberOfLines={1}>
            {COPY.bannerTitle}
          </AppText>
          {fare ? (
            <AppText variant="numericL" color={ink} numberOfLines={1} testID="incoming-request-banner-fare">
              {fare}
            </AppText>
          ) : null}
          {details ? (
            <AppText variant="bodySmall" color={ink} numberOfLines={2} testID="incoming-request-banner-details">
              {details}
            </AppText>
          ) : null}
        </View>
        <Icon name="chevronEnd" size={componentTokens.toast.iconSize} color={ink} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    start: layout.gutter,
    end: layout.gutter,
    borderRadius: radius.md,
    zIndex: 1000,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: componentTokens.toast.minHeight,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  ringSpace: { width: componentTokens.countdownRing.size, height: componentTokens.countdownRing.size },
  text: { flex: 1, minWidth: 0 },
});
