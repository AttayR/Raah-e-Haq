/**
 * T-587 (map-vehicles.md §7.1-7.3): the Drive sheet's auto-accept row, its settings sheet (server
 * limits, eligible tiers, women-only only when sent, strike warning, 409/422) and the on state
 * (Auto badge, real max-pickup circle).
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../../src/services/api';
import { rootReducer } from '../../src/store/rootReducer';
import DriverDriveScreen from '../../src/screens/Driver/DriverDriveScreen';
import { toast } from '../../src/core/toast';
import locationTrackingService from '../../src/services/locationTrackingService';
import { autoAcceptData } from '../../test-utils/autoAcceptFixtures';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
  useIsFocused: () => true,
}));

const statusBody = (status: string) => ({
  success: true,
  data: { status, is_online: status !== 'offline', can_accept_rides: status === 'available', active_ride_id: null },
});

const ok = (data: unknown): [number, unknown] => [200, { success: true, message: 'Auto-accept settings', data }];

let mock: MockAdapter;

const renderDrive = async (status = 'offline') => {
  mock.onGet('/driver/status').reply(200, statusBody(status));
  const store = configureStore({
    reducer: rootReducer,
    middleware: getDefault =>
      getDefault({ serializableCheck: false, thunk: { extraArgument: { purgePersistedState: () => Promise.resolve() } } }),
  });
  const screen = render(
    <Provider store={store}>
      <DriverDriveScreen />
    </Provider>,
  );
  await waitFor(() => expect(screen.queryByTestId('auto-accept-row-loading')).toBeNull());
  return { store, screen };
};

const subtitle = (screen: ReturnType<typeof render>) =>
  screen.getByTestId('auto-accept-row-subtitle').props.children as string;

const puts = () => mock.history.put.filter(request => request.url === '/driver/auto-accept');

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mock.onGet('/me/stats').reply(200, { success: true, data: { role: 'driver', currency: 'PKR' } });
  jest.spyOn(locationTrackingService, 'getLastLocation').mockReturnValue({
    latitude: 31.5,
    longitude: 74.3,
    heading: null,
    speed: null,
    accuracy: 5,
    timestamp: 0,
  });
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('Drive auto-accept row', () => {
  it('never set: the switch opens the sheet, steppers follow the server limits, Turn on saves', async () => {
    mock.onGet('/driver/auto-accept').reply(...ok(autoAcceptData()));
    mock.onPut('/driver/auto-accept').reply(...ok(autoAcceptData({ enabled: true, min_fare: 10 })));
    const { screen } = await renderDrive();

    expect(subtitle(screen)).toBe('Accept matching rides for you');
    fireEvent.press(screen.getByTestId('auto-accept-switch'));
    expect(puts()).toHaveLength(0);

    screen.getByTestId('auto-accept-sheet');
    expect(screen.getByTestId('auto-accept-min-fare-value').props.children).toBe('Rs 0');
    expect(screen.getByTestId('auto-accept-min-fare-down').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByTestId('auto-accept-min-fare-up'));
    expect(screen.getByTestId('auto-accept-min-fare-value').props.children).toBe('Rs 10');
    expect(screen.getByTestId('auto-accept-pickup-value').props.children).toBe('2.0 km');
    screen.getByTestId('auto-accept-tier-car');
    screen.getByTestId('auto-accept-tier-car_ac');
    screen.getByTestId('auto-accept-strike');
    // Not a women-mode driver: no women-only toggle.
    expect(screen.queryByTestId('auto-accept-women-only')).toBeNull();

    // Deselecting the last tier does nothing and says why.
    fireEvent.press(screen.getByTestId('auto-accept-tier-car_ac'));
    fireEvent.press(screen.getByTestId('auto-accept-tier-car'));
    screen.getByTestId('auto-accept-tiers-error');

    await act(async () => {
      fireEvent.press(screen.getByTestId('auto-accept-turn-on'));
    });
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(JSON.parse(puts()[0].data)).toEqual({ enabled: true, min_fare: 10, max_pickup_km: 2, tiers: ['car'] });
    await waitFor(() => expect(subtitle(screen)).toBe('On · starts when you go online'));
  });

  it('shows the women-only toggle only when the server sends a value, and saves it', async () => {
    mock.onGet('/driver/auto-accept').reply(...ok(autoAcceptData({ women_passengers_only: true, min_fare: 300 })));
    mock.onPut('/driver/auto-accept').reply(...ok(autoAcceptData({ enabled: true, women_passengers_only: false, min_fare: 300 })));
    const { screen } = await renderDrive();

    expect(subtitle(screen)).toBe('Off · Rs 300+ · 2.0 km');
    fireEvent.press(screen.getByTestId('auto-accept-row'));
    fireEvent.press(screen.getByTestId('auto-accept-women-only-switch'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('auto-accept-turn-on'));
    });
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(JSON.parse(puts()[0].data)).toMatchObject({ enabled: true, women_passengers_only: false });
  });

  it('a server refusal shows its message and disables the switch', async () => {
    mock.onGet('/driver/auto-accept').reply(
      ...ok(
        autoAcceptData({
          available: false,
          unavailable_code: 'AUTO_ACCEPT_NOT_ENOUGH_RIDES',
          unavailable_message: 'Complete 5 rides to use auto-accept',
        }),
      ),
    );
    const { screen } = await renderDrive();
    expect(subtitle(screen)).toBe('Complete 5 rides to use auto-accept');
    expect(screen.getByTestId('auto-accept-switch').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('turning on with saved settings: optimistic, flips back with the server message on 409', async () => {
    const error = jest.spyOn(toast, 'error');
    mock.onGet('/driver/auto-accept').reply(...ok(autoAcceptData({ min_fare: 200 })));
    mock.onPut('/driver/auto-accept').reply(409, {
      success: false,
      message: 'Auto-accept is not available while you have recent cancel strikes',
      error: { code: 'AUTO_ACCEPT_TOO_MANY_STRIKES', message: 'Auto-accept is not available while you have recent cancel strikes' },
    });
    const { screen } = await renderDrive();

    await act(async () => {
      fireEvent.press(screen.getByTestId('auto-accept-switch'));
    });
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(JSON.parse(puts()[0].data)).toEqual({ enabled: true });
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith('Auto-accept is not available while you have recent cancel strikes'),
    );
    expect(screen.getByTestId('auto-accept-switch').props.accessibilityState).toMatchObject({ checked: false });
    // The row reads the server state again after the refusal.
    await waitFor(() =>
      expect(mock.history.get.filter(request => request.url === '/driver/auto-accept')).toHaveLength(2),
    );
  });

  it('a 422 shows under its field and keeps the sheet open', async () => {
    mock.onGet('/driver/auto-accept').reply(...ok(autoAcceptData()));
    mock.onPut('/driver/auto-accept').reply(422, {
      success: false,
      message: 'The given data was invalid.',
      errors: { min_fare: ['The min fare field must not be greater than 5000.'] },
    });
    const { screen } = await renderDrive();
    fireEvent.press(screen.getByTestId('auto-accept-row'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('auto-accept-turn-on'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('auto-accept-min-fare-caption').props.children).toBe(
        'The min fare field must not be greater than 5000.',
      ),
    );
    screen.getByTestId('auto-accept-sheet');
  });

  it('on and online: the Auto badge, the online hint and the real max-pickup circle', async () => {
    mock.onGet('/driver/auto-accept').reply(...ok(autoAcceptData({ enabled: true, min_fare: 250, max_pickup_km: 1.5 })));
    const { screen } = await renderDrive('available');
    await waitFor(() => screen.getByTestId('drive-auto-badge'));
    expect(subtitle(screen)).toBe('Rs 250+ · up to 1.5 km · Car, Car AC');
    expect(screen.getByTestId('drive-hint').props.children).toBe('Matching rides are accepted for you.');
    expect(screen.getByTestId('drive-pickup-circle').props.radius).toBe(1500);
  });

  it('off: no badge and no circle', async () => {
    mock.onGet('/driver/auto-accept').reply(...ok(autoAcceptData({ min_fare: 250 })));
    const { screen } = await renderDrive('available');
    expect(screen.queryByTestId('drive-auto-badge')).toBeNull();
    expect(screen.queryByTestId('drive-pickup-circle')).toBeNull();
  });

  it('a failed read says so and a tap on the row retries', async () => {
    mock.onGet('/driver/auto-accept').replyOnce(500, { success: false, message: 'boom' });
    mock.onGet('/driver/auto-accept').reply(...ok(autoAcceptData()));
    const { screen } = await renderDrive();
    await waitFor(() => expect(subtitle(screen)).toBe("Couldn't load auto-accept"));
    fireEvent.press(screen.getByTestId('auto-accept-row'));
    await waitFor(() => expect(subtitle(screen)).toBe('Accept matching rides for you'));
  });
});
