/**
 * T-605 / T-618 (driver side) redesign: the Drive tab (UI-R4: map + Drive sheet, merging the old
 * Home dashboard and Map tab) and Account render on theme tokens in light and dark and show no
 * invented numbers; the status dot follows the online state (QA: it stayed green while offline).
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
import DriverDriveScreen from '../../src/screens/Driver/DriverDriveScreen';
import DriverSettingsScreen from '../../src/screens/Driver/DriverSettingsScreen';
import DriverRideScreen from '../../src/screens/Driver/DriverRideScreen';
import { driverRideApi } from '../../src/features/driver-ride/api';
import { statsApi, toMyStats } from '../../src/features/stats/api';
import { initialDriverRideState } from '../../src/features/driver-ride/slice';
import type { RideResource } from '../../src/services/rideService';
import { makeRide } from '../../test-utils/rideFixtures';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), canGoBack: () => true }),
  useIsFocused: () => true,
}));
const mockNavigate = jest.fn();

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
  ride: RideResource | null = null,
) => {
  mockScheme.mockReturnValue(mode as 'light' | 'dark');
  jest
    .spyOn(driverStatusApi, 'get')
    .mockResolvedValue({ status: driverStatus as 'offline', activeRideId: null, changedAt: null });
  // GET /me/stats (BE-08) as the backend sends it for a driver (fake local figures).
  jest.spyOn(statsApi, 'getMyStats').mockResolvedValue(
    toMyStats({
      role: 'driver',
      currency: 'PKR',
      total_rides: 33,
      rating: null,
      earnings_today: 1250,
      trips_today: 2,
      earnings_week: 4800,
      trips_week: 9,
      commission_owed: 116,
      online_minutes_today: null,
      acceptance_rate: null,
    }),
  );
  const initial = rootReducer(undefined, { type: '@@init' });
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: {
      ...initial,
      apiAuth: { ...initial.apiAuth, user: user(status as User['status']) },
      driverRide: { ...initialDriverRideState, ride },
    },
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

describe('DriverDriveScreen (UI-R4)', () => {
  it('light: background token, offline grey dot, Go online primary, stats from GET /me/stats', async () => {
    await renderScreen(DriverDriveScreen);
    expect(flat(screen.getByTestId('driver-drive').props.style).backgroundColor).toBe(LightTheme.colors.background);
    expect(screen.getByText("You're offline")).toBeTruthy();
    expect(flat(screen.getByTestId('drive-status-dot-offline').props.style).backgroundColor).toBe(
      LightTheme.colors.textMuted,
    );
    expect(flat(screen.getByTestId('drive-online-toggle').props.style).backgroundColor).toBe(LightTheme.colors.primary);
    expect(screen.getByText('Go online')).toBeTruthy();
    // No demo figures (156 rides, PKR 24k, $25.50) and no demo recent rides.
    expect(screen.queryByText(/156|PKR|\$/)).toBeNull();
    expect(screen.queryByText('Sarah Ahmed')).toBeNull();
    // Today's earnings pill and tiles from GET /me/stats; untracked online time / acceptance are hidden.
    expect(screen.getByText('Today · Rs 1,250')).toBeTruthy();
    expect(screen.getByText('Rs 1,250')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.queryByTestId('driver-home-stat-online')).toBeNull();
    expect(screen.queryByTestId('driver-home-stat-acceptance')).toBeNull();
    expect(screen.queryByText('—')).toBeNull();
    expect(screen.getByText('Approved')).toBeTruthy();
    expect(screen.queryByTestId('driver-home-pending-banner')).toBeNull();
    // Earnings and the wallet are the Earnings tab now; sign out lives in Account.
    expect(screen.queryByText('Sign out')).toBeNull();
    // No ride: the action is the online toggle, not Resume.
    expect(screen.queryByTestId('drive-resume-ride')).toBeNull();
    // Two map controls at most (§9): the avatar and locate; no notifications bell (§8.3).
    expect(screen.getByTestId('drive-controls-avatar')).toBeTruthy();
    expect(screen.getByTestId('drive-controls-locate')).toBeTruthy();
  });

  it('on a ride: the sheet action is Resume ride, which opens the ride screen (T-413)', async () => {
    const ride = makeRide({ status: 'accepted', passenger: { id: 9, name: 'Ayesha', phone: '' } });
    await renderScreen(DriverDriveScreen, { mode: 'dark', driverStatus: 'on_ride' }, ride);
    expect(screen.getByText("You're on a ride")).toBeTruthy();
    expect(screen.queryByTestId('drive-online-toggle')).toBeNull();
    fireEvent.press(screen.getByTestId('drive-resume-ride'));
    expect(mockNavigate).toHaveBeenCalledWith('DriverRide');
  });

  it('dark + online: dark surfaces, green dot, outline Go offline', async () => {
    await renderScreen(DriverDriveScreen, { mode: 'dark', driverStatus: 'available' });
    expect(flat(screen.getByTestId('driver-drive').props.style).backgroundColor).toBe(DarkTheme.colors.background);
    expect(screen.getByText("You're online")).toBeTruthy();
    expect(flat(screen.getByTestId('drive-status-dot-online').props.style).backgroundColor).toBe(DarkTheme.colors.success);
    expect(screen.getByText('Go offline')).toBeTruthy();
    expect(flat(screen.getByTestId('drive-sheet').props.style).backgroundColor).toBe(DarkTheme.colors.surface);
  });

  it('pending driver: warning banner and Pending pill; the avatar opens the profile', async () => {
    await renderScreen(DriverDriveScreen, { status: 'pending' });
    expect(screen.getByTestId('driver-home-pending-banner')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Open your profile' }));
    expect(mockNavigate).toHaveBeenCalledWith('Profile');
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

  it('Edit profile opens Profile; Notifications opens the preferences screen (T-502); phone settings stays a row', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await renderScreen(DriverSettingsScreen);
    fireEvent.press(screen.getByRole('button', { name: 'Edit profile, Update your personal information' }));
    expect(mockNavigate).toHaveBeenCalledWith('Profile');
    fireEvent.press(screen.getByTestId('driver-settings-notifications'));
    expect(mockNavigate).toHaveBeenCalledWith('NotificationPreferences');
    // T-203: Vehicle & documents opens the documents list.
    fireEvent.press(screen.getByTestId('driver-settings-documents'));
    expect(mockNavigate).toHaveBeenCalledWith('DriverDocuments');
    // T-501: ride history opens from Account; Earnings (with the wallet) is a tab (UI-R4).
    fireEvent.press(screen.getByTestId('driver-settings-ride-history'));
    expect(mockNavigate).toHaveBeenCalledWith('RideHistory');
    expect(screen.queryByTestId('driver-settings-earnings')).toBeNull();
    expect(screen.queryByTestId('driver-settings-wallet')).toBeNull();
    expect(openSettings).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('driver-settings-phone-notifications'));
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

describe('DriverRideScreen (T-413)', () => {
  it.each([
    ['light', LightTheme],
    ['dark', DarkTheme],
  ] as const)('%s: the map follows the theme and a surface scrim sits under the status bar', async (mode, theme) => {
    const ride = makeRide({ status: 'accepted' });
    jest.spyOn(driverRideApi, 'get').mockResolvedValue(ride);
    await renderScreen(DriverRideScreen, { mode }, ride);
    const map = screen.UNSAFE_root.findAll(
      (node) => node.props.customMapStyle !== undefined && typeof node.type !== 'string',
    )[0];
    expect(map.props.customMapStyle).toBe(theme.mapStyle);
    expect(flat(screen.getByTestId('driver-ride-status-bar-scrim').props.style).backgroundColor).toBe(
      theme.colors.surface,
    );
    expect(flat(screen.getByTestId('driver-ride').props.style).backgroundColor).toBe(theme.colors.background);
  });
});
