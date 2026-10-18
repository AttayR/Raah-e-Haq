/**
 * T-523: the chosen language is kept on the device (AsyncStorage `rh.language`), restored at
 * startup before the app shows, and storage failures never break the switch.
 */
import React from 'react';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getLocale, t } from '../../src/i18n';
import {
  LANGUAGE_STORAGE_KEY,
  changeLanguage,
  readStoredLanguage,
  resetLanguagePreferenceForTests,
  restoreStoredLanguage,
} from '../../src/i18n/languagePreference';
import { LANGUAGE_READ_TIMEOUT_MS, LanguageGate } from '../../src/app/providers/LanguageGate';

beforeEach(async () => {
  resetLanguagePreferenceForTests();
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
  resetLanguagePreferenceForTests();
});

describe('language preference', () => {
  it('changeLanguage switches at once and persists the choice', async () => {
    changeLanguage('ur-Latn');
    expect(getLocale()).toBe('ur-Latn');
    await act(async () => {});
    expect(await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ur-Latn');
  });

  it('restores the stored language once', async () => {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, 'ur-Latn');
    await expect(restoreStoredLanguage()).resolves.toBe('ur-Latn');
    expect(getLocale()).toBe('ur-Latn');
    expect(restoreStoredLanguage()).toBe(restoreStoredLanguage());
  });

  it('ignores an unknown stored value', async () => {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    await expect(readStoredLanguage()).resolves.toBeNull();
    await restoreStoredLanguage();
    expect(getLocale()).toBe('en');
  });

  it('keeps English when storage cannot be read', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
    await expect(restoreStoredLanguage()).resolves.toBeNull();
    expect(getLocale()).toBe('en');
  });

  it('keeps the choice for the session when it cannot be saved', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk'));
    changeLanguage('ur-Latn');
    await act(async () => {});
    expect(getLocale()).toBe('ur-Latn');
  });

  it('a slow read never overwrites a language the user already picked', async () => {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, 'ur-Latn');
    const pending = restoreStoredLanguage();
    changeLanguage('en');
    await pending;
    expect(getLocale()).toBe('en');
  });
});

describe('LanguageGate', () => {
  // A component, like the app's navigation: its copy is read when the gate renders it.
  function App() {
    return <Text testID="app">{t('common.done')}</Text>;
  }

  it('shows the fallback until the stored language is active, then the app in it', async () => {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, 'ur-Latn');
    render(
      <LanguageGate fallback={<Text testID="splash">splash</Text>}>
        <App />
      </LanguageGate>,
    );
    expect(screen.getByTestId('splash')).toBeTruthy();
    await act(async () => {});
    expect(screen.queryByTestId('splash')).toBeNull();
    expect(screen.getByTestId('app').props.children).toBe('Ho gaya');
  });

  describe('a stored-language read slower than the timeout', () => {
    let finishRead: (value: string | null) => void = () => {};

    beforeEach(() => {
      jest.useFakeTimers();
      jest.spyOn(AsyncStorage, 'getItem').mockImplementation(
        () =>
          new Promise<string | null>(resolve => {
            finishRead = resolve;
          }),
      );
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const renderGate = () =>
      render(
        <LanguageGate fallback={<Text testID="splash">splash</Text>}>
          <App />
        </LanguageGate>,
      );

    it('opens the app in English after the timeout, then applies the late read', async () => {
      renderGate();
      expect(screen.getByTestId('splash')).toBeTruthy();
      act(() => {
        jest.advanceTimersByTime(LANGUAGE_READ_TIMEOUT_MS - 1);
      });
      expect(screen.getByTestId('splash')).toBeTruthy();
      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(screen.getByTestId('app').props.children).toBe('Done');
      await act(async () => {
        finishRead('ur-Latn');
      });
      expect(getLocale()).toBe('ur-Latn');
    });

    it('drops the late read once the user has touched the app', async () => {
      renderGate();
      act(() => {
        jest.advanceTimersByTime(LANGUAGE_READ_TIMEOUT_MS);
      });
      fireEvent(screen.getByTestId('language-gate-late'), 'touchStart');
      await act(async () => {
        finishRead('ur-Latn');
      });
      expect(getLocale()).toBe('en');
      expect(screen.getByTestId('app').props.children).toBe('Done');
    });
  });
});

