/**
 * T-618 (passenger side): Settings and Profile render on theme tokens in light and dark, at
 * iPhone SE width with 1.3x text, have no dead rows, no image overlay and no invented numbers,
 * and every row goes to a real screen.
 */
import React from 'react';
import {
  Linking,
  StyleSheet,
  useColorScheme,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { rootReducer } from '../../src/store/rootReducer';
import type { User } from '../../src/services/api';
import { apiService } from '../../src/services/api';
import { ThemeProvider, APPEARANCE_STORAGE_KEY } from '../../src/app/providers/ThemeProvider';
import { DarkTheme, LightTheme, type AppTheme } from '../../src/theme';
import PassengerSettingsScreen from '../../src/screens/Passenger/PassengerSettingsScreen';
import { isInside } from '../../test-utils/tabRoot';
import PassengerProfile from '../../src/screens/Passenger/Passengerprofile';
import { LOGOUT_CONFIRM_TITLE } from '../../src/hooks/useLogout';
import { dialog, dialogStore } from '../../src/core/dialog';
import { toast } from '../../src/core/toast';
import { statsApi, toMyStats } from '../../src/features/stats/api';
import { clearQueryCache } from '../../src/core/api/queryCache';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, canGoBack: () => true, addListener: () => () => undefined }),
  useIsFocused: () => true,
  // T-514 useTabScrollReset: no navigator here; the hook has its own test.
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

// iPhone SE (3rd gen) window at the largest text size the kit allows.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 375, height: 667, scale: 2, fontScale: 1.3 }),
}));

type FlatStyle = ViewStyle & TextStyle;
const flat = (style: StyleProp<FlatStyle>): FlatStyle => StyleSheet.flatten(style) ?? {};

const basePassenger: User = {
  id: 11,
  name: 'Test Passenger',
  email: 'passenger@example.test',
  phone: '+920000000001',
  phone_verified_at: '2026-10-01T10:00:00Z',
  status: 'active',
  role: 'passenger',
  roles: ['passenger'],
  created_at: '2026-03-15T08:00:00Z',
};

const renderScreen = async (Screen: React.ComponentType, mode: 'light' | 'dark', user: User | null = basePassenger) => {
  mockScheme.mockReturnValue(mode);
  const initial = rootReducer(undefined, { type: '@@init' });
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: { ...initial, apiAuth: { ...initial.apiAuth, user } },
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
  return store;
};

const COLOR_KEYS = ['color', 'backgroundColor', 'borderColor', 'tintColor'] as const;

/** Every colour in the rendered tree is one of the active theme's tokens (no stray hex). */
const expectOnlyThemeColors = (theme: AppTheme) => {
  const allowed = new Set<string>(Object.values(theme.colors).filter((v): v is string => typeof v === 'string'));
  allowed.add('transparent');
  const offenders: string[] = [];
  screen.UNSAFE_root.findAll((node) => typeof node.type === 'string').forEach((node) => {
    const style = flat(node.props.style);
    COLOR_KEYS.forEach((key) => {
      const value = style[key as keyof FlatStyle];
      if (typeof value === 'string' && !allowed.has(value)) {
        offenders.push(`${key}=${value}`);
      }
    });
  });
  expect(offenders).toEqual([]);
};

beforeEach(async () => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('PassengerSettingsScreen', () => {
  it.each([
    ['light', LightTheme],
    ['dark', DarkTheme],
  ] as const)('%s: background token, profile card, grouped rows, destructive sign out, only tokens', async (mode, theme) => {
    await renderScreen(PassengerSettingsScreen, mode);
    expect(flat(screen.getByTestId('passenger-settings').props.style).backgroundColor).toBe(theme.colors.background);
    expect(screen.getByText('Test Passenger')).toBeTruthy();
    expect(screen.getByText('+920000000001')).toBeTruthy();
    expect(flat(screen.getByText('Sign out').props.style).color).toBe(theme.colors.danger);
    // No invented stars, no image overlay, no "Danger Zone".
    expect(screen.queryByText(/danger zone/i)).toBeNull();
    expect(screen.UNSAFE_root.findAll((node) => node.props.source !== undefined && typeof node.type !== 'string')).toHaveLength(0);
    // UI-R18 (T-619): Help & support and Invite friends open real screens.
    expect(screen.getByText('Help & support')).toBeTruthy();
    expect(screen.getByText('Invite friends')).toBeTruthy();
    // Active accounts show no status badge.
    expect(screen.queryByTestId('passenger-settings-profile-status')).toBeNull();
    expectOnlyThemeColors(theme);
  });

  it('UI-R15b: "Account" sits in the bar once (no collapsing title in the list)', async () => {
    await renderScreen(PassengerSettingsScreen, 'light');
    expect(screen.getByTestId('passenger-settings-header-title').props.children).toBe('Account');
    expect(isInside(screen.getByTestId('passenger-settings-header-title'), 'passenger-settings-scroll')).toBe(false);
    expect(screen.getAllByText('Account')).toHaveLength(1);
  });

  it('every row goes somewhere real; the profile card opens the profile view', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await renderScreen(PassengerSettingsScreen, 'light');
    fireEvent.press(screen.getByTestId('passenger-settings-profile'));
    expect(mockNavigate).toHaveBeenLastCalledWith('Profile');
    fireEvent.press(screen.getByTestId('passenger-settings-saved-places'));
    expect(mockNavigate).toHaveBeenLastCalledWith('FavoriteLocations');
    fireEvent.press(screen.getByTestId('passenger-settings-emergency-contacts'));
    expect(mockNavigate).toHaveBeenLastCalledWith('EmergencyContacts');
    // UI-R4: ride history and the wallet live in Activity, not in Account.
    expect(screen.queryByTestId('passenger-settings-wallet')).toBeNull();
    expect(screen.queryByTestId('passenger-settings-ride-history')).toBeNull();
    fireEvent.press(screen.getByTestId('passenger-settings-notifications'));
    expect(mockNavigate).toHaveBeenLastCalledWith('NotificationPreferences');
    // UI-R16 A3: the phone's own settings live inside Notifications only.
    expect(screen.queryByTestId('passenger-settings-phone-notifications')).toBeNull();
    expect(openSettings).not.toHaveBeenCalled();
  });

  it('UI-R16: same groups as the driver, one-line rows (no subtitles), version line', async () => {
    await renderScreen(PassengerSettingsScreen, 'light');
    expect(screen.getAllByRole('header').map((node) => node.props.children)).toEqual(
      expect.arrayContaining(['Your account', 'Safety', 'Preferences']),
    );
    expect(screen.queryByText('Home, work and favourites')).toBeNull();
    expect(screen.queryByText('Choose which alerts you get')).toBeNull();
    expect(screen.getByTestId('passenger-settings-version')).toHaveTextContent(/^Raah-e-Haq 0\.0\.1.*Debug$/);
  });

  it('profile card is one accessible button with name, formatted phone and the rating', async () => {
    await renderScreen(PassengerSettingsScreen, 'light', { ...basePassenger, phone: '+923009990001', rating: 4.75 });
    expect(screen.getByRole('button', { name: 'Test Passenger, +92 300 9990001, rated 4.8' })).toBeTruthy();
    expect(screen.getByTestId('passenger-settings-profile-rating')).toHaveTextContent(/4\.8/);
  });

  it('profile card says "New" before the first rating', async () => {
    await renderScreen(PassengerSettingsScreen, 'light', { ...basePassenger, rating: null });
    expect(screen.getByTestId('passenger-settings-profile-rating')).toHaveTextContent('New');
    expect(screen.getByRole('button', { name: 'Test Passenger, +920000000001, new' })).toBeTruthy();
  });

  it('pull to refresh that fails says so and keeps the content', async () => {
    jest.spyOn(apiService, 'getProfile').mockRejectedValue(new Error('offline'));
    const error = jest.spyOn(toast, 'error');
    await renderScreen(PassengerSettingsScreen, 'light');
    const scroll = screen.UNSAFE_root.findAll((node) => node.props.refreshControl !== undefined && typeof node.type !== 'string')[0];
    await act(async () => {
      await scroll.props.refreshControl.props.onRefresh();
    });
    expect(error).toHaveBeenCalledWith("Couldn't refresh your account.");
    expect(screen.getByText('Test Passenger')).toBeTruthy();
  });

  it('sign out asks for confirmation first (T-102)', async () => {
    await renderScreen(PassengerSettingsScreen, 'light');
    fireEvent.press(screen.getByTestId('passenger-settings-sign-out'));
    // UI-R3: the themed kit Dialog, destructive confirm.
    expect(dialogStore.getCurrent()).toMatchObject({ title: LOGOUT_CONFIRM_TITLE, destructive: true });
    act(() => dialog.dismissAll());
  });

  it('pending account: the card says "Pending approval"', async () => {
    await renderScreen(PassengerSettingsScreen, 'light', { ...basePassenger, status: 'pending' });
    expect(screen.getByTestId('passenger-settings-profile-status')).toHaveTextContent('Pending approval');
  });

  it('pull to refresh re-reads the profile from the server', async () => {
    const getProfile = jest
      .spyOn(apiService, 'getProfile')
      .mockResolvedValue({ success: true, data: { user: { ...basePassenger, name: 'Renamed Rider' } } });
    await renderScreen(PassengerSettingsScreen, 'light');
    const scroll = screen.UNSAFE_root.findAll((node) => node.props.refreshControl !== undefined && typeof node.type !== 'string')[0];
    await act(async () => {
      await scroll.props.refreshControl.props.onRefresh();
    });
    expect(getProfile).toHaveBeenCalledTimes(1);
  });

  it('Appearance sheet switches to dark and persists the choice', async () => {
    await renderScreen(PassengerSettingsScreen, 'light');
    fireEvent.press(screen.getByTestId('settings-appearance'));
    await act(async () => {});
    await act(async () => {
      fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));
    });
    expect(flat(screen.getByTestId('passenger-settings').props.style).backgroundColor).toBe(DarkTheme.colors.background);
    expect(await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('dark');
  });
});

describe('PassengerProfile', () => {
  beforeEach(() => {
    clearQueryCache();
    // The focus re-read of GET /auth/profile stays in flight: the preloaded user counts.
    jest.spyOn(apiService, 'getProfile').mockReturnValue(new Promise(() => undefined));
    jest
      .spyOn(statsApi, 'getMyStats')
      .mockResolvedValue(toMyStats({ role: 'passenger', currency: 'PKR', total_rides: 12, total_distance_km: 86.4, total_spent: 5400, rating: 4.75 }));
  });

  it('UI-R16: one stats strip (Rating / Trips / Distance) from GET /me/stats; no money', async () => {
    await renderScreen(PassengerProfile, 'light');
    expect(screen.getByTestId('passenger-profile-stats-rating')).toHaveTextContent(/4\.8/);
    expect(screen.getByTestId('passenger-profile-stats-trips')).toHaveTextContent(/^12Trips$/);
    expect(screen.getByTestId('passenger-profile-stats-distance')).toHaveTextContent(/86\s*km/);
    expect(screen.queryByText(/Rs 5,400/)).toBeNull();
  });

  it('UI-R16: the email says "Not confirmed" when the server marks it unproven, "Verified" when proven', async () => {
    await renderScreen(PassengerProfile, 'light', { ...basePassenger, email_verified: false });
    expect(screen.getByTestId('passenger-profile-email-state')).toHaveTextContent('Not confirmed');
    screen.unmount();
    await renderScreen(PassengerProfile, 'light', { ...basePassenger, email_verified: true });
    expect(screen.getByTestId('passenger-profile-email-state')).toHaveTextContent('Verified');
  });

  it('UI-R16: Header "Edit" opens the form; UI-R18: the Delete account row opens DeleteAccount', async () => {
    await renderScreen(PassengerProfile, 'light');
    fireEvent.press(screen.getByTestId('passenger-profile-edit'));
    expect(mockNavigate).toHaveBeenLastCalledWith('ProfileEdit');
    fireEvent.press(screen.getByTestId('passenger-profile-actions-delete'));
    expect(mockNavigate).toHaveBeenLastCalledWith('DeleteAccount');
  });

  it.each([
    ['light', LightTheme],
    ['dark', DarkTheme],
  ] as const)('%s: no overlay, initials avatar, real fields only, only tokens', async (mode, theme) => {
    await renderScreen(PassengerProfile, mode);
    expect(flat(screen.getByTestId('passenger-profile').props.style).backgroundColor).toBe(theme.colors.background);
    // No background image / dimming overlay (QA: page looked greyed out).
    expect(screen.UNSAFE_root.findAll((node) => node.props.source !== undefined && typeof node.type !== 'string')).toHaveLength(0);
    expect(screen.getByText('TP')).toBeTruthy();
    // T-504: the avatar changes the photo (camera badge, labelled button).
    expect(screen.getByLabelText('Add profile photo')).toBeTruthy();
    expect(screen.getByTestId('passenger-profile-photo-badge')).toBeTruthy();
    expect(screen.getByText('Test Passenger')).toBeTruthy();
    expect(screen.getByTestId('passenger-profile-meta').props.children).toBe('Rider · Member since Mar 2026');
    expect(screen.getByText('+920000000001')).toBeTruthy();
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.getByText('passenger@example.test')).toBeTruthy();
    // No invented stats (24 / 2y; the real ones come from GET /me/stats) and no raw "( passenger )" role.
    expect(screen.queryByText(/^24$|2y/)).toBeNull();
    expect(screen.queryByText(/\(\s*passenger\s*\)/)).toBeNull();
    expectOnlyThemeColors(theme);
  });

  it('hides rows the server did not send and the Verified badge for an unverified phone', async () => {
    await renderScreen(PassengerProfile, 'light', {
      ...basePassenger,
      phone_verified_at: null,
      email: '',
      created_at: undefined,
      gender: 'female',
      date_of_birth: '1995-10-08',
    });
    expect(screen.queryByText('Verified')).toBeNull();
    expect(screen.queryByTestId('passenger-profile-email')).toBeNull();
    expect(screen.getByTestId('passenger-profile-meta').props.children).toBe('Rider');
    expect(screen.getByText('Female')).toBeTruthy();
    expect(screen.getByText('8 Oct 1995')).toBeTruthy();
  });

  it('back button returns to Settings', async () => {
    await renderScreen(PassengerProfile, 'light');
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
