/**
 * T-502: the notifications slice (list paging, filter, optimistic mark read, read-all) and the
 * unread-count dedupe (QA T-104: /unread-count was requested three times per Map visit).
 */
import MockAdapter from 'axios-mock-adapter';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { resetApp } from '../../../src/store/actions';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  notificationsStale,
  setNotificationFilter,
} from '../../../src/features/notifications/slice';

const item = (id: number, read = false) => ({
  id,
  type: 'driver_assigned',
  category: 'ride',
  title: `Title ${id}`,
  body: `Body ${id}`,
  data: { ride_id: id },
  image_url: null,
  action_url: null,
  action_text: null,
  is_broadcast: false,
  read_at: read ? '2026-10-11T12:00:00+00:00' : null,
  created_at: '2026-10-11T12:00:00+00:00',
});

const pageBody = (ids: number[], current: number, last: number) => ({
  success: true,
  data: ids.map((id) => item(id)),
  pagination: { current_page: current, last_page: last, per_page: 20, total: last * 20 },
});

const makeStore = () => configureStore({ reducer: rootReducer });

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
});

describe('list', () => {
  it('loads page 1, then appends the next page without duplicates, and stops at the last page', async () => {
    const store = makeStore();
    mock.onGet('/notifications').replyOnce(200, pageBody([5, 4], 1, 2)).onGet('/notifications').replyOnce(200, pageBody([4, 3], 2, 2));

    await store.dispatch(fetchNotifications({ mode: 'initial' }));
    expect(store.getState().notifications.items.map((n) => n.id)).toEqual([5, 4]);
    expect(store.getState().notifications.status).toBe('ready');

    await store.dispatch(fetchNotifications({ mode: 'more' }));
    expect(store.getState().notifications.items.map((n) => n.id)).toEqual([5, 4, 3]);
    expect(mock.history.get[1].params.page).toBe(2);

    // Last page: no request.
    await store.dispatch(fetchNotifications({ mode: 'more' }));
    expect(mock.history.get).toHaveLength(2);
  });

  it('a failed first load is an error state; a failed next page keeps the rows', async () => {
    const store = makeStore();
    mock.onGet('/notifications').networkErrorOnce();
    await store.dispatch(fetchNotifications({ mode: 'initial' }));
    expect(store.getState().notifications.status).toBe('failed');
    expect(store.getState().notifications.error).toBeTruthy();

    mock.onGet('/notifications').replyOnce(200, pageBody([2], 1, 3)).onGet('/notifications').networkErrorOnce();
    await store.dispatch(fetchNotifications({ mode: 'initial' }));
    await store.dispatch(fetchNotifications({ mode: 'more' }));
    const state = store.getState().notifications;
    expect(state.items.map((n) => n.id)).toEqual([2]);
    expect(state.status).toBe('ready');
    expect(state.loadMoreError).toBeTruthy();
  });

  it('an answer for the old filter is dropped after switching to Unread', async () => {
    const store = makeStore();
    let releaseAll!: (value: [number, unknown]) => void;
    mock
      .onGet('/notifications', { params: { page: 1, per_page: 20 } })
      .replyOnce(() => new Promise<[number, unknown]>((resolve) => { releaseAll = resolve; }));
    mock.onGet('/notifications', { params: { page: 1, per_page: 20, unread: 1 } }).replyOnce(200, pageBody([9], 1, 1));

    const all = store.dispatch(fetchNotifications({ mode: 'initial' }));
    await new Promise<void>((r) => setTimeout(() => r(), 0));
    store.dispatch(setNotificationFilter('unread'));
    await store.dispatch(fetchNotifications({ mode: 'initial' }));
    releaseAll([200, pageBody([1, 2], 1, 1)]);
    await all;

    expect(store.getState().notifications.filter).toBe('unread');
    expect(store.getState().notifications.items.map((n) => n.id)).toEqual([9]);
  });

  it('a refresh clears the stale flag set by a push', async () => {
    const store = makeStore();
    mock.onGet('/notifications').reply(200, pageBody([1], 1, 1));
    await store.dispatch(fetchNotifications({ mode: 'initial' }));
    store.dispatch(notificationsStale());
    expect(store.getState().notifications.stale).toBe(true);
    await store.dispatch(fetchNotifications({ mode: 'refresh' }));
    expect(store.getState().notifications.stale).toBe(false);
  });

  it('T-513: a refresh is skipped while a page-1 load runs (one request)', async () => {
    const store = makeStore();
    mock.onGet('/notifications').reply(200, pageBody([1], 1, 1));
    await store.dispatch(fetchNotifications({ mode: 'initial' }));
    mock.resetHistory();
    await Promise.all([
      store.dispatch(fetchNotifications({ mode: 'refresh' })),
      store.dispatch(fetchNotifications({ mode: 'refresh' })),
    ]);
    expect(mock.history.get).toHaveLength(1);
  });

  it('T-513: a failed refresh clears the stale flag, so the screen does not retry in a loop', async () => {
    const store = makeStore();
    mock.onGet('/notifications').replyOnce(200, pageBody([1], 1, 1));
    await store.dispatch(fetchNotifications({ mode: 'initial' }));
    store.dispatch(notificationsStale());
    mock.onGet('/notifications').networkErrorOnce();
    await store.dispatch(fetchNotifications({ mode: 'refresh' }));
    expect(store.getState().notifications).toMatchObject({ stale: false, status: 'ready' });
    expect(store.getState().notifications.error).not.toBeNull();
  });
});

describe('unread count', () => {
  it('several callers at once send one request (dedupe)', async () => {
    const store = makeStore();
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { unread_count: 3 } });

    await Promise.all([
      store.dispatch(fetchUnreadCount()),
      store.dispatch(fetchUnreadCount()),
      store.dispatch(fetchUnreadCount()),
    ]);

    expect(mock.history.get.filter((r) => r.url === '/notifications/unread-count')).toHaveLength(1);
    expect(store.getState().notifications.unreadCount).toBe(3);

    // Once settled, the next call asks again.
    await store.dispatch(fetchUnreadCount());
    expect(mock.history.get).toHaveLength(2);
  });

  it('T-513: a higher count marks a loaded list stale; a lower one or an unloaded list does not', async () => {
    const store = makeStore();
    mock.onGet('/notifications/unread-count').replyOnce(200, { success: true, data: { unread_count: 2 } });
    await store.dispatch(fetchUnreadCount());
    expect(store.getState().notifications.stale).toBe(false); // nothing loaded yet

    mock.onGet('/notifications').reply(200, pageBody([1], 1, 1));
    await store.dispatch(fetchNotifications({ mode: 'initial' }));
    mock.onGet('/notifications/unread-count').replyOnce(200, { success: true, data: { unread_count: 1 } });
    await store.dispatch(fetchUnreadCount());
    expect(store.getState().notifications.stale).toBe(false);

    mock.onGet('/notifications/unread-count').replyOnce(200, { success: true, data: { unread_count: 4 } });
    await store.dispatch(fetchUnreadCount());
    expect(store.getState().notifications).toMatchObject({ stale: true, unreadCount: 4 });
  });

  it('a failure keeps the last known count', async () => {
    const store = makeStore();
    mock.onGet('/notifications/unread-count').replyOnce(200, { success: true, data: { unread_count: 2 } });
    await store.dispatch(fetchUnreadCount());
    mock.onGet('/notifications/unread-count').networkErrorOnce();
    await store.dispatch(fetchUnreadCount());
    expect(store.getState().notifications.unreadCount).toBe(2);
    expect(store.getState().notifications.unreadInFlight).toBe(false);
  });

  it('logout (resetApp) clears everything', async () => {
    const store = makeStore();
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { unread_count: 2 } });
    await store.dispatch(fetchUnreadCount());
    store.dispatch(resetApp());
    expect(store.getState().notifications.unreadCount).toBe(0);
  });
});

describe('mark read', () => {
  const loaded = async () => {
    const store = makeStore();
    mock.onGet('/notifications').reply(200, pageBody([1, 2], 1, 1));
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { unread_count: 2 } });
    await store.dispatch(fetchNotifications({ mode: 'initial' }));
    await store.dispatch(fetchUnreadCount());
    return store;
  };

  it('is optimistic and keeps the server row', async () => {
    const store = await loaded();
    let release!: (value: [number, unknown]) => void;
    mock.onPost('/notifications/1/read').replyOnce(
      () => new Promise<[number, unknown]>((resolve) => { release = resolve; }),
    );

    const pending = store.dispatch(markNotificationRead(1));
    expect(store.getState().notifications.items[0].readAt).not.toBeNull();
    expect(store.getState().notifications.unreadCount).toBe(1);
    await new Promise<void>((r) => setTimeout(() => r(), 0));
    release([200, { success: true, data: item(1, true) }]);
    await pending;
    expect(store.getState().notifications.items[0].readAt).toBe('2026-10-11T12:00:00+00:00');

    // Already read: no second request.
    await store.dispatch(markNotificationRead(1));
    expect(mock.history.post).toHaveLength(1);
  });

  it('a server error puts the row and count back', async () => {
    const store = await loaded();
    mock.onPost('/notifications/2/read').replyOnce(500, { success: false, message: 'Server error' });
    await store.dispatch(markNotificationRead(2));
    expect(store.getState().notifications.items[1].readAt).toBeNull();
    expect(store.getState().notifications.unreadCount).toBe(2);
  });

  it('a 404 (not yours any more) removes the row', async () => {
    const store = await loaded();
    mock.onPost('/notifications/2/read').replyOnce(404, { success: false, message: 'Not found', code: 'NOT_FOUND' });
    await store.dispatch(markNotificationRead(2));
    expect(store.getState().notifications.items.map((n) => n.id)).toEqual([1]);
  });

  it('read-all marks every row and takes the server count', async () => {
    const store = await loaded();
    mock.onPost('/notifications/read-all').replyOnce(200, { success: true, data: { unread_count: 0 } });
    await store.dispatch(markAllNotificationsRead());
    const state = store.getState().notifications;
    expect(state.items.every((n) => n.readAt !== null)).toBe(true);
    expect(state.unreadCount).toBe(0);
    expect(state.markingAll).toBe(false);
  });
});
