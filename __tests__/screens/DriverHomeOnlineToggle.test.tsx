/**
 * T-401 (DRV-13): driver Home shows the server's online state and its toggle calls the API.
 * Before, Home kept `useState(false)` and the button only flipped it locally.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../../src/services/api';
import { rootReducer } from '../../src/store/rootReducer';
import DriverHomeScreen from '../../src/screens/Driver/DriverHomeScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const statusBody = (status: string) => ({
  success: true,
  data: { status, is_online: status !== 'offline', can_accept_rides: status === 'available', active_ride_id: null },
});

const renderHome = () => {
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefault) =>
      getDefault({
        serializableCheck: false,
        thunk: { extraArgument: { purgePersistedState: () => Promise.resolve() } },
      }),
  });
  const screen = render(
    <Provider store={store}>
      <DriverHomeScreen />
    </Provider>,
  );
  return { store, screen };
};

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
});

describe('DriverHomeScreen online toggle', () => {
  it('loads the status on mount and goes online through PUT /driver/status', async () => {
    mock.onGet('/driver/status').reply(200, statusBody('offline'));
    mock.onPut('/driver/status').reply(200, statusBody('available'));
    const { screen } = renderHome();

    await waitFor(() => expect(screen.getByText('Offline')).toBeTruthy());
    expect(mock.history.get).toHaveLength(1);

    fireEvent.press(screen.getByTestId('driver-home-action-online'));

    await waitFor(() => expect(screen.getByText('Online')).toBeTruthy());
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ status: 'online' });
    expect(screen.getByText('Go Offline')).toBeTruthy();
  });

  it('shows "On a ride" and disables the toggle while on a ride', async () => {
    mock.onGet('/driver/status').reply(200, statusBody('on_ride'));
    const { screen } = renderHome();

    await waitFor(() => expect(screen.getByText('On a ride')).toBeTruthy());
    const toggle = screen.getByTestId('driver-home-action-online');
    expect(toggle.props.accessibilityState).toMatchObject({ disabled: true });

    fireEvent.press(toggle);
    expect(mock.history.put).toHaveLength(0);
  });
});
