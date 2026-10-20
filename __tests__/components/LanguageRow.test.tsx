/**
 * T-523: Account → App → Language shows the current language and opens a kit sheet with English
 * and Roman Urdu; a pick applies after the sheet has closed and is saved on the device.
 */
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import { LanguageRow } from '../../src/features/account/components/PreferenceRows';
import { getLocale } from '../../src/i18n';
import { LANGUAGE_STORAGE_KEY, resetLanguagePreferenceForTests } from '../../src/i18n/languagePreference';

const renderRow = async () => {
  render(
    <ThemeProvider>
      <LanguageRow />
    </ThemeProvider>,
  );
  await act(async () => {});
};

beforeEach(async () => {
  resetLanguagePreferenceForTests();
  await AsyncStorage.clear();
});

afterEach(() => resetLanguagePreferenceForTests());

describe('LanguageRow', () => {
  it('shows the current language and switches to Roman Urdu from the sheet', async () => {
    await renderRow();
    expect(screen.getByTestId('settings-language').props.accessibilityLabel).toBe('Language, English');
    expect(screen.queryByTestId('settings-language-sheet')).toBeNull();

    fireEvent.press(screen.getByTestId('settings-language'));
    await act(async () => {});
    const english = screen.getByTestId('settings-language-option-en');
    expect(english.props.accessibilityRole).toBe('radio');
    expect(english.props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('settings-language-option-ur-Latn').props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByText('Urdu in English letters')).toBeTruthy();

    fireEvent.press(screen.getByTestId('settings-language-option-ur-Latn'));
    await act(async () => {});
    expect(screen.queryByTestId('settings-language-option-en')).toBeNull();
    expect(getLocale()).toBe('ur-Latn');
    expect(await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ur-Latn');
    // The row re-renders in the new language.
    expect(screen.getByTestId('settings-language').props.accessibilityLabel).toBe('Zaban, Roman Urdu');
  });

  it('picking the current language changes nothing', async () => {
    await renderRow();
    fireEvent.press(screen.getByTestId('settings-language'));
    await act(async () => {});
    fireEvent.press(screen.getByTestId('settings-language-option-en'));
    await act(async () => {});
    expect(getLocale()).toBe('en');
    expect(await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });
});
