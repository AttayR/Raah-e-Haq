/**
 * T-502: opening a notification (row or push) goes to the right place per role; chat rows
 * open the ride's thread when T-510's `RideChat` route exists and the Chat tab until then.
 */
import { CommonActions } from '@react-navigation/native';
import { resolveNotificationTarget } from '../../../src/features/notifications/routing';
import {
  CHAT_THREAD_ROUTE,
  hasRoute,
  openNotificationTarget,
  routeForTarget,
  type NotificationNavigation,
} from '../../../src/features/notifications/navigation';
import { formatNotificationTime } from '../../../src/features/notifications/format';

describe('resolveNotificationTarget', () => {
  it('chat with a ride id opens the thread (both roles)', () => {
    expect(resolveNotificationTarget({ category: 'chat', type: 'chat_message', rideId: 7 }, 'passenger')).toEqual({
      kind: 'chat',
      rideId: 7,
    });
    expect(resolveNotificationTarget({ category: 'system', type: 'chat_message', rideId: 7 }, 'driver').kind).toBe('chat');
  });

  it('passenger ride events open the ride; ended rides open history', () => {
    expect(resolveNotificationTarget({ category: 'ride', type: 'driver_arrived', rideId: 3 }, 'passenger')).toEqual({
      kind: 'ride',
      rideId: 3,
    });
    expect(resolveNotificationTarget({ category: 'ride', type: 'ride_completed', rideId: 3 }, 'passenger').kind).toBe(
      'rideHistory',
    );
  });

  it('driver: new request opens the request feed; a cancelled ride opens Home; a stop change opens the ride', () => {
    expect(resolveNotificationTarget({ category: 'ride', type: 'new_ride_request', rideId: 3 }, 'driver').kind).toBe(
      'rideRequests',
    );
    expect(resolveNotificationTarget({ category: 'ride', type: 'ride_cancelled', rideId: 3 }, 'driver').kind).toBe('home');
    expect(resolveNotificationTarget({ category: 'ride', type: 'stop_added', rideId: 3 }, 'driver').kind).toBe('ride');
  });

  it('promo, wallet, system and chat without a ride stay on the list', () => {
    (['promo', 'wallet', 'system'] as const).forEach((category) => {
      expect(resolveNotificationTarget({ category, type: null, rideId: 1 }, 'passenger').kind).toBe('inbox');
    });
    expect(resolveNotificationTarget({ category: 'chat', type: 'chat_message', rideId: null }, 'passenger').kind).toBe(
      'inbox',
    );
  });
});

describe('routeForTarget', () => {
  it('chat falls back to the Chat tab until RideChat is registered', () => {
    expect(routeForTarget('passenger', { kind: 'chat', rideId: 7 }, false)).toEqual({
      screen: 'PassengerTabs',
      params: { screen: 'Chat' },
    });
    expect(routeForTarget('driver', { kind: 'chat', rideId: 7 }, true)).toEqual({
      screen: CHAT_THREAD_ROUTE,
      params: { rideId: 7 },
    });
  });

  it('maps rides per role', () => {
    expect(routeForTarget('passenger', { kind: 'ride', rideId: 1 }, false)).toEqual({ screen: 'PassengerMap', initial: false });
    expect(routeForTarget('driver', { kind: 'ride', rideId: 1 }, false)).toEqual({ screen: 'DriverRide', initial: false });
    expect(routeForTarget('driver', { kind: 'rideRequests' }, false)).toEqual({
      screen: 'DriverTabs',
      params: { screen: 'Map' },
    });
  });
});

const makeNavigation = (routeNames: string[]) => {
  const dispatch = jest.fn();
  const root: NotificationNavigation = {
    dispatch,
    getParent: () => undefined,
    getState: () =>
      ({
        routeNames: ['Passenger'],
        routes: [{ key: 'p', name: 'Passenger', state: { routeNames, routes: [{ key: 't', name: routeNames[0] }] } }],
      }) as unknown as ReturnType<NotificationNavigation['getState']>,
  } as NotificationNavigation;
  const child = {
    dispatch: jest.fn(),
    getParent: () => root,
    getState: jest.fn(),
  } as unknown as NotificationNavigation;
  return { root, child, dispatch };
};

describe('openNotificationTarget', () => {
  it('dispatches on the root navigator, using RideChat when it is registered', () => {
    const { child, dispatch } = makeNavigation(['PassengerTabs', CHAT_THREAD_ROUTE]);
    openNotificationTarget(child, 'passenger', { kind: 'chat', rideId: 4 }, 'push');
    expect(dispatch).toHaveBeenCalledWith(
      CommonActions.navigate({ name: 'Passenger', params: { screen: CHAT_THREAD_ROUTE, params: { rideId: 4 } } }),
    );
  });

  it('an inbox target from the list does nothing; from a push it opens the Notifications tab', () => {
    const { child, dispatch } = makeNavigation(['PassengerTabs']);
    openNotificationTarget(child, 'passenger', { kind: 'inbox' }, 'list');
    expect(dispatch).not.toHaveBeenCalled();
    openNotificationTarget(child, 'passenger', { kind: 'inbox' }, 'push');
    expect(dispatch).toHaveBeenCalledWith(
      CommonActions.navigate({ name: 'Passenger', params: { screen: 'PassengerTabs', params: { screen: 'Notifications' } } }),
    );
  });

  it('hasRoute searches nested navigators', () => {
    expect(hasRoute(undefined, 'X')).toBe(false);
    const { root } = makeNavigation(['A', 'B']);
    expect(hasRoute(root.getState(), 'B')).toBe(true);
    expect(hasRoute(root.getState(), 'C')).toBe(false);
  });
});

describe('formatNotificationTime', () => {
  const now = Date.parse('2026-10-11T12:00:00Z');
  it('is short and relative, and empty for a bad date', () => {
    expect(formatNotificationTime('2026-10-11T11:59:40Z', now)).toBe('Just now');
    expect(formatNotificationTime('2026-10-11T11:55:00Z', now)).toBe('5m');
    expect(formatNotificationTime('2026-10-11T09:00:00Z', now)).toBe('3h');
    expect(formatNotificationTime('2026-10-09T12:00:00Z', now)).toBe('2d');
    expect(formatNotificationTime('2026-09-01T12:00:00Z', now)).not.toBe('');
    expect(formatNotificationTime('not a date', now)).toBe('');
  });
});
