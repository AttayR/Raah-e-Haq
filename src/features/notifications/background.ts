import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';

/**
 * FCM background/quit-state handler (T-502). Registered once from index.js, before the app
 * component, as React Native Firebase requires. The OS shows the notification itself; the
 * app re-reads the list and unread count when it comes to the foreground, and a tap is
 * routed by usePushNotifications (onNotificationOpenedApp / getInitialNotification).
 * It does no network work: there may be no signed-in session in a headless start.
 */
export const registerBackgroundPushHandler = (): void => {
  setBackgroundMessageHandler(getMessaging(), async () => undefined);
};
