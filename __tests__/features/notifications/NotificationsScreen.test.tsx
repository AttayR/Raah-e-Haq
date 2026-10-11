/**
 * T-502: the notifications list (both roles) on GET /notifications: loading, error + retry,
 * empty, rows, mark read on open, mark all read; and the preferences switches on BE-11.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { NotificationsScreen } from '../../../src/features/notifications/screens/NotificationsScreen';
import { NotificationPreferencesScreen } from '../../../src/features/notifications/screens/NotificationPreferencesScreen';
import { toast } from '../../../src/core/toast';

const mockNavDispatch = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useNavigation: () => ({
    dispatch: mockNavDispatch,
    goBack: mockGoBack,
    getParent: () => undefined,
    getState: () => ({ routeNames: ['Driver'], routes: [{ key: 'd', name: 'Driver' }] }),
  }),
}));

const row = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  type: 'promotion',
  category: 'promo',
  title: `Offer ${id}`,
  body: `Body ${id}`,
  data: {},
  image_url: null,
  action_url: null,
  action_text: null,
  is_broadcast: true,
  read_at: null,
  created_at: '2026-10-11T12:00:00+00:00',
  ...overrides,
});

const listBody = (rows: unknown[]) => ({
  success: true,
  data: rows,
  pagination: { current_page: 1, last_page: 1, per_page: 20, total: rows.length },
});

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
};

const renderWith = (ui: React.ReactElement) => {
  const store = configureStore({ reducer: rootReducer });
  render(
    <Provider store={store}>
      <ThemeProvider>{ui}</ThemeProvider>
    </Provider>,
  );
  return store;
};

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mockNavDispatch.mockClear();
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('NotificationsScreen', () => {
  it('shows a loader, then the rows from the API (no demo data)', async () => {
    let release!: (value: [number, unknown]) => void;
    mock.onGet('/notifications').replyOnce(
      () => new Promise<[number, unknown]>((resolve) => { release = resolve; }),
    );
    renderWith(<NotificationsScreen role="driver" />);
    await flush();
    expect(screen.getByTestId('notifications-loading')).toBeTruthy();
    release([200, listBody([row(1), row(2, { read_at: '2026-10-11T12:00:00+00:00' })])]);
    await flush();
    expect(screen.getByText('Offer 1')).toBeTruthy();
    expect(screen.getByText('Offer 2')).toBeTruthy();
    expect(screen.getByTestId('notification-unread-1')).toBeTruthy();
    expect(screen.queryByTestId('notification-unread-2')).toBeNull();
    expect(screen.queryByText('20% Off This Weekend')).toBeNull();
  });

  it('an empty list says so', async () => {
    mock.onGet('/notifications').reply(200, listBody([]));
    renderWith(<NotificationsScreen role="passenger" />);
    await flush();
    expect(screen.getByTestId('notifications-empty')).toBeTruthy();
    expect(screen.getByText('No notifications yet')).toBeTruthy();
  });

  it('a failed load shows an error with Try again, which reloads', async () => {
    mock.onGet('/notifications').networkErrorOnce();
    renderWith(<NotificationsScreen role="driver" />);
    await flush();
    expect(screen.getByTestId('notifications-error')).toBeTruthy();

    mock.onGet('/notifications').reply(200, listBody([row(3)]));
    fireEvent.press(screen.getByTestId('notifications-retry'));
    await flush();
    expect(screen.getByText('Offer 3')).toBeTruthy();
  });

  it('opening an unread row marks it read on the server', async () => {
    mock.onGet('/notifications').reply(200, listBody([row(1)]));
    mock.onPost('/notifications/1/read').reply(200, { success: true, data: row(1, { read_at: '2026-10-11T12:05:00+00:00' }) });
    renderWith(<NotificationsScreen role="driver" />);
    await flush();

    fireEvent.press(screen.getByTestId('notification-row-1'));
    await flush();

    expect(mock.history.post.map((r) => r.url)).toEqual(['/notifications/1/read']);
    expect(screen.queryByTestId('notification-unread-1')).toBeNull();
    // A promo row has nowhere else to go.
    expect(mockNavDispatch).not.toHaveBeenCalled();
  });

  it('a ride row opens the driver ride screen', async () => {
    mock.onGet('/notifications').reply(200, listBody([row(4, { category: 'ride', type: 'stop_added', data: { ride_id: 9 }, read_at: 'x' })]));
    renderWith(<NotificationsScreen role="driver" />);
    await flush();
    fireEvent.press(screen.getByTestId('notification-row-4'));
    expect(mockNavDispatch).toHaveBeenCalledTimes(1);
    expect(mock.history.post).toHaveLength(0);
  });

  it('Mark all read posts read-all and clears the dots', async () => {
    mock.onGet('/notifications').reply(200, listBody([row(1), row(2)]));
    mock.onPost('/notifications/read-all').reply(200, { success: true, data: { unread_count: 0 } });
    const store = renderWith(<NotificationsScreen role="passenger" />);
    store.dispatch({ type: 'notifications/unreadCount/fulfilled', payload: 2, meta: {} });
    await flush();

    fireEvent.press(screen.getByTestId('notifications-mark-all'));
    await flush();

    expect(mock.history.post.map((r) => r.url)).toEqual(['/notifications/read-all']);
    expect(screen.queryByTestId('notification-unread-1')).toBeNull();
    expect(store.getState().notifications.unreadCount).toBe(0);
  });

  it('the Unread filter asks the server for unread rows only', async () => {
    mock.onGet('/notifications').reply(200, listBody([row(1)]));
    renderWith(<NotificationsScreen role="passenger" />);
    await flush();
    fireEvent.press(screen.getByRole('radio', { name: 'Show notifications, Unread' }));
    await flush();
    expect(mock.history.get[mock.history.get.length - 1].params).toEqual({ page: 1, per_page: 20, unread: 1 });
  });
});

describe('NotificationPreferencesScreen', () => {
  const prefs = { push_enabled: true, ride_updates: true, promotions: true, chat: true, sound_alerts: true };

  it('loads the switches and saves one change with PUT', async () => {
    mock.onGet('/notifications/preferences').reply(200, { success: true, data: prefs });
    mock.onPut('/notifications/preferences').reply(200, { success: true, data: { ...prefs, promotions: false } });
    renderWith(<NotificationPreferencesScreen />);
    await flush();

    fireEvent(screen.getByTestId('notification-pref-promotions'), 'valueChange', false);
    await flush();

    expect(JSON.parse(mock.history.put[0].data)).toEqual({ promotions: false });
    expect(screen.getByTestId('notification-pref-promotions').props.value).toBe(false);
  });

  it('a refused save puts the switch back and says so', async () => {
    mock.onGet('/notifications/preferences').reply(200, { success: true, data: prefs });
    mock.onPut('/notifications/preferences').reply(500, { success: false, message: 'Server error' });
    const error = jest.spyOn(toast, 'error');
    renderWith(<NotificationPreferencesScreen />);
    await flush();

    fireEvent(screen.getByTestId('notification-pref-chat'), 'valueChange', false);
    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(screen.getByTestId('notification-pref-chat').props.value).toBe(true);
  });

  it('a failed load offers Try again', async () => {
    mock.onGet('/notifications/preferences').networkErrorOnce();
    renderWith(<NotificationPreferencesScreen />);
    await flush();
    expect(screen.getByTestId('notification-preferences-error')).toBeTruthy();
  });
});
