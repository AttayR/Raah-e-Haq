/**
 * T-605 / T-618 (driver side) redesign: the Drive tab (UI-R4: map + Drive sheet, merging the old
 * Home dashboard and Map tab) and Account render on theme tokens in light and dark and show no
 * invented numbers; the status dot follows the online state (QA: it stayed green while offline).
 */
import React from 'react';
import { Linking, StyleSheet, useColorScheme, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { launchImageLibrary } from 'react-native-image-picker';
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
import { rideHistoryApi, toRide } from '../../src/features/ride-history/api';
import type { Ride } from '../../src/features/ride-history/types';
import { driverProfileApi } from '../../src/features/driver-profile/api';
import { driverDocumentsApi } from '../../src/features/driverDocuments/api';
import { apiService } from '../../src/services/api';
import DriverProfile from '../../src/screens/Driver/DriverProfile';
import { initialDriverRideState } from '../../src/features/driver-ride/slice';
import type { RideResource } from '../../src/services/rideService';
import { makeRide } from '../../test-utils/rideFixtures';
import { toast } from '../../src/core/toast';
import { PHOTO_TOAST_OFFSET } from '../../src/features/profile-photo/useProfilePhoto';

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

const APPROVED_PHOTO = 'http://localhost:8000/storage/avatars/approved.jpg';
const PENDING_PHOTO = 'http://localhost:8000/storage/avatars/pending.jpg';

describe('DriverProfile (T-507)', () => {
  let getProfile: jest.SpyInstance;
  /** GET /auth/profile on focus (BE-94: the review fields come with the profile). */
  const serveProfile = (extra: Partial<User>) => {
    getProfile = jest
      .spyOn(apiService, 'getProfile')
      .mockResolvedValue({ success: true, data: { user: { ...user('active'), ...extra } } });
  };
  beforeEach(() => {
    // The focus refresh stays in flight unless a test serves a profile, so the preloaded user counts.
    getProfile = jest.spyOn(apiService, 'getProfile').mockReturnValue(new Promise(() => undefined));
  });
  afterEach(() => jest.restoreAllMocks());

  it('[T-542] reads the review from the profile (no GET /driver/documents); an approved photo shows no note', async () => {
    const documents = jest.spyOn(driverDocumentsApi, 'list');
    jest.spyOn(driverProfileApi, 'getVehicles').mockResolvedValue([]);
    await renderScreen(DriverProfile, {}, null, { profile_image_url: APPROVED_PHOTO, profile_image_review: 'approved' });
    expect(getProfile).toHaveBeenCalled();
    expect(documents).not.toHaveBeenCalled();
    expect(screen.queryByTestId('photo-review-pending')).toBeNull();
    expect(screen.queryByTestId('driver-profile-photo-under-review')).toBeNull();
    expect(screen.getByTestId('driver-profile-photo-avatar-photo').props.source.uri).toBe(APPROVED_PHOTO);
  });

  it('[T-542] a pending photo shows the new photo labelled Under review (riders keep the approved one)', async () => {
    const pending: Partial<User> = {
      profile_image_url: APPROVED_PHOTO,
      profile_image_review: 'pending',
      pending_profile_image_url: PENDING_PHOTO,
    };
    serveProfile(pending);
    jest.spyOn(driverProfileApi, 'getVehicles').mockResolvedValue([]);
    await renderScreen(DriverProfile, {}, null, pending);
    expect(screen.getByTestId('photo-review-pending')).toHaveTextContent(/Photo under review/);
    expect(screen.getByTestId('driver-profile-photo-under-review')).toHaveTextContent('Under review');
    expect(screen.getByTestId('driver-profile-photo-avatar-photo').props.source.uri).toBe(PENDING_PHOTO);
  });

  it('[T-504] a rejected photo shows the reason', async () => {
    const rejected: Partial<User> = {
      profile_image_url: APPROVED_PHOTO,
      profile_image_review: 'rejected',
      profile_image_rejection_reason: 'Face not visible',
    };
    serveProfile(rejected);
    jest.spyOn(driverProfileApi, 'getVehicles').mockResolvedValue([]);
    await renderScreen(DriverProfile, {}, null, rejected);
    expect(screen.getByTestId('photo-review-rejected')).toHaveTextContent(/Photo not approved.*Reason: Face not visible/);
    expect(screen.getByTestId('driver-profile-photo-avatar-photo').props.source.uri).toBe(APPROVED_PHOTO);
  });

  it('[T-542] after an upload the new photo shows as under review, the server message is shown, no Remove', async () => {
    const toastSuccess = jest.spyOn(toast, 'success');
    jest.spyOn(driverProfileApi, 'getVehicles').mockResolvedValue([]);
    const message = 'Photo submitted for review. Your current photo stays until it is approved.';
    jest.spyOn(apiService, 'uploadAvatar').mockResolvedValue({
      success: true,
      message,
      data: {
        ...user('active'),
        profile_image_url: APPROVED_PHOTO,
        profile_image_review: 'pending',
        pending_profile_image_url: PENDING_PHOTO,
      },
    });
    (launchImageLibrary as jest.Mock).mockResolvedValueOnce({
      assets: [{ uri: 'file:///tmp/me.jpg', type: 'image/jpeg', fileName: 'me.jpg', fileSize: 100_000 }],
    });
    await renderScreen(DriverProfile, {}, null, { profile_image_url: APPROVED_PHOTO, profile_image_review: 'approved' });
    expect(screen.queryByTestId('photo-review-pending')).toBeNull();

    fireEvent.press(screen.getByTestId('driver-profile-photo-button'));
    expect(screen.queryByTestId('photo-source-remove')).toBeNull();
    fireEvent.press(screen.getByTestId('photo-source-library'));

    await waitFor(() => expect(screen.getByTestId('photo-review-pending')).toBeTruthy());
    expect(screen.getByTestId('driver-profile-photo-avatar-photo').props.source.uri).toBe(PENDING_PHOTO);
    // Below the avatar, not over it (T-543).
    expect(toastSuccess).toHaveBeenCalledWith(message, undefined, { topOffset: PHOTO_TOAST_OFFSET });
  });

  it('shows stats from GET /me/stats (rating "New", PKR), the vehicle and the licence; no demo values', async () => {
    jest.spyOn(driverProfileApi, 'getVehicles').mockResolvedValue([
      { id: 4, make: 'Mitsubishi', model: 'Outlander', licensePlate: 'Z-0001-19', status: 'approved' },
    ]);
    jest.spyOn(statsApi, 'getMyStats').mockResolvedValue(
      toMyStats({ role: 'driver', currency: 'PKR', total_rides: 33, total_earnings: 15230, rating: null }),
    );
    await renderScreen(DriverProfile, {}, null, { license_number: 'LHR-55821', license_expiry_date: '2028-03-31' });
    expect(screen.getByTestId('driver-profile-rating')).toHaveTextContent(/New/);
    expect(screen.getByTestId('driver-profile-rides')).toHaveTextContent(/33/);
    expect(screen.getByTestId('driver-profile-earnings')).toHaveTextContent(/Rs 15,230/);
    expect(screen.getByText('Mitsubishi Outlander')).toBeTruthy();
    expect(screen.getByText('Plate Z-0001-19')).toBeTruthy();
    expect(screen.getByText('LHR-55821')).toBeTruthy();
    expect(screen.getByText('31 Mar 2028')).toBeTruthy();
    expect(screen.queryByText(/4\.9|156|\$|Toyota Corolla|DL-123456789/)).toBeNull();
    // Initials when there is no photo (T-514).
    expect(screen.getByTestId('driver-profile-photo-avatar-initials')).toHaveTextContent('TD');
  });

  it('a failed stats read shows dashes and a note, never a number; no vehicle or licence says so', async () => {
    jest.spyOn(driverProfileApi, 'getVehicles').mockResolvedValue([]);
    jest.spyOn(statsApi, 'getMyStats').mockRejectedValue(new Error('offline'));
    await renderScreen(DriverProfile);
    expect(screen.getByTestId('driver-profile-stats-error')).toBeTruthy();
    expect(screen.getByTestId('driver-profile-rating')).toHaveTextContent(/—/);
    expect(screen.getByTestId('driver-vehicle-empty')).toBeTruthy();
    expect(screen.getByTestId('driver-profile-licence-empty')).toBeTruthy();
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

  it('Edit profile opens the edit form and the profile card opens Profile (T-545); Notifications opens the preferences screen (T-502); phone settings stays a row', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await renderScreen(DriverSettingsScreen);
    fireEvent.press(screen.getByRole('button', { name: 'Edit profile, Update your personal information' }));
    expect(mockNavigate).toHaveBeenCalledWith('ProfileEdit');
    expect(mockNavigate).not.toHaveBeenCalledWith('Profile');
    fireEvent.press(screen.getByTestId('driver-settings-profile'));
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
