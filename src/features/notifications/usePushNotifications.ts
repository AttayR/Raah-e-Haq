import { useEffect, useRef } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import {
  getInitialNotification,
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import { toast } from '../../core/toast';
import { logger } from '../../core/logging/logger';
import { toPushPayload } from './api';
import { NOTIFICATIONS_COPY } from './copy';
import { focusedChatRideId, focusedChildOf, openNotificationTarget } from './navigation';
import { promptForPushWithPrimer, registerDeviceToken, setPushAskHandler, syncPushRegistration } from './push';
import { resolveNotificationTarget, type NotificationRole } from './routing';
import {
  fetchUnreadCount,
  markNotificationRead,
  notificationsStale,
  type NotificationsState,
} from './slice';
import { refetchActiveRideForPush, type ActiveRideState } from '../active-ride/slice';
import { confirmPassengerLiveRide } from './liveRideTarget';
import { loadDriverStatus, type DriverStatusState } from '../driver-status/slice';
import {
  selectAutoAcceptActive,
  selectAutoAcceptTakeoverRideId,
  type AutoAcceptState,
} from '../driver-auto-accept/slice';

type SliceRoot = {
  notifications: NotificationsState;
  activeRide: ActiveRideState;
  driverStatus: DriverStatusState;
  driverAutoAccept?: AutoAcceptState;
  apiAuth?: { user: { id: number } | null };
};
type NotificationsDispatch = ThunkDispatch<SliceRoot, unknown, UnknownAction>;
type RemoteMessage = FirebaseMessagingTypes.RemoteMessage;

/** The driver's tab navigator route (DriverStack), where the auto-accept takeover shows. */
const DRIVER_TABS_ROUTE = 'DriverTabs';
/** The root route that holds DriverStack (RootNavigation). */
const DRIVER_STACK_ROUTE = 'Driver';

/** The push that cold-started the app is routed once per process. */
let initialNotificationChecked = false;

/** Tests only. */
export const __resetInitialNotificationForTests = (): void => {
  initialNotificationChecked = false;
};

/**
 * FCM for the signed-in app (T-502), mounted once per role stack:
 * - registers the device (POST /devices) when permission is already granted, and again on
 *   onTokenRefresh; the contextual prompt is enabled through setPushAskHandler;
 * - a foreground push shows the in-app toast (with "View") and refreshes the badge and list;
 *   a chat push for the thread that is on screen shows nothing and marks its row read (T-544);
 * - a tapped push (background or cold start) marks its row read and opens its target
 *   (data.ride_id / category / type / ride_status / requeued, see routing.ts); a passenger's
 *   live ride is re-read from the server on the way (T-546).
 * Every listener is removed on unmount (sign-out).
 */
export const usePushNotifications = (role: NotificationRole): void => {
  const dispatch = useDispatch<NotificationsDispatch>();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;
  const store = useStore<SliceRoot>();

  useEffect(() => {
    const messaging = getMessaging();

    const markReadAndCount = (notificationId: number | null) => {
      if (notificationId !== null) {
        dispatch(markNotificationRead(notificationId)).then(() => dispatch(fetchUnreadCount()));
      } else {
        dispatch(fetchUnreadCount());
      }
    };

    const open = (message: RemoteMessage | null) => {
      if (!message) return;
      const payload = toPushPayload(message.data);
      dispatch(notificationsStale());
      markReadAndCount(payload.notificationId);
      const target = resolveNotificationTarget(payload, role);
      // T-583 (BE-114): "No driver found" opens the booking screen only while it still shows that
      // ride's outcome; otherwise the ride's details.
      if (role === 'passenger' && payload.noDriver && target.kind === 'ride') {
        confirmPassengerLiveRide(target, { getState: store.getState, dispatch, subscribe: store.subscribe })
          .then((confirmed) => openNotificationTarget(navigationRef.current, role, confirmed, 'push', { chatThreadAvailable: true }))
          .catch((error: unknown) => logger.debug('No-driver push: could not open the ride', error instanceof Error ? error.name : 'unknown'));
        return;
      }
      // T-546: the live ride screen shows the server's ride, not what the push said (e.g. a
      // requeued cancel is "finding a driver" again).
      if (role === 'passenger' && target.kind === 'ride') dispatch(refetchActiveRideForPush(target.rideId));
      // Mounted by PassengerStack and DriverStack, which both register RideChat (T-510).
      openNotificationTarget(navigationRef.current, role, target, 'push', {
        chatThreadAvailable: true,
      });
    };

    syncPushRegistration({ prompt: false });
    // UI-R8: the pre-prompt page before the OS prompt (once).
    setPushAskHandler(promptForPushWithPrimer);

    const unsubscribeRefresh = onTokenRefresh(messaging, (token) => {
      registerDeviceToken(token);
    });

    const unsubscribeMessage = onMessage(messaging, (message) => {
      dispatch(notificationsStale());
      const payload = toPushPayload(message.data);
      const target = resolveNotificationTarget(payload, role);
      // T-544: that ride's chat thread is on screen (it polls the message in), so no banner, and
      // the row is read already.
      if (target.kind === 'chat' && focusedChatRideId(navigationRef.current) === target.rideId) {
        markReadAndCount(payload.notificationId);
        return;
      }
      dispatch(fetchUnreadCount());
      // T-587: a ride assigned to the driver (auto-accept, or an admin): read the status now so
      // the ride is restored (and the "Ride accepted for you" takeover opens) without waiting
      // for the next request poll.
      if (role === 'driver' && payload.type === 'driver_assigned') {
        dispatch(loadDriverStatus());
        // T-587: the takeover says it, so no toast too, but only when it can show now: one is
        // already up, or auto-accept is on and the tabs (where it shows) are the focused screen.
        // Under a stack screen (Wallet, Profile, ...) the toast with "View" is the visible notice.
        const state = store.getState();
        const takeoverUp = selectAutoAcceptTakeoverRideId(state) !== null;
        const top = focusedChildOf(navigationRef.current, DRIVER_STACK_ROUTE);
        // `undefined`: the driver stack is still on its first screen, the tabs.
        const tabsFocused = top === undefined || top === DRIVER_TABS_ROUTE;
        const takeoverCanShow = selectAutoAcceptActive(state) && tabsFocused;
        if (takeoverUp || takeoverCanShow) return;
      }
      // The driver's request card already shows a new request on every tab.
      if (role === 'driver' && payload.type === 'new_ride_request') return;
      const title = message.notification?.title?.trim() || '';
      const body = message.notification?.body?.trim() || '';
      if (!title && !body) return;
      toast.info(title || body, title ? body || undefined : undefined, {
        action: { label: NOTIFICATIONS_COPY.pushView, onPress: () => open(message) },
      });
    });

    const unsubscribeOpened = onNotificationOpenedApp(messaging, open);

    if (!initialNotificationChecked) {
      initialNotificationChecked = true;
      getInitialNotification(messaging)
        .then(open)
        .catch((error: unknown) => {
          logger.warn('notifications - initial notification unavailable', {
            name: error instanceof Error ? error.name : typeof error,
          });
        });
    }

    return () => {
      unsubscribeRefresh();
      unsubscribeMessage();
      unsubscribeOpened();
      setPushAskHandler(null);
    };
  }, [dispatch, role, store]);
};
