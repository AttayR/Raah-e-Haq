/**
 * T-502: opening a notification (row or push) goes to the right place per role; chat rows
 * open the ride's thread when T-510's `RideChat` route exists and Inbox › Messages otherwise.
 * UI-R4: tab names are Home/Activity/Inbox/Account and Drive/Earnings/Inbox/Account; the booking
 * route is `Booking`.
 */
import { CommonActions } from '@react-navigation/native';
import { resolveNotificationTarget } from '../../../src/features/notifications/routing';
import {
  CHAT_THREAD_ROUTE,
  focusedChatRideId,
  hasRoute,
  openNotificationTarget,
  routeForTarget,
  type NotificationNavigation,
} from '../../../src/features/notifications/navigation';

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

  it('T-546 (BE-93): a passenger ride_cancelled back in the queue opens the live ride', () => {
    const cancelled = (extra: { requeued?: boolean; rideStatus?: string | null }) =>
      resolveNotificationTarget({ category: 'ride', type: 'ride_cancelled', rideId: 3, ...extra }, 'passenger');
    expect(cancelled({ requeued: true, rideStatus: 'requested' })).toEqual({ kind: 'ride', rideId: 3 });
    expect(cancelled({ rideStatus: 'requested' })).toEqual({ kind: 'ride', rideId: 3 });
    expect(cancelled({ requeued: true })).toEqual({ kind: 'ride', rideId: 3 });
    // A real cancel, and an older push without the keys, open the history as before.
    expect(cancelled({ requeued: false, rideStatus: 'cancelled' }).kind).toBe('rideHistory');
    expect(cancelled({}).kind).toBe('rideHistory');
    expect(cancelled({ rideStatus: null }).kind).toBe('rideHistory');
    // ride_status only matters on ride_cancelled; the driver who cancelled goes Home.
    expect(
      resolveNotificationTarget({ category: 'ride', type: 'ride_completed', rideId: 3, rideStatus: 'requested' }, 'passenger').kind,
    ).toBe('rideHistory');
    expect(
      resolveNotificationTarget(
        { category: 'ride', type: 'ride_cancelled', rideId: 3, requeued: true, rideStatus: 'requested' },
        'driver',
      ).kind,
    ).toBe('home');
  });

  it('driver: new request opens the request feed; a cancelled ride opens Home; a stop change opens the ride', () => {
    expect(resolveNotificationTarget({ category: 'ride', type: 'new_ride_request', rideId: 3 }, 'driver').kind).toBe(
      'rideRequests',
    );
    expect(resolveNotificationTarget({ category: 'ride', type: 'ride_cancelled', rideId: 3 }, 'driver').kind).toBe('home');
    expect(resolveNotificationTarget({ category: 'ride', type: 'stop_added', rideId: 3 }, 'driver').kind).toBe('ride');
  });

  it('T-514: the driver\'s "Trip completed. Collect Rs X" (BE-73) opens the Earnings tab', () => {
    const target = resolveNotificationTarget({ category: 'ride', type: 'ride_completed', rideId: 3 }, 'driver');
    expect(target).toEqual({ kind: 'earnings' });
    expect(routeForTarget('driver', target, true)).toEqual({ screen: 'DriverTabs', params: { screen: 'Earnings' } });
    // BE-73 wallet events (settlement decisions, admin adjustments) open the driver wallet.
    (['settlement_rejected', 'wallet_adjusted'] as const).forEach((type) => {
      const wallet = resolveNotificationTarget({ category: 'wallet', type, rideId: null }, 'driver');
      expect(routeForTarget('driver', wallet, true)).toEqual({ screen: 'Wallet', initial: false });
    });
  });

  it('T-515: wallet notifications (top-up results, settlements) open the wallet for both roles', () => {
    (['passenger', 'driver'] as const).forEach((role) => {
      expect(resolveNotificationTarget({ category: 'wallet', type: 'topup_succeeded', rideId: null }, role)).toEqual({
        kind: 'wallet',
      });
      expect(resolveNotificationTarget({ category: 'wallet', type: 'settlement_approved', rideId: null }, role).kind).toBe(
        'wallet',
      );
      // A top-up push without its category still opens the wallet.
      expect(resolveNotificationTarget({ category: 'system', type: 'topup_failed', rideId: null }, role).kind).toBe('wallet');
    });
  });

  it('promo, system and chat without a ride stay on the list', () => {
    (['promo', 'system'] as const).forEach((category) => {
      expect(resolveNotificationTarget({ category, type: null, rideId: 1 }, 'passenger').kind).toBe('inbox');
    });
    expect(resolveNotificationTarget({ category: 'chat', type: 'chat_message', rideId: null }, 'passenger').kind).toBe(
      'inbox',
    );
  });
});

describe('routeForTarget', () => {
  it('chat falls back to Inbox › Messages where RideChat is not registered', () => {
    expect(routeForTarget('passenger', { kind: 'chat', rideId: 7 }, false)).toEqual({
      screen: 'PassengerTabs',
      params: { screen: 'Inbox', params: { segment: 'messages' } },
    });
    expect(routeForTarget('driver', { kind: 'chat', rideId: 7 }, true)).toEqual({
      screen: CHAT_THREAD_ROUTE,
      params: { rideId: 7 },
    });
  });

  it('maps rides per role', () => {
    expect(routeForTarget('passenger', { kind: 'ride', rideId: 1 }, false)).toEqual({ screen: 'Booking', initial: false });
    expect(routeForTarget('driver', { kind: 'ride', rideId: 1 }, false)).toEqual({ screen: 'DriverRide', initial: false });
    expect(routeForTarget('driver', { kind: 'rideRequests' }, false)).toEqual({
      screen: 'DriverTabs',
      params: { screen: 'Drive' },
    });
  });

  it('T-515: maps the wallet per role (passenger Activity › Wallet, driver Wallet screen)', () => {
    expect(routeForTarget('passenger', { kind: 'wallet' }, true)).toEqual({
      screen: 'PassengerTabs',
      params: { screen: 'Activity', params: { segment: 'wallet' } },
    });
    expect(routeForTarget('driver', { kind: 'wallet' }, true)).toEqual({ screen: 'Wallet', initial: false });
  });

  it('maps history, home and inbox to the new tabs (UI-R4)', () => {
    expect(routeForTarget('passenger', { kind: 'rideHistory' }, true)).toEqual({
      screen: 'PassengerTabs',
      params: { screen: 'Activity', params: { segment: 'rides' } },
    });
    expect(routeForTarget('driver', { kind: 'rideHistory' }, true)).toEqual({ screen: 'RideHistory', initial: false });
    expect(routeForTarget('passenger', { kind: 'home' }, true)).toEqual({ screen: 'PassengerTabs', params: { screen: 'Home' } });
    expect(routeForTarget('driver', { kind: 'home' }, true)).toEqual({ screen: 'DriverTabs', params: { screen: 'Drive' } });
    expect(routeForTarget('driver', { kind: 'inbox' }, true)).toEqual({
      screen: 'DriverTabs',
      params: { screen: 'Inbox', params: { segment: 'notifications' } },
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

  it('an inbox target from the list does nothing; from a push it opens Inbox › Notifications', () => {
    const { child, dispatch } = makeNavigation(['PassengerTabs']);
    openNotificationTarget(child, 'passenger', { kind: 'inbox' }, 'list');
    expect(dispatch).not.toHaveBeenCalled();
    openNotificationTarget(child, 'passenger', { kind: 'inbox' }, 'push');
    expect(dispatch).toHaveBeenCalledWith(
      CommonActions.navigate({
        name: 'Passenger',
        params: { screen: 'PassengerTabs', params: { screen: 'Inbox', params: { segment: 'notifications' } } },
      }),
    );
  });

  it('T-544: a push caller that knows RideChat exists opens the thread before the nested state is stored', () => {
    // Cold start: the root route has no nested state yet, so hasRoute cannot see RideChat.
    const dispatch = jest.fn();
    const coldRoot = {
      dispatch,
      getParent: () => undefined,
      getState: () => ({ routeNames: ['Driver'], routes: [{ key: 'd', name: 'Driver' }] }),
    } as unknown as NotificationNavigation;
    openNotificationTarget(coldRoot, 'driver', { kind: 'chat', rideId: 8 }, 'push');
    expect(dispatch).toHaveBeenLastCalledWith(
      CommonActions.navigate({
        name: 'Driver',
        params: { screen: 'DriverTabs', params: { screen: 'Inbox', params: { segment: 'messages' } } },
      }),
    );
    openNotificationTarget(coldRoot, 'driver', { kind: 'chat', rideId: 8 }, 'push', { chatThreadAvailable: true });
    expect(dispatch).toHaveBeenLastCalledWith(
      CommonActions.navigate({ name: 'Driver', params: { screen: CHAT_THREAD_ROUTE, params: { rideId: 8 } } }),
    );
  });

  it('hasRoute searches nested navigators', () => {
    expect(hasRoute(undefined, 'X')).toBe(false);
    const { root } = makeNavigation(['A', 'B']);
    expect(hasRoute(root.getState(), 'B')).toBe(true);
    expect(hasRoute(root.getState(), 'C')).toBe(false);
  });
});

describe('focusedChatRideId (T-544)', () => {
  const navWith = (state: unknown): NotificationNavigation =>
    ({ dispatch: jest.fn(), getParent: () => undefined, getState: () => state }) as unknown as NotificationNavigation;
  const stackOn = (focused: { name: string; params?: object }) => ({
    routeNames: ['Passenger'],
    index: 0,
    routes: [
      {
        key: 'p',
        name: 'Passenger',
        state: {
          routeNames: ['PassengerTabs', CHAT_THREAD_ROUTE],
          index: 1,
          routes: [{ key: 't', name: 'PassengerTabs' }, { key: 'c', ...focused }],
        },
      },
    ],
  });

  it('is the ride of the focused chat thread', () => {
    expect(focusedChatRideId(navWith(stackOn({ name: CHAT_THREAD_ROUTE, params: { rideId: 12 } })))).toBe(12);
  });

  it('is null on any other screen, a thread without a ride id, or no state', () => {
    expect(focusedChatRideId(navWith(stackOn({ name: 'Booking' })))).toBeNull();
    expect(focusedChatRideId(navWith(stackOn({ name: CHAT_THREAD_ROUTE, params: {} })))).toBeNull();
    expect(focusedChatRideId(navWith(undefined))).toBeNull();
    // The thread is in the stack but not focused (index points at the tabs).
    const behind = stackOn({ name: CHAT_THREAD_ROUTE, params: { rideId: 12 } });
    behind.routes[0].state.index = 0;
    expect(focusedChatRideId(navWith(behind))).toBeNull();
  });
});
