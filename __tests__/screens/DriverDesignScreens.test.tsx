/**
 * T-605 / T-618 (driver side) redesign: the Drive tab (UI-R4: map + Drive sheet, merging the old
 * Home dashboard and Map tab) renders on theme tokens in light and dark and show no
 * invented numbers; the status dot follows the online state (QA: it stayed green while offline).
 */
import React from 'react';
import { StyleSheet, useColorScheme, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { rootReducer } from '../../src/store/rootReducer';
import type { User } from '../../src/services/api';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import { DarkTheme, LightTheme } from '../../src/theme';
import { driverStatusApi } from '../../src/features/driver-status/api';
import DriverDriveScreen from '../../src/screens/Driver/DriverDriveScreen';
import DriverRideScreen from '../../src/screens/Driver/DriverRideScreen';
import { driverRideApi } from '../../src/features/driver-ride/api';
import { statsApi, toMyStats } from '../../src/features/stats/api';
import { rideHistoryApi, toRide } from '../../src/features/ride-history/api';
import type { Ride } from '../../src/features/ride-history/types';
import { initialDriverRideState } from '../../src/features/driver-ride/slice';
import type { RideResource } from '../../src/services/rideService';
import { makeRide } from '../../test-utils/rideFixtures';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), canGoBack: () => true, addListener: () => () => undefined }),
  useIsFocused: () => true,
  // T-514 useTabScrollReset: no navigator here; the hook has its own test.
  useRoute: () => ({ key: 'Account-test', name: 'Account' }),
  useScrollToTop: jest.fn(),
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
  extraUser: Partial<User> = {},
) => {
  mockScheme.mockReturnValue(mode as 'light' | 'dark');
  jest
    .spyOn(driverStatusApi, 'get')
    .mockResolvedValue({ status: driverStatus as 'offline', activeRideId: null, changedAt: null });
  // GET /me/stats (BE-08) as the backend sends it for a driver (fake local figures), unless the
  // test set its own.
  if (!jest.isMockFunction(statsApi.getMyStats)) jest.spyOn(statsApi, 'getMyStats').mockResolvedValue(
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
  // GET /rides?per_page=3 (T-507): nothing by default; tests that need trips spy again.
  if (!jest.isMockFunction(rideHistoryApi.listRides)) {
    jest.spyOn(rideHistoryApi, 'listRides').mockResolvedValue({ items: [], page: 1, lastPage: 1, total: 0 });
  }
  const initial = rootReducer(undefined, { type: '@@init' });
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: {
      ...initial,
      apiAuth: { ...initial.apiAuth, isAuthenticated: true, user: { ...user(status as User['status']), ...extraUser } },
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
    // UI-R11 D4: one Today card (no "Today · Rs" chip): earnings once, then the cells; untracked
    // online time / acceptance are hidden.
    expect(screen.queryByText('Today · Rs 1,250')).toBeNull();
    expect(screen.getByTestId('drive-today-earnings').props.children).toBe('Rs 1,250');
    expect(screen.getAllByText('Rs 1,250')).toHaveLength(1);
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
    const ride = makeRide({ status: 'accepted', passenger: { id: 9, name: 'Ayesha' } });
    await renderScreen(DriverDriveScreen, { mode: 'dark', driverStatus: 'on_ride' }, ride);
    expect(screen.getByText("You're on a ride")).toBeTruthy();
    expect(screen.queryByTestId('drive-online-toggle')).toBeNull();
    fireEvent.press(screen.getByTestId('drive-resume-ride'));
    expect(mockNavigate).toHaveBeenCalledWith('DriverRide');
  });

  it('[T-519] a completed ride still in the store is not offered as Resume ride', async () => {
    const ride = makeRide({ status: 'completed', passenger: { id: 9, name: 'Ayesha' } });
    await renderScreen(DriverDriveScreen, { driverStatus: 'available' }, ride);
    expect(screen.queryByTestId('drive-resume-ride')).toBeNull();
    expect(screen.getByText('Go offline')).toBeTruthy();
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

const finishedTrip = (id: number, overrides: Record<string, unknown> = {}): Ride => {
  const ride = toRide({
    id,
    ride_id: `RH-${id}`,
    status: 'completed',
    pickup_address: 'Liberty Market, Gulberg III, Lahore',
    dropoff_address: 'Emporium Mall, Johar Town, Lahore',
    total_fare: '300.00',
    driver_earnings: '240.00',
    completed_at: '2026-10-13T10:00:00+05:00',
    ...overrides,
  });
  if (!ride) throw new Error('fixture');
  return ride;
};

describe('DriverDriveScreen recent trips (T-507)', () => {
  it('lists the last trips from GET /rides?per_page=3 with the driver earnings; See all and a row navigate', async () => {
    const list = jest
      .spyOn(rideHistoryApi, 'listRides')
      .mockResolvedValue({ items: [finishedTrip(31), finishedTrip(30, { status: 'cancelled' })], page: 1, lastPage: 1, total: 2 });
    await renderScreen(DriverDriveScreen);
    expect(list).toHaveBeenCalledWith({ page: 1, perPage: 3 });
    expect(screen.getByTestId('home-recent-ride-31')).toBeTruthy();
    // Shared kit card (components/ui/ride), driver title from i18n.
    expect(screen.getByText('Recent trips')).toBeTruthy();
    // The driver sees what they earned (Rs 240), not the passenger fare (Rs 300).
    expect(screen.getByText('Rs 240')).toBeTruthy();
    expect(screen.getByText('No charge')).toBeTruthy();
    fireEvent.press(screen.getByTestId('home-recent-ride-31'));
    expect(mockNavigate).toHaveBeenCalledWith('RideDetails', { rideId: 31 });
    fireEvent.press(screen.getByRole('button', { name: 'See all rides' }));
    expect(mockNavigate).toHaveBeenCalledWith('RideHistory');
  });

  it('no trips yet: no card', async () => {
    await renderScreen(DriverDriveScreen);
    expect(screen.queryByTestId('home-recent-rides')).toBeNull();
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
    // UI-R13 TS2: the kit StatusBarScrim (a static `surface` fade, hidden from screen readers).
    const scrim = screen.getByTestId('driver-ride-status-bar-scrim', { includeHiddenElements: true });
    expect(scrim.findAll((node) => node.props.stopColor !== undefined)[0].props.stopColor).toBe(theme.colors.surface);
    expect(flat(screen.getByTestId('driver-ride').props.style).backgroundColor).toBe(theme.colors.background);
  });
});
