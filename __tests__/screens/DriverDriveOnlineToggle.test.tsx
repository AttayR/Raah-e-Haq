/**
 * T-401 (DRV-13): the driver's online state is the server's and the toggle calls the API.
 * UI-R4: the toggle lives on the Drive tab's map sheet (merged Home dashboard + Map tab): the
 * same thunks (GET/PUT /driver/status), a 56pt Go online / Go offline action.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../../src/services/api';
import { rootReducer } from '../../src/store/rootReducer';
import DriverDriveScreen from '../../src/screens/Driver/DriverDriveScreen';
import { clearQueryCache } from '../../src/core/api/queryCache';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
  // Drive reads GET /me/stats while focused (T-507).
  useIsFocused: () => true,
}));

const statusBody = (status: string) => ({
  success: true,
  data: { status, is_online: status !== 'offline', can_accept_rides: status === 'available', active_ride_id: null },
});

const renderDrive = () => {
  const store = configureStore({
    reducer: rootReducer,
    middleware: getDefault =>
      getDefault({
        serializableCheck: false,
        thunk: { extraArgument: { purgePersistedState: () => Promise.resolve() } },
      }),
  });
  const screen = render(
    <Provider store={store}>
      <DriverDriveScreen />
    </Provider>,
  );
  return { store, screen };
};

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mock.onGet('/me/stats').reply(200, { success: true, data: { role: 'driver', currency: 'PKR' } });
});

afterEach(() => {
  mock.restore();
});

describe('Drive tab online toggle', () => {
  it('loads the status on mount and goes online through PUT /driver/status', async () => {
    mock.onGet('/driver/status').reply(200, statusBody('offline'));
    mock.onPut('/driver/status').reply(200, statusBody('available'));
    const { screen } = renderDrive();

    await waitFor(() => expect(screen.getByText("You're offline")).toBeTruthy());
    // One status read (the other GET is the Today stats, T-507).
    expect(mock.history.get.filter(request => request.url === '/driver/status')).toHaveLength(1);

    fireEvent.press(screen.getByTestId('drive-online-toggle'));

    await waitFor(() => expect(screen.getByText("You're online")).toBeTruthy());
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ status: 'online' });
    expect(screen.getByText('Go offline')).toBeTruthy();
    // UI-R11 D2: online with no fix yet says so in the subtitle (no searching shimmer while a
    // notice shows).
    expect(screen.getByTestId('drive-hint').props.children).toBe('Finding your location…');
    expect(screen.queryByTestId('drive-searching')).toBeNull();
  });

  it('shows "on a ride" and disables the toggle while on a ride', async () => {
    mock.onGet('/driver/status').reply(200, statusBody('on_ride'));
    const { screen } = renderDrive();

    await waitFor(() => expect(screen.getByText("You're on a ride")).toBeTruthy());
    const toggle = screen.getByTestId('drive-online-toggle');
    expect(toggle.props.accessibilityState).toMatchObject({ disabled: true });

    fireEvent.press(toggle);
    expect(mock.history.put).toHaveLength(0);
  });

  it('[T-600] going offline reads GET /me/stats again: the Today card shows the online time the server has now', async () => {
    clearQueryCache();
    const stats = (minutes: number) => ({
      success: true,
      data: { role: 'driver', currency: 'PKR', trips_today: 2, earnings_today: 300, online_minutes_today: minutes, rating: 4.8 },
    });
    // The server's online time moves on while the driver stays on Drive (fake local values).
    const served = [54, 67];
    mock.onGet('/me/stats').reply(() => [200, stats(served.shift() ?? 67)]);
    mock.onGet('/driver/status').reply(200, statusBody('available'));
    mock.onPut('/driver/status').reply(200, statusBody('offline'));
    const { screen } = renderDrive();

    await waitFor(() => expect(screen.getByTestId('driver-home-stat-online')).toHaveTextContent(/^54 min/));
    expect(mock.history.get.filter(request => request.url === '/me/stats')).toHaveLength(1);

    fireEvent.press(screen.getByTestId('drive-online-toggle'));

    await waitFor(() => expect(screen.getByText("You're offline")).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('driver-home-stat-online')).toHaveTextContent(/^1 h 07 min/));
    // One read on focus and one after going offline: no polling.
    expect(mock.history.get.filter(request => request.url === '/me/stats')).toHaveLength(2);
  });
});
