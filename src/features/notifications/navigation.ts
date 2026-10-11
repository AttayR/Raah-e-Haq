import {
  CommonActions,
  type NavigationProp,
  type NavigationState,
  type ParamListBase,
  type PartialState,
} from '@react-navigation/native';
import type { NotificationRole, NotificationTarget } from './routing';

/**
 * Route name of the per-ride chat thread (T-510, in progress). Until a navigator registers a
 * screen with this name, chat notifications open the role's Chat tab instead.
 * T-510: register `RideChat` with params `{ rideId: number }` in PassengerStack and DriverStack.
 */
export const CHAT_THREAD_ROUTE = 'RideChat';

export type NotificationNavigation = Pick<NavigationProp<ParamListBase>, 'dispatch' | 'getState' | 'getParent'>;

type AnyState = NavigationState | PartialState<NavigationState>;

/** True when a navigator anywhere in this state tree registers `name`. */
export const hasRoute = (state: AnyState | undefined, name: string): boolean => {
  if (!state) return false;
  if (state.routeNames?.includes(name)) return true;
  return state.routes.some((route) => hasRoute(route.state as AnyState | undefined, name));
};

const rootOf = (navigation: NotificationNavigation): NotificationNavigation => {
  let current: NotificationNavigation = navigation;
  let parent = current.getParent();
  while (parent) {
    current = parent;
    parent = current.getParent();
  }
  return current;
};

type Nested = { screen: string; params?: object; initial?: boolean };

const ROLE_ROOT: Record<NotificationRole, string> = { passenger: 'Passenger', driver: 'Driver' };
const ROLE_TABS: Record<NotificationRole, string> = { passenger: 'PassengerTabs', driver: 'DriverTabs' };

const tab = (role: NotificationRole, name: string): Nested => ({ screen: ROLE_TABS[role], params: { screen: name } });

/** The nested route (inside the role's root stack) for a target. */
export const routeForTarget = (
  role: NotificationRole,
  target: NotificationTarget,
  chatThreadAvailable: boolean,
): Nested => {
  switch (target.kind) {
    case 'chat':
      return chatThreadAvailable
        ? { screen: CHAT_THREAD_ROUTE, params: { rideId: target.rideId } }
        : tab(role, 'Chat');
    case 'ride':
      // initial: false keeps the tabs underneath, so Back returns to them.
      return role === 'passenger'
        ? { screen: 'PassengerMap', initial: false }
        : { screen: 'DriverRide', initial: false };
    case 'rideHistory':
      return role === 'passenger' ? { screen: 'RideHistory', initial: false } : tab(role, 'Home');
    case 'rideRequests':
      return tab(role, 'Map');
    case 'home':
      return tab(role, 'Home');
    case 'inbox':
    default:
      return tab(role, 'Notifications');
  }
};

/**
 * Opens a notification's target from anywhere in the signed-in app (a list row or a push).
 * From the list, an `inbox` target stays on the list.
 */
export const openNotificationTarget = (
  navigation: NotificationNavigation,
  role: NotificationRole,
  target: NotificationTarget,
  source: 'list' | 'push',
): void => {
  if (source === 'list' && target.kind === 'inbox') return;
  const root = rootOf(navigation);
  const nested = routeForTarget(role, target, hasRoute(root.getState() as AnyState | undefined, CHAT_THREAD_ROUTE));
  root.dispatch(CommonActions.navigate({ name: ROLE_ROOT[role], params: nested }));
};
