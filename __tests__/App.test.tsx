/**
 * @format
 */

import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

// The store calls persistStore() at import time, which arms redux-persist's 5 s
// rehydration timeout. App is loaded after fake timers are on, so the test can flush
// that timer instead of keeping Jest alive after the run.
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

// Requiring App transforms the whole app graph. With a cold Jest cache (first run after a
// babel config or dependency change, or --no-cache) that alone takes about 13 s, well past
// Jest's 5 s default, so this test gets a budget sized for a cold transform.
const COLD_TRANSFORM_TIMEOUT_MS = 30_000;

test('App renders the signed-out Login screen without throwing', async () => {
  const { default: App } = require('../App') as typeof import('../App');
  const screen = render(<App />);
  // PersistGate rehydrates from the (mocked, empty) AsyncStorage; signed out, so Login mounts.
  await waitFor(() => expect(screen.getByText('Sign in to Raah-e-Haq')).toBeTruthy());
  screen.unmount();
}, COLD_TRANSFORM_TIMEOUT_MS);

test('a language switch re-renders the app in the new language and keeps the open screen (T-523)', async () => {
  const { default: App } = require('../App') as typeof import('../App');
  const { changeLanguage, resetLanguagePreferenceForTests } =
    require('../src/i18n/languagePreference') as typeof import('../src/i18n/languagePreference');
  const { fireEvent } = require('@testing-library/react-native') as typeof import('@testing-library/react-native');
  const screen = render(<App />);
  await waitFor(() => expect(screen.getByText('Continue with phone')).toBeTruthy());
  fireEvent.press(screen.getByText('Continue with phone'));
  await waitFor(() => expect(screen.getByText('Sign in with your phone')).toBeTruthy());
  act(() => changeLanguage('ur-Latn'));
  // Same screen (navigation state kept across the remount), now in Roman Urdu.
  await waitFor(() => expect(screen.getByText('Apne phone se sign in karein')).toBeTruthy());
  expect(screen.queryByText('Sign in with your phone')).toBeNull();
  screen.unmount();
  resetLanguagePreferenceForTests();
}, COLD_TRANSFORM_TIMEOUT_MS);
