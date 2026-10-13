/**
 * T-502: the notifications list (both roles) on GET /notifications: loading, error + retry,
 * empty, rows, mark read on open, mark all read; and the preferences switches on BE-11.
 * UI-R4: the list lives in the Inbox tab (Notifications | Messages), "Mark all read" in its bar.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import InboxScreen from '../../../src/features/inbox/InboxScreen';
import { chatApi } from '../../../src/features/chat/api';
import { NotificationPreferencesScreen } from '../../../src/features/notifications/screens/NotificationPreferencesScreen';
import { toast } from '../../../src/core/toast';
import { fetchUnreadCount } from '../../../src/features/notifications/slice';

const mockNavDispatch = jest.fn();
const mockGoBack = jest.fn();
let mockFocused = true;
let mockRouteParams: { segment?: 'notifications' | 'messages' } | undefined;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => mockFocused,
  useRoute: () => ({ key: 'Inbox-1', name: 'Inbox', params: mockRouteParams }),
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
  mockFocused = true;
  mockRouteParams = undefined;
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
    renderWith(<InboxScreen role="driver" />);
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
    renderWith(<InboxScreen role="passenger" />);
    await flush();
    expect(screen.getByTestId('notifications-empty')).toBeTruthy();
    expect(screen.getByText('No notifications yet')).toBeTruthy();
  });

  it('a failed load shows an error with Try again, which reloads', async () => {
    mock.onGet('/notifications').networkErrorOnce();
    renderWith(<InboxScreen role="driver" />);
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
    renderWith(<InboxScreen role="driver" />);
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
    renderWith(<InboxScreen role="driver" />);
    await flush();
    fireEvent.press(screen.getByTestId('notification-row-4'));
    expect(mockNavDispatch).toHaveBeenCalledTimes(1);
    expect(mock.history.post).toHaveLength(0);
  });

  it('Mark all read posts read-all and clears the dots', async () => {
    mock.onGet('/notifications').reply(200, listBody([row(1), row(2)]));
    mock.onPost('/notifications/read-all').reply(200, { success: true, data: { unread_count: 0 } });
    const store = renderWith(<InboxScreen role="passenger" />);
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
    renderWith(<InboxScreen role="passenger" />);
    await flush();
    fireEvent.press(screen.getByRole('radio', { name: 'Show notifications, Unread' }));
    await flush();
    // The last list read (the unread count is re-read after each list load, T-514).
    const listGets = mock.history.get.filter((r) => r.url === '/notifications');
    expect(listGets[listGets.length - 1].params).toEqual({ page: 1, per_page: 20, unread: 1 });
  });

  it('T-514: the badge count is re-read after the list loads, and never shows fewer than the unread rows', async () => {
    // The count polled earlier said 3; a fourth unread row arrived since.
    mock.onGet('/notifications').reply(200, listBody([row(1), row(2), row(3), row(4)]));
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { unread_count: 4 } });
    const store = renderWith(<InboxScreen role="passenger" />);
    await flush();
    const urls = mock.history.get.map((r) => r.url);
    expect(urls.indexOf('/notifications/unread-count')).toBeGreaterThan(urls.indexOf('/notifications'));
    expect(store.getState().notifications.unreadCount).toBe(4);
    // The count that follows the list does not mark it stale (no second list load).
    expect(mock.history.get.filter((r) => r.url === '/notifications')).toHaveLength(1);
  });
});

describe('Inbox tab (UI-R4)', () => {
  it('shows the large title and the Notifications | Messages segments; Messages lists chats and never loads notifications', async () => {
    mock.onGet('/notifications').reply(200, listBody([row(1)]));
    const chats = jest.spyOn(chatApi, 'listChats').mockResolvedValue([]);
    renderWith(<InboxScreen role="passenger" />);
    await flush();
    expect(screen.getAllByText('Inbox').length).toBeGreaterThan(0);
    expect(screen.getByText('Offer 1')).toBeTruthy();

    fireEvent.press(screen.getByRole('radio', { name: 'Inbox, Messages' }));
    await flush();
    expect(chats).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('chat-list-empty')).toBeTruthy();
    expect(screen.queryByText('Offer 1')).toBeNull();
    // Mark all read belongs to Notifications only.
    expect(screen.queryByTestId('notifications-mark-all')).toBeNull();
  });

  it('opens on Messages when navigated with segment=messages (chat push fallback)', async () => {
    mockRouteParams = { segment: 'messages' };
    const chats = jest.spyOn(chatApi, 'listChats').mockResolvedValue([]);
    renderWith(<InboxScreen role="driver" />);
    await flush();
    expect(chats).toHaveBeenCalledTimes(1);
    expect(mock.history.get.filter((r) => r.url === '/notifications')).toHaveLength(0);
  });

  it('hides "Mark all read" while nothing is unread', async () => {
    mock.onGet('/notifications').reply(200, listBody([row(1, { read_at: 'x' })]));
    renderWith(<InboxScreen role="passenger" />);
    await flush();
    expect(screen.queryByTestId('notifications-mark-all')).toBeNull();
  });
});

describe('NotificationsScreen reloads (T-513)', () => {
  const listGets = () => mock.history.get.filter((r) => r.url === '/notifications');

  const mount = () => {
    const store = configureStore({ reducer: rootReducer });
    const ui = () => (
      <Provider store={store}>
        <ThemeProvider>
          <InboxScreen role="passenger" />
        </ThemeProvider>
      </Provider>
    );
    const view = render(ui());
    return { store, rerender: () => view.rerender(ui()) };
  };

  it('reloads page 1 once each time the tab gains focus, not while it is hidden', async () => {
    mock.onGet('/notifications').replyOnce(200, listBody([]));
    const { rerender } = mount();
    await flush();
    expect(screen.getByTestId('notifications-empty')).toBeTruthy();
    expect(listGets()).toHaveLength(1);

    mockFocused = false;
    rerender();
    await flush();
    expect(listGets()).toHaveLength(1);

    mock.onGet('/notifications').replyOnce(200, listBody([row(7)]));
    mockFocused = true;
    rerender();
    await flush();
    expect(screen.getByText('Offer 7')).toBeTruthy();
    expect(listGets()).toHaveLength(2);

    // Re-renders while focused send nothing more.
    rerender();
    await flush();
    expect(listGets()).toHaveLength(2);
  });

  it('reloads once when the unread count goes up while the list is shown', async () => {
    mock.onGet('/notifications').replyOnce(200, listBody([]));
    const { store } = mount();
    await flush();
    expect(listGets()).toHaveLength(1);

    mock.onGet('/notifications/unread-count').replyOnce(200, { success: true, data: { unread_count: 4 } });
    mock.onGet('/notifications').replyOnce(200, listBody([row(1), row(2), row(3), row(4)]));
    await act(async () => {
      await store.dispatch(fetchUnreadCount());
    });
    await flush();
    expect(screen.getByText('Offer 4')).toBeTruthy();
    expect(listGets()).toHaveLength(2);

    // The same count again is not new: no reload.
    mock.onGet('/notifications/unread-count').replyOnce(200, { success: true, data: { unread_count: 4 } });
    await act(async () => {
      await store.dispatch(fetchUnreadCount());
    });
    await flush();
    expect(listGets()).toHaveLength(2);
  });

  it('a failed reload is not retried in a loop', async () => {
    mock.onGet('/notifications').replyOnce(200, listBody([row(1)]));
    const { store } = mount();
    await flush();
    mock.onGet('/notifications/unread-count').replyOnce(200, { success: true, data: { unread_count: 2 } });
    mock.onGet('/notifications').networkError();
    await act(async () => {
      await store.dispatch(fetchUnreadCount());
    });
    await flush();
    await flush();
    expect(listGets()).toHaveLength(2);
    expect(screen.getByText('Offer 1')).toBeTruthy();
    expect(screen.getByTestId('notifications-refresh-error')).toBeTruthy();
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

  it('tapping the whole row (not only the switch) toggles it and sends PUT', async () => {
    mock.onGet('/notifications/preferences').reply(200, { success: true, data: prefs });
    mock.onPut('/notifications/preferences').reply(200, { success: true, data: { ...prefs, ride_updates: false } });
    renderWith(<NotificationPreferencesScreen />);
    await flush();

    fireEvent.press(screen.getByTestId('notification-pref-rideUpdates-row'));
    await flush();

    expect(mock.history.put).toHaveLength(1);
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ ride_updates: false });
    expect(screen.getByTestId('notification-pref-rideUpdates').props.value).toBe(false);
  });

  it('rapid taps while a save is in flight are queued, not ignored', async () => {
    mock.onGet('/notifications/preferences').reply(200, { success: true, data: prefs });
    const pending: Array<() => void> = [];
    let server = { ...prefs };
    mock.onPut('/notifications/preferences').reply(
      (config) =>
        new Promise((resolve) => {
          pending.push(() => {
            server = { ...server, ...JSON.parse(config.data) };
            resolve([200, { success: true, data: server }]);
          });
        }),
    );
    renderWith(<NotificationPreferencesScreen />);
    await flush();

    // Three taps before the first PUT answers: two rows, then the first one back on.
    fireEvent(screen.getByTestId('notification-pref-promotions'), 'valueChange', false);
    await flush();
    expect(screen.getByTestId('notification-pref-chat').props.disabled).toBe(false);
    fireEvent(screen.getByTestId('notification-pref-chat'), 'valueChange', false);
    await flush();
    fireEvent(screen.getByTestId('notification-pref-promotions'), 'valueChange', true);
    await flush();

    // Every tap shows at once.
    expect(screen.getByTestId('notification-pref-promotions').props.value).toBe(true);
    expect(screen.getByTestId('notification-pref-chat').props.value).toBe(false);

    // Saved one at a time, in order; an earlier answer never flips a later tap back.
    for (let i = 0; i < 3; i += 1) {
      await waitFor(() => expect(pending.length).toBeGreaterThan(0));
      const next = pending.shift();
      await act(async () => {
        next?.();
      });
      await flush();
      expect(screen.getByTestId('notification-pref-promotions').props.value).toBe(true);
      expect(screen.getByTestId('notification-pref-chat').props.value).toBe(false);
    }
    expect(mock.history.put.map((r) => JSON.parse(r.data))).toEqual([
      { promotions: false },
      { chat: false },
      { promotions: true },
    ]);
  });

  it('a refused save in a queue puts back only that switch', async () => {
    mock.onGet('/notifications/preferences').reply(200, { success: true, data: prefs });
    mock
      .onPut('/notifications/preferences')
      .replyOnce(500, { success: false, message: 'Server error' })
      .onPut('/notifications/preferences')
      .replyOnce(200, { success: true, data: { ...prefs, chat: false } });
    const error = jest.spyOn(toast, 'error');
    renderWith(<NotificationPreferencesScreen />);
    await flush();

    fireEvent(screen.getByTestId('notification-pref-promotions'), 'valueChange', false);
    fireEvent(screen.getByTestId('notification-pref-chat'), 'valueChange', false);
    await waitFor(() => expect(mock.history.put).toHaveLength(2));
    await flush();

    expect(error).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('notification-pref-promotions').props.value).toBe(true);
    expect(screen.getByTestId('notification-pref-chat').props.value).toBe(false);
  });

  it('the phone notification settings row opens the phone settings', async () => {
    mock.onGet('/notifications/preferences').reply(200, { success: true, data: prefs });
    const { Linking } = jest.requireActual<typeof import('react-native')>('react-native');
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    renderWith(<NotificationPreferencesScreen />);
    await flush();

    fireEvent.press(screen.getByTestId('notification-preferences-phone-settings'));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('a failed load offers Try again', async () => {
    mock.onGet('/notifications/preferences').networkErrorOnce();
    renderWith(<NotificationPreferencesScreen />);
    await flush();
    expect(screen.getByTestId('notification-preferences-error')).toBeTruthy();
  });
});
