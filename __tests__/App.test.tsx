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
  await waitFor(() => expect(screen.getByText('Welcome to RaaH-E-Haq')).toBeTruthy());
  screen.unmount();
}, COLD_TRANSFORM_TIMEOUT_MS);
