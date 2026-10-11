import { useSelector } from 'react-redux';
import {
  selectNotificationsState,
  type NotificationsState,
} from '../features/notifications/slice';

const noop = (): void => undefined;

/**
 * @deprecated Compatibility shim for PassengerHomeScreen and PassengerMapScreen until their
 * redesign drops it (T-604). It only reads the notifications slice: it never fetches,
 * subscribes or clears anything, so mounting it more than once costs no requests (PAX-17,
 * QA T-104). The unread count is owned by useNotificationsSync (PassengerStack); a bell uses
 * `useUnreadNotificationCount` or `NotificationBell` from src/features/notifications.
 * The old no-op `send*Notification` functions are gone: the backend sends notifications.
 */
export const usePassengerNotifications = (_passengerId?: string) => {
  const { items, unreadCount, status } = useSelector(
    (state: { notifications: NotificationsState }) => selectNotificationsState(state),
  );
  return {
    isInitialized: true,
    notifications: items,
    unreadCount,
    isLoading: status === 'loading',
    subscribeToPassengerNotifications: noop,
    unsubscribeFromPassengerNotifications: noop,
  };
};

export default usePassengerNotifications;
