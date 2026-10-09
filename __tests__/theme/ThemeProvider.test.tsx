/** T-601: ThemeProvider follows the system scheme live and persists a user override. */
import React from 'react';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  APPEARANCE_READ_TIMEOUT_MS,
  APPEARANCE_STORAGE_KEY,
  ThemeProvider,
  resolveColorMode,
  useAppTheme,
  type AppearancePreference,
} from '../../src/app/providers/ThemeProvider';
import { DarkTheme, LightTheme } from '../../src/theme';
import { logger } from '../../src/core/logging/logger';

// Controllable system appearance (what useColorScheme subscribes to).
let mockSystemScheme: 'light' | 'dark' | null = 'light';
const mockListeners = new Set<() => void>();
jest.mock('react-native/Libraries/Utilities/Appearance', () => ({
  getColorScheme: () => mockSystemScheme,
  addChangeListener: (listener: () => void) => {
    mockListeners.add(listener);
    return { remove: () => mockListeners.delete(listener) };
  },
  setColorScheme: jest.fn(),
}));
// The react-native Jest preset stubs useColorScheme to 'light'; use the real hook so the
// subscription to Appearance changes is exercised.
jest.mock('react-native/Libraries/Utilities/useColorScheme', () =>
  jest.requireActual('react-native/Libraries/Utilities/useColorScheme'),
);

const setSystemScheme = (scheme: 'light' | 'dark' | null) => {
  mockSystemScheme = scheme;
  act(() => mockListeners.forEach(listener => listener()));
};

function Probe() {
  const { theme, scheme, setScheme } = useAppTheme();
  const pick = (value: AppearancePreference) => () => setScheme(value);
  return (
    <>
      <Text testID="mode">{theme.mode}</Text>
      <Text testID="pref">{scheme}</Text>
      <Text testID="bar">{theme.statusBarStyle}</Text>
      <Text testID="bg">{theme.colors.background}</Text>
      <Text accessibilityRole="button" testID="pick-light" onPress={pick('light')}>light</Text>
      <Text accessibilityRole="button" testID="pick-dark" onPress={pick('dark')}>dark</Text>
      <Text accessibilityRole="button" testID="pick-system" onPress={pick('system')}>system</Text>
    </>
  );
}

const mountProbe = () =>
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );

/** Mounts and lets the stored-preference read settle (children are held until then). */
const renderProbe = async () => {
  mountProbe();
  await act(async () => {});
};

const text = (id: string) => screen.getByTestId(id).props.children;

beforeEach(async () => {
  mockSystemScheme = 'light';
  mockListeners.clear();
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('resolveColorMode', () => {
  it('uses the override, else the system scheme, defaulting to light', () => {
    expect(resolveColorMode('dark', 'light')).toBe('dark');
    expect(resolveColorMode('light', 'dark')).toBe('light');
    expect(resolveColorMode('system', 'dark')).toBe('dark');
    expect(resolveColorMode('system', 'light')).toBe('light');
    expect(resolveColorMode('system', null)).toBe('light');
    expect(resolveColorMode('system', undefined)).toBe('light');
  });
});

describe('ThemeProvider', () => {
  it('follows the system scheme and re-renders when it changes while mounted', async () => {
    await renderProbe();
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalledWith(APPEARANCE_STORAGE_KEY));
    expect(text('mode')).toBe('light');
    expect(text('bar')).toBe('dark-content');
    expect(text('bg')).toBe(LightTheme.colors.background);

    setSystemScheme('dark');
    expect(text('mode')).toBe('dark');
    expect(text('bar')).toBe('light-content');
    expect(text('bg')).toBe(DarkTheme.colors.background);

    setSystemScheme('light');
    expect(text('mode')).toBe('light');
  });

  it('a user override wins over the system scheme, is persisted, and System restores following', async () => {
    await renderProbe();
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());

    fireEvent.press(screen.getByTestId('pick-dark'));
    expect(text('mode')).toBe('dark');
    expect(text('pref')).toBe('dark');
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith(APPEARANCE_STORAGE_KEY, 'dark'));

    setSystemScheme('light');
    expect(text('mode')).toBe('dark');

    fireEvent.press(screen.getByTestId('pick-system'));
    expect(text('mode')).toBe('light');
    setSystemScheme('dark');
    expect(text('mode')).toBe('dark');
  });

  it('restores the persisted preference on start', async () => {
    await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, 'dark');
    await renderProbe();
    await waitFor(() => expect(text('mode')).toBe('dark'));
    expect(text('pref')).toBe('dark');
  });

  it('ignores an invalid stored value', async () => {
    await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, 'sepia');
    await renderProbe();
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());
    expect(text('pref')).toBe('system');
    expect(text('mode')).toBe('light');
  });

  it('keeps working when storage throws on read and on write', async () => {
    const debug = jest.spyOn(logger, 'debug').mockImplementation(() => {});
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('storage down'));
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('storage down'));
    await renderProbe();
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());
    expect(text('mode')).toBe('light');

    fireEvent.press(screen.getByTestId('pick-dark'));
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalled());
    expect(text('mode')).toBe('dark');
    // Failures are logged at debug level with the error message only.
    await waitFor(() =>
      expect(debug).toHaveBeenCalledWith('[theme] could not save appearance preference', { error: 'storage down' }),
    );
    expect(debug).toHaveBeenCalledWith('[theme] could not read appearance preference', { error: 'storage down' });
    debug.mockRestore();
  });

  it('holds children until the stored preference is read, so a forced mode never flashes', async () => {
    await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, 'dark');
    let release: (value: string | null) => void = () => {};
    (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(
      () => new Promise<string | null>(resolve => { release = resolve; }),
    );
    mountProbe();
    expect(screen.queryByTestId('mode')).toBeNull();
    await act(async () => release('dark'));
    // First painted frame is already the stored mode, not the light system scheme.
    expect(text('mode')).toBe('dark');
  });

  describe('slow storage', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it(`shows children after ${APPEARANCE_READ_TIMEOUT_MS} ms if the read has not finished`, async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(() => new Promise<string | null>(() => {}));
      mountProbe();
      act(() => jest.advanceTimersByTime(APPEARANCE_READ_TIMEOUT_MS - 1));
      expect(screen.queryByTestId('mode')).toBeNull();
      act(() => jest.advanceTimersByTime(1));
      expect(text('mode')).toBe('light');
    });

    it('a late read still applies the stored preference, unless the user already chose', async () => {
      let release: (value: string | null) => void = () => {};
      (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(
        () => new Promise<string | null>(resolve => { release = resolve; }),
      );
      mountProbe();
      act(() => jest.advanceTimersByTime(APPEARANCE_READ_TIMEOUT_MS));
      fireEvent.press(screen.getByTestId('pick-light'));
      await act(async () => release('dark'));
      expect(text('pref')).toBe('light');
      expect(text('mode')).toBe('light');
    });

    it('a late read applies when the user has not chosen', async () => {
      let release: (value: string | null) => void = () => {};
      (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(
        () => new Promise<string | null>(resolve => { release = resolve; }),
      );
      mountProbe();
      act(() => jest.advanceTimersByTime(APPEARANCE_READ_TIMEOUT_MS));
      expect(text('mode')).toBe('light');
      await act(async () => release('dark'));
      expect(text('mode')).toBe('dark');
    });
  });
});
