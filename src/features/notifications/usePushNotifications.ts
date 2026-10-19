import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
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
import { focusedChatRideId, openNotificationTarget } from './navigation';
import { promptForPushWithPrimer, registerDeviceToken, setPushAskHandler, syncPushRegistration } from './push';
import { resolveNotificationTarget, type NotificationRole } from './routing';
import {
  fetchUnreadCount,
  markNotificationRead,
  notificationsStale,
  type NotificationsState,
} from './slice';
import { refetchActiveRideForPush, type ActiveRideState } from '../active-ride/slice';

type SliceRoot = {
  notifications: NotificationsState;
  activeRide: ActiveRideState;
  apiAuth?: { user: { id: number } | null };
};
type NotificationsDispatch = ThunkDispatch<SliceRoot, unknown, UnknownAction>;
type RemoteMessage = FirebaseMessagingTypes.RemoteMessage;

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
  }, [dispatch, role]);
};
