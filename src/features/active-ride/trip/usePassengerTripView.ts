import { useContext, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { rideProgressStep, type PersonAction } from '../../../components/ui';
import { componentTokens } from '../../../theme';
import type { DriverLocation, RideResource } from '../../../services/rideService';
import { t } from '../../../i18n';
import { CHAT_COPY } from '../../chat/copy';
import { openRideChat, type RideChatNavigator } from '../../chat/navigation';
import { rideChatUnread, unreadBadgeCount, withUnreadA11y } from '../../chat/rideUnread';
import { ridePinOf } from '../../safety/rules';
import { toOverchargeState } from '../../fare/api';
import { isAcRide, toAcReportState } from '../../ac/api';
import { parcelOf } from '../../parcel/api';
import type { ParcelView } from '../../parcel/types';
import { ACTIVE_RIDE_COPY } from '../copy';
import { canPassengerCancel, driverCardOf, type DriverCardInfo, type PassengerRideStage } from '../stage';
import { locationAgeSeconds, passengerTripHeader, tripFareOf, tripStopsOf, type TripHeader, type TripStop } from './tripModel';

/** The RideProgress step per stage (§5.24, TS4): on the way 2, arrived 3, on trip 4 (0-based 1…3). */
const STAGE_STEP: Partial<Record<PassengerRideStage, number>> = {
  driver_en_route: 1,
  driver_arrived: 2,
  in_trip: 3,
};

export type PassengerTripView = {
  stage: PassengerRideStage;
  ride: RideResource | null;
  header: TripHeader;
  /** Assigned driver card (live stages only). */
  driver: DriverCardInfo | null;
  /** BE-81 start PIN while the server sends it. */
  pin: string | null;
  /** The fare to pay (TS6.2) and whether it is locked (BE-82). */
  fare: number | null;
  fixed: boolean;
  step: number | null;
  stops: TripStop[];
  parcel: ParcelView | null;
  ac: boolean;
  overcharge: ReturnType<typeof toOverchargeState> | null;
  acReport: ReturnType<typeof toAcReportState> | null;
  canCancel: boolean;
  /** Window under 700 pt (iPhone SE): the fare row moves to the details (PA1, PT1). */
  compact: boolean;
};

export type TripViewOptions = {
  offline?: boolean;
  /** Seconds since the driver's last position (null: unknown). */
  locationAge?: number | null;
  /** The clock (ms) for "Arriving at"; defaults to now. */
  now?: number;
};

/** Everything the trip sheet shows for one stage, from the ride the poll already reads. */
export const passengerTripView = (
  stage: PassengerRideStage,
  ride: RideResource | null,
  { offline = false, locationAge = null, now = Date.now() }: TripViewOptions,
  compact: boolean,
): PassengerTripView => {
  const live = stage === 'driver_en_route' || stage === 'driver_arrived' || stage === 'in_trip';
  const hasDriver = live && !!ride?.driver;
  const parcel = parcelOf(ride);
  const ac = isAcRide(ride);
  return {
    stage,
    ride,
    header: passengerTripHeader({ stage, ride, parcel, offline, locationAge, now }),
    driver: hasDriver && ride ? driverCardOf(ride) : null,
    pin: hasDriver ? ridePinOf(ride) : null,
    fare: tripFareOf(ride),
    fixed: ride?.fare_locked === true,
    step: STAGE_STEP[stage] ?? (ride && live ? rideProgressStep(ride.status) : null),
    stops: tripStopsOf(ride),
    parcel,
    ac,
    overcharge: ride ? toOverchargeState(ride.overcharge_report) : null,
    acReport: ride && ac ? toAcReportState(ride.ac_report) : null,
    canCancel: canPassengerCancel(stage),
    compact,
  };
};

const STALE_AFTER = componentTokens.tripSheet.staleLocationSeconds;

/**
 * `passengerTripView` with the compact layout from the window height. The driver's position age
 * is read at each render (the screen renders on every ~4 s location read) and counted in whole
 * minutes once it is stale. "Arriving at" is recomputed on each read.
 */
export const usePassengerTripView = (
  stage: PassengerRideStage,
  ride: RideResource | null,
  options: { offline?: boolean; driverLocation?: Pick<DriverLocation, 'last_seen_at'> | null },
): PassengerTripView => {
  const { height } = useWindowDimensions();
  const compact = height < componentTokens.tripSheet.compactHeight;
  const { offline = false, driverLocation = null } = options;
  const age = locationAgeSeconds(driverLocation, Date.now());
  // 0 while fresh (or unknown), else the whole minutes it is old (at least 1).
  const staleMinutes = age !== null && age > STALE_AFTER ? Math.max(1, Math.floor(age / 60)) : 0;
  // Built on each render (pure and cheap), so the words also follow a language switch at once.
  return passengerTripView(stage, ride, { offline, locationAge: staleMinutes > 0 ? staleMinutes * 60 + 1 : null }, compact);
};

type ActionOptions = {
  /** A masked call (T-520, BE-78 `contact.can_call`); no Call action without it. */
  onCall?: () => void;
  calling?: boolean;
  /** The Share trip action (TS5.1), or null. */
  share?: PersonAction | null;
};

/**
 * Call · Message · Share (TS5): a missing one leaves the others sharing the width. The Message
 * badge is the ride read's BE-136 `chat.unread_count` (no `/chats` poll, TS11); none without it.
 */
export const usePassengerTripActions = (view: PassengerTripView, { onCall, calling = false, share = null }: ActionOptions): PersonAction[] => {
  // Context, not useNavigation (which throws outside a navigator): no navigator, no Message.
  const navigation: RideChatNavigator | undefined = useContext(NavigationContext);
  const { driver, ride } = view;
  const rideId = ride?.id ?? null;
  const driverName = driver?.name ?? null;
  const hasDriver = driver !== null;
  const unread = rideChatUnread(ride);
  return useMemo(() => {
    const actions: PersonAction[] = [];
    if (!hasDriver) return actions;
    if (onCall) {
      actions.push({
        key: 'call',
        icon: 'phone',
        label: calling ? t('safety.calling') : ACTIVE_RIDE_COPY.call,
        accessibilityHint: t('safety.callA11yHint'),
        onPress: onCall,
        disabled: calling,
        testID: 'driver-call-button',
      });
    }
    if (navigation && rideId !== null) {
      actions.push({
        key: 'message',
        icon: 'chat',
        label: CHAT_COPY.message,
        accessibilityLabel: withUnreadA11y(CHAT_COPY.messageA11y(driverName ?? ACTIVE_RIDE_COPY.driverFallbackName), unread),
        badgeCount: unreadBadgeCount(unread),
        onPress: () => openRideChat(navigation, rideId, driverName),
        testID: 'ride-chat-button',
      });
    }
    if (share) actions.push(share);
    return actions;
  }, [calling, driverName, hasDriver, navigation, onCall, rideId, share, unread]);
};
