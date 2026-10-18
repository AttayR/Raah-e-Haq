/**
 * T-523: switching the language changes `t()`, `strings()`, `perLocale` values and feature copy at
 * once; a key a translation lacks falls back to English; `useLocale` re-renders on a switch.
 */
import React from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import {
  acceptLanguage,
  getLocale,
  isLocale,
  localeTag,
  perLocale,
  setLocale,
  strings,
  subscribeLocale,
  t,
} from '../../src/i18n';
import { localizedCopy, registerCopyTranslation } from '../../src/i18n/localizedCopy';
import { resetLanguagePreferenceForTests, useLocale } from '../../src/i18n/languagePreference';
import { greetingFor } from '../../src/features/passenger-home/greeting';
import { BOOKING_COPY } from '../../src/features/ride-booking/copy';
import '../../src/i18n/copy-ur-Latn';

afterEach(() => resetLanguagePreferenceForTests());

describe('t() and strings() follow the active language', () => {
  it('switches strings and fills placeholders in Roman Urdu', () => {
    expect(t('common.tryAgain')).toBe('Try again');
    setLocale('ur-Latn');
    expect(getLocale()).toBe('ur-Latn');
    expect(t('common.tryAgain')).toBe('Dobara koshish karein');
    expect(t('drive.todayEarnings', { amount: 'Rs 1,250' })).toBe('Aaj · Rs 1,250');
  });

  it('falls back to English for a key Roman Urdu does not have', () => {
    setLocale('ur-Latn');
    // The debug-only kit gallery stays English.
    expect(t('kitGallery.title')).toBe('UI kit gallery');
    expect(t('kitGallery.modeLabel', { mode: 'dark' })).toBe('Mode: dark');
  });

  it('merges the tables for non-string entries and keeps Latin formatting', () => {
    setLocale('ur-Latn');
    expect(strings().format.today).toBe('Aaj');
    expect(strings().format.currencyPKR).toBe('Rs');
    expect(strings().format.monthsShort).toHaveLength(12);
    expect(strings().format.weekdaysShort).toHaveLength(7);
    expect(strings().kitGallery.title).toBe('UI kit gallery');
    expect(localeTag()).toBe('en-PK');
  });

  it('builds the Accept-Language header from the language', () => {
    expect(acceptLanguage()).toBe('en');
    setLocale('ur-Latn');
    expect(acceptLanguage()).toBe('ur-Latn, en;q=0.8');
  });

  it('recognises only the supported languages', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('ur-Latn')).toBe(true);
    expect(isLocale('ur')).toBe(false);
    expect(isLocale(null)).toBe(false);
  });

  it('tells subscribers about a change, once per real change', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeLocale(listener);
    setLocale('ur-Latn');
    setLocale('ur-Latn');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setLocale('en');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('perLocale builds once per language and keeps its identity', () => {
    const build = jest.fn(() => [t('common.cancel'), t('common.done')]);
    const options = perLocale(build);
    const english = options();
    expect(options()).toBe(english);
    expect(english).toEqual(['Cancel', 'Done']);
    setLocale('ur-Latn');
    expect(options()).toEqual(['Cancel', 'Ho gaya']);
    setLocale('en');
    expect(options()).toBe(english);
    expect(build).toHaveBeenCalledTimes(2);
  });
});

describe('localizedCopy', () => {
  const makeCopy = () =>
    localizedCopy({
      title: 'Wallet',
      retry: 'Try again',
      nested: { label: 'Pickup', other: 'Drop-off' },
      count: (n: number) => `${n} rides`,
      notes: ['one', 'two'],
      flag: true,
    } as const);

  it('reads English until a translation is active, then the translation, else English', () => {
    const copy = makeCopy();
    registerCopyTranslation(copy, 'ur-Latn', {
      retry: 'Dobara koshish karein',
      nested: { label: 'Pickup yahan' },
      count: (n: number) => `${n} rides huin`,
      notes: ['aik', 'do'],
    });
    expect(copy.retry).toBe('Try again');
    setLocale('ur-Latn');
    expect(copy.retry).toBe('Dobara koshish karein');
    expect(copy.title).toBe('Wallet');
    expect(copy.nested.label).toBe('Pickup yahan');
    expect(copy.nested.other).toBe('Drop-off');
    expect(copy.count(3)).toBe('3 rides huin');
    expect(copy.notes).toEqual(['aik', 'do']);
    expect(copy.flag).toBe(true);
    // A nested object read twice is the same object (stable for memoised props).
    expect(copy.nested).toBe(copy.nested);
    // A nested object captured at module load still follows a later switch.
    const nested = copy.nested;
    setLocale('en');
    expect(nested.label).toBe('Pickup');
  });

  it('refuses a plain object', () => {
    expect(() => registerCopyTranslation({ a: 'b' }, 'ur-Latn', { a: 'c' })).toThrow(/localizedCopy/);
  });
});

describe('useLocale', () => {
  function Probe() {
    const locale = useLocale();
    return <Text testID="probe">{`${locale}:${t('common.done')}`}</Text>;
  }

  it('re-renders with the new language', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe').props.children).toBe('en:Done');
    act(() => setLocale('ur-Latn'));
    expect(screen.getByTestId('probe').props.children).toBe('ur-Latn:Ho gaya');
  });
});

describe('Home and booking sheet copy (T-523)', () => {
  it('greets and labels in the active language', () => {
    const morning = new Date(2026, 9, 18, 8, 0, 0);
    expect(greetingFor(morning, 'Ali Khan')).toBe('Good morning, Ali');
    expect(BOOKING_COPY.destinationPlaceholder).toBe('Where to?');
    setLocale('ur-Latn');
    expect(greetingFor(morning, 'Ali Khan')).toBe('Subah bakhair, Ali');
    expect(greetingFor(morning, null)).toBe('Subah bakhair');
    expect(BOOKING_COPY.destinationPlaceholder).toBe('Kahan jana hai?');
    expect(BOOKING_COPY.optionalStops(3)).toBe('Optional stops add karein (3 tak)');
  });
});
