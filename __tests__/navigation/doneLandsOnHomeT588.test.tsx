/**
 * T-588 (owner live session 2026-10-19): Done / Close on a finished ride always lands on the
 * Home tab, also when the ride was opened from another tab (Inbox, Activity), in the real
 * passenger stack and tabs. Before the fix `popTo('PassengerTabs', { screen: 'Home' })` left the
 * tab that opened the ride selected.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { CommonActions, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../src/services/api';
import PassengerStack from '../../src/app/navigation/stacks/PassengerStack';
import type { RootStackParamList } from '../../src/app/navigation/RootNavigation';
import { routeForTarget } from '../../src/features/notifications/navigation';
import { makeStore, page } from '../../test-utils/rideFixtures';
import { leaveFinishedRide } from '../../src/features/active-ride/done';

function mockScreen(name: string) {
  return function MockScreen() {
    const { Text: MockText } = require('react-native');
    return <MockText>{`screen:${name}`}</MockText>;
  };
}
jest.mock('../../src/screens/Passenger/PassengerHomeScreen', () => mockScreen('Home'));
// The booking stand-in: its Done is the real leaveFinishedRide on the screen's own navigation.
jest.mock('../../src/screens/Passenger/PassengerMapScreen', () => function MockBooking() {
  const { Button: MockButton } = require('react-native');
  const { useNavigation } = require('@react-navigation/native');
  const { leaveFinishedRide: leave } = require('../../src/features/active-ride/done');
  const navigation = useNavigation();
  return <MockButton title="Done" onPress={() => leave(navigation)} />;
});
jest.mock('../../src/features/activity/ActivityScreen', () => function MockActivity() {
  const { Button: MockButton } = require('react-native');
  const { useNavigation } = require('@react-navigation/native');
  const navigation = useNavigation();
  // useOpenRide's live-ride path: navigate('Booking') from inside the tab.
  return <MockButton title="Open live ride" onPress={() => navigation.navigate('Booking')} />;
});
jest.mock('../../src/features/inbox/InboxScreen', () => mockScreen('Inbox'));
jest.mock('../../src/screens/Passenger/PassengerSettingsScreen', () => mockScreen('Account'));

const Root = createNativeStackNavigator<RootStackParamList>();
const navRef = createNavigationContainerRef<RootStackParamList>();

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mock.onGet('/rides').reply(200, page([]));
});
afterEach(() => mock.restore());

const renderApp = async () => {
  const store = makeStore();
  const screen = render(
    <Provider store={store}>
      <NavigationContainer ref={navRef}>
        <Root.Navigator screenOptions={{ headerShown: false }}>
          <Root.Screen name="Passenger" component={PassengerStack} />
        </Root.Navigator>
      </NavigationContainer>
    </Provider>,
  );
  await waitFor(() => expect(store.getState().activeRide.restoreStatus).toBe('done'));
  return screen;
};

const expectHomeSelected = async (screen: ReturnType<typeof render>) => {
  expect(await screen.findByText('screen:Home')).toBeTruthy();
  expect(navRef.getCurrentRoute()?.name).toBe('Home');
  expect(screen.getByTestId('tab-Home').props.accessibilityState).toMatchObject({ selected: true });
  expect(screen.getByTestId('tab-Inbox').props.accessibilityState).toMatchObject({ selected: false });
};

test('Done selects Home on the tab navigator itself, not only through popTo params', () => {
  const popTo = jest.fn();
  const dispatch = jest.fn();
  leaveFinishedRide({
    popTo,
    dispatch,
    getState: () => ({
      routes: [
        { name: 'PassengerTabs', state: { key: 'tabs-1', routeNames: ['Home', 'Activity', 'Inbox', 'Account'] } },
        { name: 'Booking' },
      ],
    }),
  });
  expect(popTo).toHaveBeenCalledWith('PassengerTabs', { screen: 'Home' });
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(dispatch).toHaveBeenCalledWith({ type: 'JUMP_TO', payload: { name: 'Home' }, target: 'tabs-1' });
  // Popped first, so the finished ride is gone before the tab changes.
  expect(popTo.mock.invocationCallOrder[0]).toBeLessThan(dispatch.mock.invocationCallOrder[0]);
});

test('Done on a ride opened from an Inbox notification lands on Home, not Inbox', async () => {
  const screen = await renderApp();
  fireEvent.press(screen.getByTestId('tab-Inbox'));
  expect(await screen.findByText('screen:Inbox')).toBeTruthy();

  act(() => {
    navRef.dispatch(
      CommonActions.navigate({ name: 'Passenger', params: routeForTarget('passenger', { kind: 'ride', rideId: 9 }, true) }),
    );
  });
  fireEvent.press(await screen.findByText('Done'));

  await expectHomeSelected(screen);
  // Booking is gone: Back from Home does not return to the finished ride.
  expect(screen.queryByText('Done')).toBeNull();
});

test('Done on a ride opened from Activity lands on Home', async () => {
  const screen = await renderApp();
  fireEvent.press(screen.getByTestId('tab-Activity'));
  fireEvent.press(await screen.findByText('Open live ride'));
  fireEvent.press(await screen.findByText('Done'));

  await expectHomeSelected(screen);
});

test('Done twice in a row (two rides from Inbox) still lands on Home each time', async () => {
  const screen = await renderApp();
  for (const rideId of [10, 11]) {
    fireEvent.press(screen.getByTestId('tab-Inbox'));
    expect(await screen.findByText('screen:Inbox')).toBeTruthy();
    act(() => {
      navRef.dispatch(
        CommonActions.navigate({ name: 'Passenger', params: routeForTarget('passenger', { kind: 'ride', rideId }, true) }),
      );
    });
    fireEvent.press(await screen.findByText('Done'));
    await expectHomeSelected(screen);
  }
});
