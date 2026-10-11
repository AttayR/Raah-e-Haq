/**
 * T-605 / T-618 (driver side) redesign: Home and Settings render on theme tokens in light and
 * dark, show no invented numbers, and the Map status pin follows the online state (QA: it
 * stayed green while offline).
 */
import React from 'react';
import { Linking, StyleSheet, useColorScheme, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { rootReducer } from '../../src/store/rootReducer';
import type { User } from '../../src/services/api';
import { ThemeProvider, APPEARANCE_STORAGE_KEY } from '../../src/app/providers/ThemeProvider';
import { DarkTheme, LightTheme } from '../../src/theme';
import { driverStatusApi } from '../../src/features/driver-status/api';
import DriverHomeScreen from '../../src/screens/Driver/DriverHomeScreen';
import DriverSettingsScreen from '../../src/screens/Driver/DriverSettingsScreen';
import DriverMapScreen from '../../src/screens/Driver/DriverMapScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));
const mockNavigate = jest.fn();

jest.mock('../../src/hooks/useDriverNotifications', () => ({
  useDriverNotifications: () => ({
    isInitialized: false,
    subscribeToDriverNotifications: jest.fn(),
    unsubscribeFromDriverNotifications: jest.fn(),
  }),
}));

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
const mockScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

type FlatStyle = ViewStyle & TextStyle;
const flat = (style: StyleProp<FlatStyle>): FlatStyle => StyleSheet.flatten(style) ?? {};

const user = (status: User['status']): User => ({
  id: 7,
  name: 'Test Driver',
  email: 'driver@example.test',
  phone: null,
  status,
  role: 'driver',
  roles: ['driver'],
});

const renderScreen = async (
  Screen: React.ComponentType,
  { mode = 'light', status = 'active', driverStatus = 'offline' }: Record<string, string> = {},
) => {
  mockScheme.mockReturnValue(mode as 'light' | 'dark');
  jest
    .spyOn(driverStatusApi, 'get')
    .mockResolvedValue({ status: driverStatus as 'offline', activeRideId: null, changedAt: null });
  const initial = rootReducer(undefined, { type: '@@init' });
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: { ...initial, apiAuth: { ...initial.apiAuth, user: user(status as User['status']) } },
  });
  render(
    <Provider store={store}>
      <ThemeProvider>
        <Screen />
      </ThemeProvider>
    </Provider>,
  );
  await act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
  });
};

beforeEach(async () => {
  mockNavigate.mockClear();
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DriverHomeScreen', () => {
  it('light: background token, offline grey dot, Go online primary, no invented stats', async () => {
    await renderScreen(DriverHomeScreen);
    expect(flat(screen.getByTestId('driver-home').props.style).backgroundColor).toBe(LightTheme.colors.background);
    expect(screen.getByText('Offline')).toBeTruthy();
    expect(flat(screen.getByTestId('driver-home-status-dot').props.style).backgroundColor).toBe(
      LightTheme.colors.textMuted,
    );
    expect(flat(screen.getByTestId('driver-home-action-online').props.style).backgroundColor).toBe(
      LightTheme.colors.primary,
    );
    // No demo figures (156 rides, PKR 24k, $25.50) and no demo recent rides.
    expect(screen.queryByText(/156|PKR|\$/)).toBeNull();
    expect(screen.queryByText('Sarah Ahmed')).toBeNull();
    expect(screen.getAllByText('—')).toHaveLength(3);
    expect(screen.getByText('Approved')).toBeTruthy();
    expect(screen.queryByTestId('driver-home-pending-banner')).toBeNull();
    // Sign out and the profile row live in Settings; the avatar opens the profile.
    expect(screen.queryByText('Sign out')).toBeNull();
  });

  it('dark + online: dark surfaces, green dot, outline Go offline', async () => {
    await renderScreen(DriverHomeScreen, { mode: 'dark', driverStatus: 'available' });
    expect(flat(screen.getByTestId('driver-home').props.style).backgroundColor).toBe(DarkTheme.colors.background);
    expect(screen.getByText('Online')).toBeTruthy();
    expect(flat(screen.getByTestId('driver-home-status-dot').props.style).backgroundColor).toBe(
      DarkTheme.colors.success,
    );
    expect(screen.getByText('Go offline')).toBeTruthy();
    expect(flat(screen.getByTestId('driver-home-status-card').props.style).backgroundColor).toBe(
      DarkTheme.colors.surface,
    );
  });

  it('pending driver: warning banner and Pending pill; avatar opens the profile', async () => {
    await renderScreen(DriverHomeScreen, { status: 'pending' });
    expect(screen.getByTestId('driver-home-pending-banner')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Open your profile' }));
    expect(mockNavigate).toHaveBeenCalledWith('DriverProfile');
  });
});

describe('DriverSettingsScreen', () => {
  it('renders the profile card, grouped rows and sign out on tokens (light)', async () => {
    await renderScreen(DriverSettingsScreen);
    expect(flat(screen.getByTestId('driver-settings').props.style).backgroundColor).toBe(
      LightTheme.colors.background,
    );
    expect(screen.getByText('Test Driver')).toBeTruthy();
    expect(screen.getByText('Approved')).toBeTruthy();
    expect(flat(screen.getByText('Sign out').props.style).color).toBe(LightTheme.colors.danger);
    // No dead rows: Privacy and Help come back with T-511.
    expect(screen.queryByText('Privacy & security')).toBeNull();
    expect(screen.queryByText('Help & support')).toBeNull();
  });

  it('Edit profile opens DriverProfile; Notifications opens the OS settings', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await renderScreen(DriverSettingsScreen);
    fireEvent.press(screen.getByRole('button', { name: 'Edit profile, Update your personal information' }));
    expect(mockNavigate).toHaveBeenCalledWith('DriverProfile');
    fireEvent.press(screen.getByTestId('driver-settings-notifications'));
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('appearance control switches to dark and persists the choice', async () => {
    await renderScreen(DriverSettingsScreen);
    await act(async () => {
      fireEvent.press(screen.getByRole('radio', { name: 'Appearance, Dark' }));
    });
    expect(flat(screen.getByTestId('driver-settings').props.style).backgroundColor).toBe(
      DarkTheme.colors.background,
    );
    expect(await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('dark');
  });
});

describe('DriverMapScreen status chip', () => {
  it('pin takes the warning token while the location is still loading', async () => {
    await renderScreen(DriverMapScreen, { driverStatus: 'offline' });
    // No GPS fix in tests: the pin shows the locating state first.
    expect(screen.getByText('Getting your location…')).toBeTruthy();
    const pin = screen.getByTestId('driver-map-status-pin');
    expect(flat(pin.props.style).color ?? pin.props.color).toBe(LightTheme.colors.warning);
  });
});
