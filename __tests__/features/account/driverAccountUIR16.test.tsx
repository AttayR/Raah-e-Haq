/**
 * UI-R16 (driver side; shared-settings.md, shared-profile.md): the Account tab and the Profile
 * share the passenger anatomy. Account: profile card with the rating (or "New"), no "Approved"
 * pill, groups Your account / Safety / Preferences, one-line rows, no Edit profile and no phone
 * settings row, the version line. Profile: Rating / Trips / Distance from GET /me/stats (no
 * earnings), one Vehicle row to Vehicle & documents and no licence number. Moved from
 * DriverDesignScreens.test.tsx (T-507 / T-542 photo review cases kept as they were).
 */
import React from 'react';
import { StyleSheet, useColorScheme, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { rootReducer } from '../../../src/store/rootReducer';
import type { User } from '../../../src/services/api';
import { apiService } from '../../../src/services/api';
import { ThemeProvider, APPEARANCE_STORAGE_KEY } from '../../../src/app/providers/ThemeProvider';
import { DarkTheme, LightTheme } from '../../../src/theme';
import DriverSettingsScreen from '../../../src/screens/Driver/DriverSettingsScreen';
import DriverProfile from '../../../src/screens/Driver/DriverProfile';
import { isInside } from '../../../test-utils/tabRoot';
import { statsApi, toMyStats } from '../../../src/features/stats/api';
import { driverProfileApi } from '../../../src/features/driver-profile/api';
import { driverDocumentsApi } from '../../../src/features/driverDocuments/api';
import { toast } from '../../../src/core/toast';
import { PHOTO_TOAST_OFFSET } from '../../../src/features/profile-photo/useProfilePhoto';
import { clearQueryCache, writeCache } from '../../../src/core/api/queryCache';
import { parcelApi } from '../../../src/features/parcel/api';
import { showParcelOptInRow } from '../../../src/features/parcel/hooks';
import type { ParcelOptIn } from '../../../src/features/parcel/types';
import type { DriverVehicle } from '../../../src/features/driver-profile/types';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, canGoBack: () => true, addListener: () => () => undefined }),
  useIsFocused: () => true,
  useRoute: () => ({ key: 'Account-test', name: 'Account' }),
  useScrollToTop: jest.fn(),
}));
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
const mockScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

type FlatStyle = ViewStyle & TextStyle;
const flat = (style: StyleProp<FlatStyle>): FlatStyle => StyleSheet.flatten(style) ?? {};

const driver = (extra: Partial<User> = {}): User => ({
  id: 7,
  name: 'Test Driver',
  email: 'driver@example.test',
  phone: null,
  status: 'active',
  role: 'driver',
  roles: ['driver'],
  ...extra,
});

const vehicle = (over: Partial<DriverVehicle> = {}): DriverVehicle => ({
  id: 4,
  make: 'Mitsubishi',
  model: 'Outlander',
  licensePlate: 'Z-0001-19',
  status: 'approved',
  rejectionReason: null,
  vehicleType: null,
  year: null,
  color: null,
  ...over,
});

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
};

const renderScreen = async (Screen: React.ComponentType, extra: Partial<User> = {}, mode: 'light' | 'dark' = 'light') => {
  mockScheme.mockReturnValue(mode);
  if (!jest.isMockFunction(statsApi.getMyStats)) {
    jest
      .spyOn(statsApi, 'getMyStats')
      .mockResolvedValue(toMyStats({ role: 'driver', currency: 'PKR', total_rides: 33, total_earnings: 15230, total_distance_km: 412.3, rating: null }));
  }
  const initial = rootReducer(undefined, { type: '@@init' });
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: { ...initial, apiAuth: { ...initial.apiAuth, isAuthenticated: true, user: driver(extra) } },
  });
  render(
    <Provider store={store}>
      <ThemeProvider>
        <Screen />
      </ThemeProvider>
    </Provider>,
  );
  await flush();
};

beforeEach(async () => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  clearQueryCache();
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

const APPROVED_PHOTO = 'http://localhost:8000/storage/avatars/approved.jpg';
const PENDING_PHOTO = 'http://localhost:8000/storage/avatars/pending.jpg';

describe('Driver Profile (UI-R16 shared ProfileScreen)', () => {
  let getProfile: jest.SpyInstance;
  const serveProfile = (extra: Partial<User>) => {
    getProfile = jest.spyOn(apiService, 'getProfile').mockResolvedValue({ success: true, data: { user: { ...driver(extra) } } });
  };
  beforeEach(() => {
    // The focus refresh stays in flight unless a test serves a profile, so the preloaded user counts.
    getProfile = jest.spyOn(apiService, 'getProfile').mockReturnValue(new Promise(() => undefined));
  });

  it('[T-542] reads the review from the profile (no GET /driver/documents); an approved photo shows no note', async () => {
    const documents = jest.spyOn(driverDocumentsApi, 'list');
    jest.spyOn(driverProfileApi, 'getVehicles').mockResolvedValue([]);
    await renderScreen(DriverProfile, { profile_image_url: APPROVED_PHOTO, profile_image_review: 'approved' });
    expect(getProfile).toHaveBeenCalled();
    expect(documents).not.toHaveBeenCalled();
    expect(screen.queryByTestId('photo-review-pending')).toBeNull();
    expect(screen.queryByTestId('driver-profile-photo-under-review')).toBeNull();
    expect(screen.getByTestId('driver-profile-photo-avatar-photo').props.source.uri).toBe(APPROVED_PHOTO);
  });

  it('[T-542] a pending photo shows the new photo labelled Under review (riders keep the approved one)', async () => {
    const pending: Partial<User> = { profile_image_url: APPROVED_PHOTO, profile_image_review: 'pending', pending_profile_image_url: PENDING_PHOTO };
    serveProfile(pending);
    jest.spyOn(driverProfileApi, 'getVehicles').mockResolvedValue([]);
    await renderScreen(DriverProfile, pending);
    expect(screen.getByTestId('photo-review-pending')).toHaveTextContent(/Photo under review/);
    expect(screen.getByTestId('driver-profile-photo-under-review')).toHaveTextContent('Under review');
    expect(screen.getByTestId('driver-profile-photo-avatar-photo').props.source.uri).toBe(PENDING_PHOTO);
  });

  it('[T-504] a rejected photo shows the reason', async () => {
    const rejected: Partial<User> = { profile_image_url: APPROVED_PHOTO, profile_image_review: 'rejected', profile_image_rejection_reason: 'Face not visible' };
    serveProfile(rejected);
    jest.spyOn(driverProfileApi, 'getVehicles').mockResolvedValue([]);
    await renderScreen(DriverProfile, rejected);
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
      data: { ...driver(), profile_image_url: APPROVED_PHOTO, profile_image_review: 'pending', pending_profile_image_url: PENDING_PHOTO },
    });
    (launchImageLibrary as jest.Mock).mockResolvedValueOnce({
      assets: [{ uri: 'file:///tmp/me.jpg', type: 'image/jpeg', fileName: 'me.jpg', fileSize: 100_000 }],
    });
    await renderScreen(DriverProfile, { profile_image_url: APPROVED_PHOTO, profile_image_review: 'approved' });
    fireEvent.press(screen.getByTestId('driver-profile-photo-button'));
    expect(screen.queryByTestId('photo-source-remove')).toBeNull();
    fireEvent.press(screen.getByTestId('photo-source-library'));
    await waitFor(() => expect(screen.getByTestId('photo-review-pending')).toBeTruthy());
    expect(screen.getByTestId('driver-profile-photo-avatar-photo').props.source.uri).toBe(PENDING_PHOTO);
    expect(toastSuccess).toHaveBeenCalledWith(message, undefined, { topOffset: PHOTO_TOAST_OFFSET });
  });

  it('stats strip: Rating "New", trips and distance from GET /me/stats; never earnings or users.total_rides', async () => {
    jest.spyOn(driverProfileApi, 'getVehicles').mockResolvedValue([vehicle()]);
    await renderScreen(DriverProfile, { license_number: 'LHR-55821', license_expiry_date: '2028-03-31' });
    expect(screen.getByTestId('driver-profile-stats-rating')).toHaveTextContent(/New/);
    expect(screen.getByTestId('driver-profile-stats-trips')).toHaveTextContent(/^33Trips$/);
    expect(screen.getByTestId('driver-profile-stats-distance')).toHaveTextContent(/412\s*km/);
    expect(screen.getByTestId('driver-profile-stats-trips').props.accessibilityLabel).toBe('33 trips');
    expect(screen.queryByText(/Rs 15,230/)).toBeNull();
    expect(screen.queryByText('Approved')).toBeNull();
    // One Vehicle row; the licence number and expiry are not on Profile any more (UI-R17).
    expect(screen.getByText('Mitsubishi Outlander')).toBeTruthy();
    expect(screen.getByText('Z-0001-19')).toBeTruthy();
    expect(screen.queryByText('LHR-55821')).toBeNull();
    expect(screen.queryByText('31 Mar 2028')).toBeNull();
    fireEvent.press(screen.getByTestId('driver-profile-vehicle-row'));
    expect(mockNavigate).toHaveBeenLastCalledWith('DriverDocuments');
    expect(screen.getByTestId('driver-profile-photo-avatar-initials')).toHaveTextContent('TD');
  });

  it('a rated driver shows the star and one decimal; a rejected vehicle says "Action needed"', async () => {
    jest.spyOn(driverProfileApi, 'getVehicles').mockResolvedValue([vehicle({ status: 'rejected' })]);
    jest.spyOn(statsApi, 'getMyStats').mockResolvedValue(toMyStats({ role: 'driver', total_rides: 1204, total_distance_km: 3.44, rating: 4.86 }));
    await renderScreen(DriverProfile);
    expect(screen.getByTestId('driver-profile-stats-rating')).toHaveTextContent(/4\.9/);
    expect(screen.getByTestId('driver-profile-stats-rating').props.accessibilityLabel).toBe('Rating 4.9');
    // M2: the rating star is saffron `ratingStar`, never `primaryText`.
    const stars = screen.UNSAFE_root.findAll((node) => node.props.name === 'star' && typeof node.type !== 'string');
    expect(stars.length).toBeGreaterThan(0);
    stars.forEach((node) => expect(['ratingStar', LightTheme.colors.ratingStar]).toContain(node.props.color));
    expect(screen.getByTestId('driver-profile-stats-trips')).toHaveTextContent(/^1,204/);
    expect(screen.getByTestId('driver-profile-stats-distance')).toHaveTextContent(/3\.4\s*km/);
    expect(screen.getByTestId('driver-profile-vehicle-row')).toHaveTextContent(/Action needed/);
  });

  it('a failed stats read with nothing cached shows the retry line, never a number', async () => {
    jest.spyOn(driverProfileApi, 'getVehicles').mockResolvedValue([]);
    jest.spyOn(statsApi, 'getMyStats').mockRejectedValue(new Error('offline'));
    await renderScreen(DriverProfile);
    expect(screen.getByTestId('driver-profile-stats-error')).toHaveTextContent("Couldn't load your stats. Pull down to try again.");
    expect(screen.queryByTestId('driver-profile-stats-trips')).toBeNull();
    // No vehicle on file: the row names the screen it opens.
    expect(screen.getByTestId('driver-profile-vehicle-row')).toHaveTextContent(/Vehicle & documents/);
  });

  it('standard Header: back and the "Edit" text action; UI-R18: Delete account opens DeleteAccount', async () => {
    jest.spyOn(driverProfileApi, 'getVehicles').mockResolvedValue([]);
    await renderScreen(DriverProfile);
    expect(screen.getByText('Profile')).toBeTruthy();
    fireEvent.press(screen.getByTestId('driver-profile-edit'));
    expect(mockNavigate).toHaveBeenLastCalledWith('ProfileEdit');
    fireEvent.press(screen.getByTestId('driver-profile-header-back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId('driver-profile-actions-delete'));
    expect(mockNavigate).toHaveBeenLastCalledWith('DeleteAccount');
  });
});

describe('Driver Account tab (UI-R16 shared AccountScreen)', () => {
  it.each([
    ['light', LightTheme],
    ['dark', DarkTheme],
  ] as const)('%s: profile card with "New", no Approved pill, the three groups in order, sign out, version', async (mode, theme) => {
    await renderScreen(DriverSettingsScreen, {}, mode);
    expect(flat(screen.getByTestId('driver-settings').props.style).backgroundColor).toBe(theme.colors.background);
    expect(screen.getByText('Test Driver')).toBeTruthy();
    expect(screen.getByTestId('driver-settings-profile-rating')).toHaveTextContent('New');
    expect(screen.queryByText('Approved')).toBeNull();
    expect(screen.queryByTestId('driver-settings-profile-status')).toBeNull();
    expect(screen.getAllByRole('header').map((node) => node.props.children)).toEqual(
      expect.arrayContaining(['Your account', 'Safety', 'Preferences', 'Help']),
    );
    expect(flat(screen.getByText('Sign out').props.style).color).toBe(theme.colors.danger);
    expect(screen.getByTestId('driver-settings-version')).toHaveTextContent(/^Raah-e-Haq 0\.0\.1/);
    // Removed rows (A3, A6); UI-R18 adds the Help group (Help & support, Invite friends).
    expect(screen.queryByText('Edit profile')).toBeNull();
    expect(screen.queryByText('Phone notification settings')).toBeNull();
    expect(screen.getByText('Help & support')).toBeTruthy();
    expect(screen.getByText('Invite friends')).toBeTruthy();
  });

  it('UI-R15b: "Account" sits in the bar once', async () => {
    await renderScreen(DriverSettingsScreen);
    expect(screen.getByTestId('driver-settings-header-title').props.children).toBe('Account');
    expect(isInside(screen.getByTestId('driver-settings-header-title'), 'driver-settings-scroll')).toBe(false);
  });

  it('every row goes somewhere real; the card opens Profile', async () => {
    await renderScreen(DriverSettingsScreen, { phone: '+923009990001', rating: 4.86 });
    expect(screen.getByTestId('driver-settings-profile-contact')).toHaveTextContent('+92 300 9990001');
    expect(screen.getByTestId('driver-settings-profile-rating')).toHaveTextContent(/4\.9/);
    expect(screen.getByRole('button', { name: 'Test Driver, +92 300 9990001, rated 4.9' })).toBeTruthy();
    const presses: Array<[string, string]> = [
      ['driver-settings-profile', 'Profile'],
      ['driver-settings-documents', 'DriverDocuments'],
      ['driver-settings-vehicle-ac', 'VehicleAc'],
      ['driver-settings-ride-history', 'RideHistory'],
      ['driver-settings-emergency-contacts', 'EmergencyContacts'],
      ['driver-settings-notifications', 'NotificationPreferences'],
    ];
    presses.forEach(([testID, route]) => {
      fireEvent.press(screen.getByTestId(testID));
      expect(mockNavigate).toHaveBeenLastCalledWith(route);
    });
    expect(screen.queryByTestId('driver-settings-earnings')).toBeNull();
    expect(screen.queryByTestId('driver-settings-wallet')).toBeNull();
  });

  it('M2: the card takes the rating from a cached GET /me/stats with a 16 ratingStar star, without asking', async () => {
    const getStats = jest.spyOn(statsApi, 'getMyStats');
    writeCache('stats/me|', toMyStats({ role: 'driver', total_rides: 40, rating: 4.86 }));
    await renderScreen(DriverSettingsScreen, { rating: null });
    expect(screen.getByTestId('driver-settings-profile-rating')).toHaveTextContent(/4\.9/);
    const star = screen.UNSAFE_root.findAll((node) => node.props.name === 'star' && typeof node.type !== 'string')[0];
    expect(star.props).toMatchObject({ size: 16, color: 'ratingStar' });
    expect(getStats).not.toHaveBeenCalled();
  });

  it('a pending driver shows "Pending approval" on the card', async () => {
    await renderScreen(DriverSettingsScreen, { status: 'pending' });
    expect(screen.getByTestId('driver-settings-profile-status')).toHaveTextContent('Pending approval');
  });

  it('"Action needed" on Vehicle & documents only from cached documents or an expired licence (no request)', async () => {
    const vehicles = jest.spyOn(driverProfileApi, 'getVehicles');
    await renderScreen(DriverSettingsScreen);
    expect(screen.getByTestId('driver-settings-documents')).not.toHaveTextContent(/Action needed/);
    expect(vehicles).not.toHaveBeenCalled();
    screen.unmount();

    writeCache('profile/vehicles|', [vehicle({ status: 'rejected' })]);
    await renderScreen(DriverSettingsScreen);
    expect(screen.getByTestId('driver-settings-documents')).toHaveTextContent(/Action needed/);
    screen.unmount();

    clearQueryCache();
    await renderScreen(DriverSettingsScreen, { license_expiry_date: '2020-01-31' });
    expect(screen.getByTestId('driver-settings-documents')).toHaveTextContent(/Action needed/);
    expect(vehicles).not.toHaveBeenCalled();
  });

  // T-561 (QA T-522 #5): the Parcels row follows any approved bike, not the first vehicle type.
  describe('Parcel deliveries row', () => {
    const summary = (over: Partial<ParcelOptIn>): ParcelOptIn => ({
      optedIn: false,
      optedInAt: null,
      hasApprovedBike: false,
      tierActive: true,
      getsParcelRequests: false,
      prohibitedItems: [],
      rulesVersion: '2026-10-16',
      ...over,
    });

    it('a car driver with an approved bike as a second vehicle sees it', async () => {
      const read = jest.spyOn(parcelApi, 'getOptIn').mockResolvedValue(summary({ hasApprovedBike: true }));
      await renderScreen(DriverSettingsScreen, { vehicle_type: 'car' });
      expect(await screen.findByTestId('driver-settings-parcels')).toBeTruthy();
      expect(read).toHaveBeenCalledTimes(1);
    });

    it('a car driver without an approved bike (and not opted in) does not', async () => {
      jest.spyOn(parcelApi, 'getOptIn').mockResolvedValue(summary({}));
      await renderScreen(DriverSettingsScreen, { vehicle_type: 'car' });
      expect(screen.queryByTestId('driver-settings-parcels')).toBeNull();
    });

    it('a bike driver sees it without asking the server, and no AC row', async () => {
      const read = jest.spyOn(parcelApi, 'getOptIn').mockResolvedValue(summary({}));
      await renderScreen(DriverSettingsScreen, { vehicle_type: 'bike' });
      expect(screen.getByTestId('driver-settings-parcels')).toBeTruthy();
      expect(screen.queryByTestId('driver-settings-vehicle-ac')).toBeNull();
      expect(read).not.toHaveBeenCalled();
    });

    it('the rule: a bike profile, else an approved bike or an earlier opt-in', () => {
      expect(showParcelOptInRow(null, 'bike')).toBe(true);
      expect(showParcelOptInRow(null, 'car')).toBe(false);
      expect(showParcelOptInRow(summary({ optedIn: true }), 'car')).toBe(true);
      expect(showParcelOptInRow(summary({ hasApprovedBike: true }), 'rickshaw')).toBe(true);
    });
  });

  it('Appearance is a value row; the sheet picks Dark, applies it and persists it', async () => {
    await renderScreen(DriverSettingsScreen);
    expect(screen.getByTestId('settings-appearance').props.accessibilityLabel).toBe('Appearance, System');
    expect(screen.queryByTestId('settings-appearance-sheet')).toBeNull();
    fireEvent.press(screen.getByTestId('settings-appearance'));
    await flush();
    expect(screen.getByTestId('settings-appearance-option-system').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByText('Match your phone')).toBeTruthy();
    fireEvent.press(screen.getByTestId('settings-appearance-option-dark'));
    await flush();
    expect(flat(screen.getByTestId('driver-settings').props.style).backgroundColor).toBe(DarkTheme.colors.background);
    expect(await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('dark');
    expect(screen.getByTestId('settings-appearance').props.accessibilityLabel).toBe('Appearance, Dark');
  });
});
