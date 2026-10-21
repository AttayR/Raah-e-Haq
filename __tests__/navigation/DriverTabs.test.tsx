/**
 * UI-R4 (DESIGN_SYSTEM §8.1, §8.3): the driver app has exactly four tabs, Drive · Earnings ·
 * Inbox · Account, on the shared tab bar (no Home dashboard, no Map tab). On the Drive tab an
 * incoming request hides the tab bar; the bar comes back once the request is gone. T-708: the
 * driver stack owns the single poller, and off the Drive tab (another tab or a stack screen) the
 * request is an in-app banner that opens Drive.
 */
import React from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, fireEvent, render } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../src/services/api';
import { rootReducer } from '../../src/store/rootReducer';
import DriverStack from '../../src/app/navigation/stacks/DriverStack';
import type { RootStackParamList } from '../../src/app/navigation/RootNavigation';
import { driverRequestsApi } from '../../src/features/driver-requests/api';
import { driverStatusApi, type DriverAvailability } from '../../src/features/driver-status/api';
import { dismissRideRequest } from '../../src/features/driver-requests/slice';
import { PENDING_POLL_INTERVAL_MS } from '../../src/features/driver-requests/hooks';
import locationTrackingService from '../../src/services/locationTrackingService';
import { makePendingRequest } from '../../test-utils/driverRequestFixtures';
import { makeRide } from '../../test-utils/rideFixtures';
import { haptics } from '../../src/core/haptics';
import { setDriverActiveRide } from '../../src/features/driver-ride/slice';
import { autoAcceptApi } from '../../src/features/driver-auto-accept/api';
import { __resetOfferReportsForTests } from '../../src/features/driver-auto-accept/offerReports';
import { toastClearance } from '../../src/core/toast';

function mockScreen(name: string) {
  return function MockScreen() {
    const { Text: MockText } = require('react-native');
    return <MockText>{`screen:${name}`}</MockText>;
  };
}
jest.mock('../../src/screens/Driver/DriverDriveScreen', () => mockScreen('Drive'));
jest.mock('../../src/features/stats/screens/DriverEarningsScreen', () => mockScreen('Earnings'));
jest.mock('../../src/features/inbox/InboxScreen', () => mockScreen('Inbox'));
jest.mock('../../src/screens/Driver/DriverSettingsScreen', () => mockScreen('Account'));
// A leave guard (beforeRemove) the T-708 test can turn on, like a screen with unsaved work.
let mockProfileBlocksLeave = false;
jest.mock('../../src/screens/Driver/DriverProfile', () => {
  const { useEffect } = require('react');
  const { useNavigation } = require('@react-navigation/native');
  const { Text: MockText } = require('react-native');
  return {
    __esModule: true,
    default: function MockProfile() {
      const navigation = useNavigation();
      useEffect(
        () =>
          navigation.addListener('beforeRemove', (event: { preventDefault: () => void }) => {
            if (mockProfileBlocksLeave) event.preventDefault();
          }),
        [navigation],
      );
      return <MockText>screen:Profile</MockText>;
    },
  };
});
jest.mock('../../src/screens/Driver/DriverRideScreen', () => mockScreen('DriverRide'));

const Root = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
    }
  });
};

const renderDriverApp = async (status: DriverAvailability) => {
  jest.spyOn(driverStatusApi, 'get').mockResolvedValue({ status, activeRideId: null, changedAt: null });
  const store = configureStore({
    reducer: rootReducer,
    middleware: getDefault => getDefault({ serializableCheck: false }),
  });
  const screen = render(
    <Provider store={store}>
      <NavigationContainer ref={navigationRef}>
        <Root.Navigator screenOptions={{ headerShown: false }}>
          <Root.Screen name="Driver" component={DriverStack} />
        </Root.Navigator>
      </NavigationContainer>
    </Provider>,
  );
  await flush();
  return { store, screen };
};

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
};

const nextPoll = () => advance(PENDING_POLL_INTERVAL_MS);

let mock: MockAdapter;
let listPending: jest.SpyInstance;
let declined: jest.SpyInstance;
let appStateListeners: ((state: string) => void)[] = [];
const setAppState = (state: string) => {
  Object.defineProperty(AppState, 'currentState', { value: state, configurable: true, writable: true });
  act(() => appStateListeners.forEach(listener => listener(state)));
};

beforeEach(() => {
  jest.useFakeTimers();
  mock = new MockAdapter(apiClient);
  mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { unread_count: 2 } });
  mock.onPost('/devices').reply(200, { success: true, data: {} });
  appStateListeners = [];
  mockProfileBlocksLeave = false;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    appStateListeners.push(listener as (state: string) => void);
    return { remove: jest.fn() };
  });
  jest.spyOn(locationTrackingService, 'getLastLocation').mockReturnValue({
    latitude: 31.5,
    longitude: 74.3,
    heading: null,
    speed: null,
    accuracy: 5,
    timestamp: 0,
  });
  jest.spyOn(locationTrackingService, 'startTracking').mockResolvedValue(true);
  listPending = jest.spyOn(driverRequestsApi, 'listPending').mockResolvedValue({ requests: [] });
  __resetOfferReportsForTests();
  declined = jest.spyOn(autoAcceptApi, 'offerDeclined').mockResolvedValue();
  jest.spyOn(autoAcceptApi, 'offerViewed').mockResolvedValue();
});

afterEach(() => {
  jest.useRealTimers();
  mock.restore();
  jest.restoreAllMocks();
});

test('exactly four tabs, Drive first; the Inbox badge reads the unread count', async () => {
  const { screen } = await renderDriverApp('offline');
  expect(screen.getByText('screen:Drive')).toBeTruthy();
  const tabs = screen.getAllByRole('tab');
  expect(tabs.map(tab => tab.props.accessibilityLabel)).toEqual(['Drive', 'Earnings', 'Inbox, 2 unread', 'Account']);
  expect(screen.queryByText('Map')).toBeNull();
  expect(screen.queryByText('Home')).toBeNull();
  expect(screen.getByTestId('tab-Inbox-badge')).toHaveTextContent('2');

  fireEvent.press(screen.getByTestId('tab-Earnings'));
  await flush();
  expect(screen.getByText('screen:Earnings')).toBeTruthy();
});

test('on the Drive tab an incoming request is the sheet on the map (no banner); the tab bar returns when it goes', async () => {
  const { store, screen } = await renderDriverApp('available');
  listPending.mockResolvedValue({ requests: [makePendingRequest({ id: 7 })] });
  await nextPoll();
  expect(screen.getByTestId('incoming-request-card')).toBeTruthy();
  expect(screen.queryByTestId('incoming-request-banner')).toBeNull();
  expect(screen.queryByTestId('tab-bar')).toBeNull();

  // Declined (or timed out): the request goes, the bar comes back on the Drive tab.
  listPending.mockResolvedValue({ requests: [] });
  act(() => {
    store.dispatch(dismissRideRequest(7));
  });
  await flush();
  expect(screen.queryByTestId('incoming-request-card')).toBeNull();
  expect(screen.getByTestId('tab-bar')).toBeTruthy();
  expect(screen.getByTestId('tab-Drive').props.accessibilityState).toMatchObject({ selected: true });
});

describe('T-708: the incoming request banner off the Drive tab', () => {
  it('shows over another tab (fare, You keep, distance, countdown), once; a tap opens Drive with the same clock', async () => {
    const warning = jest.spyOn(haptics, 'notificationWarning');
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    // The jest setup already mocks it, so the spy is that mock: start from no calls.
    announce.mockClear();
    const { screen } = await renderDriverApp('available');
    fireEvent.press(screen.getByTestId('tab-Account'));
    await flush();

    listPending.mockResolvedValue({
      requests: [makePendingRequest({ id: 7, estimatedFare: 150, driverNet: 120, offerSeconds: 20 })],
    });
    await nextPoll();
    // The tab stays; the request is a banner over it, the tab bar stays too.
    expect(screen.getByText('screen:Account')).toBeTruthy();
    expect(screen.getByTestId('tab-bar')).toBeTruthy();
    expect(screen.queryByTestId('incoming-request-card')).toBeNull();
    expect(screen.getByTestId('incoming-request-banner-fare')).toHaveTextContent('Rs 150');
    expect(screen.getByTestId('incoming-request-banner-details')).toHaveTextContent('You keep Rs 120 · 1.2 km to pickup');
    expect(screen.getByTestId('incoming-request-banner-countdown-seconds', { includeHiddenElements: true })).toHaveTextContent('20');
    expect(warning).toHaveBeenCalledTimes(1);
    const arrivals = () => announce.mock.calls.filter(([text]) => String(text).startsWith('New ride request'));
    expect(arrivals()).toHaveLength(1);
    // formatMoney / formatDistance join with a no-break space.
    expect(String(arrivals()[0][0]).replace(/\s/g, ' ')).toBe(
      'New ride request, Rs 150, You keep Rs 120, 1.2 km to pickup. 20 seconds left',
    );

    // More polls with the same request: no second haptic or announcement.
    await nextPoll();
    await nextPoll();
    expect(warning).toHaveBeenCalledTimes(1);
    expect(arrivals()).toHaveLength(1);

    // 10 s in, the driver taps it: Drive opens with the sheet, and the clock keeps running.
    fireEvent.press(screen.getByTestId('incoming-request-banner-open'));
    await flush();
    expect(screen.getByText('screen:Drive')).toBeTruthy();
    expect(screen.queryByText('screen:Account')).toBeNull();
    expect(screen.getByTestId('incoming-request-card')).toBeTruthy();
    expect(screen.queryByTestId('tab-bar')).toBeNull();
    expect(screen.queryByTestId('incoming-request-banner')).toBeNull();
    expect(warning).toHaveBeenCalledTimes(1);

    await advance(9_500);
    expect(declined).not.toHaveBeenCalled();
    await advance(1_000);
    expect(declined).toHaveBeenCalledWith(7);
  });

  it('shows over a driver stack screen, where the feed keeps polling; a tap returns to the tabs on Drive', async () => {
    const { screen } = await renderDriverApp('available');
    const before = listPending.mock.calls.length;
    act(() => navigationRef.navigate('Driver', { screen: 'Profile' }));
    await flush();
    expect(screen.getByText('screen:Profile')).toBeTruthy();

    listPending.mockResolvedValue({ requests: [makePendingRequest({ id: 7 })] });
    await nextPoll();
    expect(listPending.mock.calls.length).toBe(before + 1);
    expect(screen.getByTestId('incoming-request-banner')).toBeTruthy();

    fireEvent.press(screen.getByTestId('incoming-request-banner-open'));
    await flush();
    expect(screen.queryByText('screen:Profile')).toBeNull();
    expect(screen.getByTestId('incoming-request-card')).toBeTruthy();
  });

  it('runs out as a decline (offer-declined report) at the server offer_seconds', async () => {
    const { store, screen } = await renderDriverApp('available');
    fireEvent.press(screen.getByTestId('tab-Earnings'));
    await flush();
    listPending.mockResolvedValue({ requests: [makePendingRequest({ id: 7, offerSeconds: 12 })] });
    await nextPoll();
    expect(screen.getByTestId('incoming-request-banner')).toBeTruthy();
    await advance(11_000);
    expect(declined).not.toHaveBeenCalled();
    await advance(1_500);
    expect(declined).toHaveBeenCalledWith(7);
    expect(store.getState().driverRequests.dismissedIds).toContain(7);
    expect(screen.queryByTestId('incoming-request-banner')).toBeNull();
    expect(screen.getByText('screen:Earnings')).toBeTruthy();
  });

  it('is gone during an active ride, and the feed stops', async () => {
    const { store, screen } = await renderDriverApp('available');
    fireEvent.press(screen.getByTestId('tab-Inbox'));
    await flush();
    listPending.mockResolvedValue({ requests: [makePendingRequest({ id: 7 })] });
    await nextPoll();
    expect(screen.getByTestId('incoming-request-banner')).toBeTruthy();

    act(() => {
      store.dispatch(setDriverActiveRide(makeRide({ id: 41, status: 'accepted' })));
    });
    await flush();
    expect(screen.queryByTestId('incoming-request-banner')).toBeNull();
    const calls = listPending.mock.calls.length;
    await nextPoll();
    await nextPoll();
    expect(listPending.mock.calls.length).toBe(calls);
  });

  it('one poller for the whole driver stack: one request per interval, on any tab', async () => {
    const { screen } = await renderDriverApp('available');
    const start = listPending.mock.calls.length;
    expect(start).toBe(1);
    fireEvent.press(screen.getByTestId('tab-Earnings'));
    await nextPoll();
    fireEvent.press(screen.getByTestId('tab-Account'));
    await nextPoll();
    expect(listPending.mock.calls.length).toBe(start + 2);
  });

  it('a ride listed again after a long background is a fresh offer: new countdown, no instant decline', async () => {
    const { screen } = await renderDriverApp('available');
    fireEvent.press(screen.getByTestId('tab-Account'));
    await flush();
    listPending.mockResolvedValue({ requests: [makePendingRequest({ id: 7, offerSeconds: 20 })] });
    await nextPoll();
    expect(screen.getByTestId('incoming-request-banner')).toBeTruthy();
    await advance(5_000);

    // Backgrounded for longer than the window: the feed is cleared, so the banner goes.
    setAppState('background');
    await flush();
    expect(screen.queryByTestId('incoming-request-banner')).toBeNull();
    await advance(60_000);

    // Back, the server still lists ride 7: a new 20 s, not the old, elapsed clock.
    setAppState('active');
    await flush();
    expect(screen.getByTestId('incoming-request-banner-countdown-seconds', { includeHiddenElements: true })).toHaveTextContent('20');
    expect(declined).not.toHaveBeenCalled();
    await advance(15_000);
    expect(declined).not.toHaveBeenCalled();
    expect(screen.getByTestId('incoming-request-banner')).toBeTruthy();
  });

  it('a ride that left the feed and is listed again gets a fresh countdown and a haptic again', async () => {
    const warning = jest.spyOn(haptics, 'notificationWarning');
    const { screen } = await renderDriverApp('available');
    fireEvent.press(screen.getByTestId('tab-Earnings'));
    await flush();
    listPending.mockResolvedValue({ requests: [makePendingRequest({ id: 7, offerSeconds: 20 })] });
    await nextPoll();
    expect(warning).toHaveBeenCalledTimes(1);
    await nextPoll();

    // Taken (or requeued): it leaves the list...
    listPending.mockResolvedValue({ requests: [] });
    await nextPoll();
    expect(screen.queryByTestId('incoming-request-banner')).toBeNull();
    // ...and is listed again later.
    await advance(30_000);
    listPending.mockResolvedValue({ requests: [makePendingRequest({ id: 7, offerSeconds: 20 })] });
    await nextPoll();
    expect(screen.getByTestId('incoming-request-banner-countdown-seconds', { includeHiddenElements: true })).toHaveTextContent('20');
    expect(warning).toHaveBeenCalledTimes(2);
    expect(declined).not.toHaveBeenCalled();
  });

  it('from a stack screen opened from another tab, a tap returns to the tabs on Drive', async () => {
    const { screen } = await renderDriverApp('available');
    fireEvent.press(screen.getByTestId('tab-Account'));
    await flush();
    act(() => navigationRef.navigate('Driver', { screen: 'Profile' }));
    await flush();
    listPending.mockResolvedValue({ requests: [makePendingRequest({ id: 7 })] });
    await nextPoll();
    fireEvent.press(screen.getByTestId('incoming-request-banner-open'));
    await flush();
    expect(screen.queryByText('screen:Profile')).toBeNull();
    expect(screen.getByText('screen:Drive')).toBeTruthy();
    expect(screen.getByTestId('incoming-request-card')).toBeTruthy();
  });

  it('a leave guard that refuses the pop leaves everything as it was (no tab switch behind it)', async () => {
    const { screen } = await renderDriverApp('available');
    fireEvent.press(screen.getByTestId('tab-Account'));
    await flush();
    act(() => navigationRef.navigate('Driver', { screen: 'Profile' }));
    await flush();
    mockProfileBlocksLeave = true;
    listPending.mockResolvedValue({ requests: [makePendingRequest({ id: 7 })] });
    await nextPoll();
    fireEvent.press(screen.getByTestId('incoming-request-banner-open'));
    await flush();
    expect(screen.getByText('screen:Profile')).toBeTruthy();
    expect(screen.getByTestId('incoming-request-banner')).toBeTruthy();
    // Once the guard lets go and the driver goes back, the Account tab is still the open one.
    mockProfileBlocksLeave = false;
    act(() => navigationRef.goBack());
    await flush();
    expect(screen.getByText('screen:Account')).toBeTruthy();
  });

  it('reserves room for a Toast below the banner while it is up', async () => {
    const { store, screen } = await renderDriverApp('available');
    fireEvent.press(screen.getByTestId('tab-Account'));
    await flush();
    listPending.mockResolvedValue({ requests: [makePendingRequest({ id: 7 })] });
    await nextPoll();
    fireEvent(screen.getByTestId('incoming-request-banner'), 'layout', { nativeEvent: { layout: { height: 96 } } });
    expect(toastClearance.get()).toBe(104);
    listPending.mockResolvedValue({ requests: [] });
    act(() => {
      store.dispatch(dismissRideRequest(7));
    });
    await flush();
    expect(screen.queryByTestId('incoming-request-banner')).toBeNull();
    expect(toastClearance.get()).toBe(0);
  });

  it('nothing while offline: no poll, no banner', async () => {
    const { screen } = await renderDriverApp('offline');
    fireEvent.press(screen.getByTestId('tab-Account'));
    await nextPoll();
    expect(listPending).not.toHaveBeenCalled();
    expect(screen.queryByTestId('incoming-request-banner')).toBeNull();
  });
});
