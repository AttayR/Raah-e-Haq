/**
 * T-523 / T-575: a language switch remounts a leaf screen (`localeScreenLayout`) so it reads the
 * new copy, and never remounts a screen that hosts a navigator (`keepScreenMounted`).
 */
import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { setLocale, t } from '../../src/i18n';
import { resetLanguagePreferenceForTests } from '../../src/i18n/languagePreference';
import { keepScreenMounted, localeScreenLayout } from '../../src/app/navigation/localeScreenLayout';

afterEach(() => resetLanguagePreferenceForTests());

function Screen({ onMount }: { onMount: () => void }) {
  useEffect(onMount, [onMount]);
  return <Text>{t('common.tryAgain')}</Text>;
}

describe('localeScreenLayout', () => {
  it('remounts the screen on a switch, and only on a real switch', () => {
    const onMount = jest.fn();
    render(localeScreenLayout({ children: <Screen onMount={onMount} /> }));
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Try again')).toBeTruthy();

    act(() => setLocale('ur-Latn'));
    expect(onMount).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Dobara koshish karein')).toBeTruthy();

    act(() => setLocale('ur-Latn'));
    expect(onMount).toHaveBeenCalledTimes(2);
  });
});

describe('keepScreenMounted', () => {
  it('returns the screen as it is: a switch never remounts it', () => {
    const onMount = jest.fn();
    const child = <Screen onMount={onMount} />;
    expect(keepScreenMounted({ children: child })).toBe(child);
    render(keepScreenMounted({ children: child }));
    act(() => setLocale('ur-Latn'));
    expect(onMount).toHaveBeenCalledTimes(1);
  });
});
