/**
 * T-582 (QA 2026-10-19 obs 6): when Home's first reads failed (backend down), "Try again" brought
 * the recent rides back but not the saved-place chips, which stayed away until a relaunch. Try
 * again now re-reads the saved places too when they failed, and a return to Home retries them
 * after a failed first read. No extra request for what already loaded.
 */
import React from 'react';
import { Provider } from 'react-redux';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import { apiClient } from '../../src/services/api';
import PassengerHomeScreen from '../../src/screens/Passenger/PassengerHomeScreen';
import { clearQueryCache } from '../../src/core/api/queryCache';
import { makeStore, page } from '../../test-utils/rideFixtures';

let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
  useIsFocused: () => mockFocused,
}));

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
};

const home = () => (
  <Provider store={makeStore()}>
    <ThemeProvider>
      <PassengerHomeScreen />
    </ThemeProvider>
  </Provider>
);

const SAVED = {
  success: true,
  data: {
    places: [{ id: 1, label: 'home', name: null, address: 'House 1, DHA Phase 5, Lahore', lat: 31.46, lng: 74.4, place_id: null, sort_order: 0, updated_at: null }],
    max_other: 10,
  },
};

const gets = (mock: MockAdapter, url: string) => mock.history.get.filter((r) => r.url === url).length;

let mock: MockAdapter;

beforeEach(() => {
  clearQueryCache();
  mockFocused = true;
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('[T-582] Home retries the saved places', () => {
  it('"Try again" re-reads the rides and the failed saved places; the chips come back', async () => {
    mock.onGet('/rides').replyOnce(500, { success: false, message: 'Server error' });
    mock.onGet('/saved-places').replyOnce(500, { success: false, message: 'Server error' });
    render(home());
    await flush();
    expect(screen.getByTestId('home-recent-rides-error')).toBeTruthy();
    expect(screen.queryByTestId('home-saved-place-1')).toBeNull();

    mock.onGet('/rides').reply(200, page([]));
    mock.onGet('/saved-places').reply(200, SAVED);
    fireEvent.press(screen.getByText('Try again'));
    await flush();

    expect(screen.getByTestId('home-saved-place-1')).toHaveTextContent(/Home/);
    expect(gets(mock, '/rides')).toBe(2);
    expect(gets(mock, '/saved-places')).toBe(2);
  });

  it('"Try again" leaves loaded saved places alone (no second read)', async () => {
    mock.onGet('/rides').replyOnce(500, { success: false, message: 'Server error' });
    mock.onGet('/saved-places').reply(200, SAVED);
    render(home());
    await flush();
    mock.onGet('/rides').reply(200, page([]));
    fireEvent.press(screen.getByText('Try again'));
    await flush();
    expect(gets(mock, '/rides')).toBe(2);
    expect(gets(mock, '/saved-places')).toBe(1);
  });

  it('back on Home after a failed first read, the saved places are read again once', async () => {
    mock.onGet('/rides').reply(200, page([]));
    mock.onGet('/saved-places').replyOnce(500, { success: false, message: 'Server error' });
    const view = render(home());
    await flush();
    expect(screen.queryByTestId('home-saved-place-1')).toBeNull();

    mock.onGet('/saved-places').reply(200, SAVED);
    mockFocused = false;
    view.rerender(home());
    await flush();
    mockFocused = true;
    view.rerender(home());
    await flush();

    expect(screen.getByTestId('home-saved-place-1')).toBeTruthy();
    expect(gets(mock, '/saved-places')).toBe(2);
  });
});
