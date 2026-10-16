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
import { registerDeviceToken, setPushAskHandler, syncPushRegistration } from './push';
import { resolveNotificationTarget, type NotificationRole } from './routing';
import {
  fetchUnreadCount,
  markNotificationRead,
  notificationsStale,
  type NotificationsState,
} from './slice';

type SliceRoot = { notifications: NotificationsState };
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
 *   (data.ride_id / category / type, see routing.ts).
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
      // Mounted by PassengerStack and DriverStack, which both register RideChat (T-510).
      openNotificationTarget(navigationRef.current, role, resolveNotificationTarget(payload, role), 'push', {
        chatThreadAvailable: true,
      });
    };

    syncPushRegistration({ prompt: false });
    setPushAskHandler(() => syncPushRegistration({ prompt: true }));

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
