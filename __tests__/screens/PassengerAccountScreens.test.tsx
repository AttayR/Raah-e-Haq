/**
 * T-618 (passenger side): Settings and Profile render on theme tokens in light and dark, at
 * iPhone SE width with 1.3x text, have no dead rows, no image overlay and no invented numbers,
 * and every row goes to a real screen.
 */
import React from 'react';
import {
  Alert,
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
import PassengerProfile from '../../src/screens/Passenger/Passengerprofile';
import { LOGOUT_CONFIRM_TITLE } from '../../src/hooks/useLogout';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, canGoBack: () => true }),
  useIsFocused: () => true,
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
    // No dead rows: Help & support and Invite friends come back with T-619.
    expect(screen.queryByText(/help/i)).toBeNull();
    expect(screen.queryByText(/invite/i)).toBeNull();
    // Active accounts show no status badge.
    expect(screen.queryByTestId('passenger-settings-status')).toBeNull();
    expectOnlyThemeColors(theme);
  });

  it('every row goes somewhere real; the profile card opens the profile view', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await renderScreen(PassengerSettingsScreen, 'light');
    fireEvent.press(screen.getByTestId('passenger-settings-profile'));
    expect(mockNavigate).toHaveBeenLastCalledWith('PassengerPofile');
    fireEvent.press(screen.getByTestId('passenger-settings-wallet'));
    expect(mockNavigate).toHaveBeenLastCalledWith('Wallet');
    fireEvent.press(screen.getByTestId('passenger-settings-saved-places'));
    expect(mockNavigate).toHaveBeenLastCalledWith('FavoriteLocations');
    fireEvent.press(screen.getByTestId('passenger-settings-ride-history'));
    expect(mockNavigate).toHaveBeenLastCalledWith('RideHistory');
    fireEvent.press(screen.getByTestId('passenger-settings-notifications'));
    expect(mockNavigate).toHaveBeenLastCalledWith('NotificationPreferences');
    fireEvent.press(screen.getByTestId('passenger-settings-phone-notifications'));
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('profile card is one accessible button with name and contact', async () => {
    await renderScreen(PassengerSettingsScreen, 'light');
    expect(screen.getByRole('button', { name: 'Test Passenger, +920000000001' })).toBeTruthy();
  });

  it('sign out asks for confirmation first (T-102)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderScreen(PassengerSettingsScreen, 'light');
    fireEvent.press(screen.getByTestId('passenger-settings-sign-out'));
    expect(alert).toHaveBeenCalledWith(LOGOUT_CONFIRM_TITLE, expect.any(String), expect.any(Array));
  });

  it('pending account: the card says "Pending approval"', async () => {
    await renderScreen(PassengerSettingsScreen, 'light', { ...basePassenger, status: 'pending' });
    expect(screen.getByTestId('passenger-settings-status')).toBeTruthy();
    expect(screen.getByText('Pending approval')).toBeTruthy();
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

  it('appearance control switches to dark and persists the choice', async () => {
    await renderScreen(PassengerSettingsScreen, 'light');
    await act(async () => {
      fireEvent.press(screen.getByRole('radio', { name: 'Appearance, Dark' }));
    });
    expect(flat(screen.getByTestId('passenger-settings').props.style).backgroundColor).toBe(DarkTheme.colors.background);
    expect(await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('dark');
  });
});

describe('PassengerProfile', () => {
  it.each([
    ['light', LightTheme],
    ['dark', DarkTheme],
  ] as const)('%s: no overlay, initials avatar, real fields only, only tokens', async (mode, theme) => {
    await renderScreen(PassengerProfile, mode);
    expect(flat(screen.getByTestId('passenger-profile').props.style).backgroundColor).toBe(theme.colors.background);
    // No background image / dimming overlay (QA: page looked greyed out).
    expect(screen.UNSAFE_root.findAll((node) => node.props.source !== undefined && typeof node.type !== 'string')).toHaveLength(0);
    expect(screen.getByText('TP')).toBeTruthy();
    expect(screen.getByText('Test Passenger')).toBeTruthy();
    expect(screen.getByTestId('passenger-profile-meta').props.children).toBe('Rider · Member since Mar 2026');
    expect(screen.getByText('+920000000001')).toBeTruthy();
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.getByText('passenger@example.test')).toBeTruthy();
    // No invented stats (4.8 / 24 / 2y) and no raw "( passenger )" role.
    expect(screen.queryByText(/4\.8|^24$|2y/)).toBeNull();
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
