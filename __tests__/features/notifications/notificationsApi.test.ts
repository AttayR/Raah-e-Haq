/**
 * T-502: BE-11 notification shapes are mapped to app models in one place, and the API calls
 * use the contract's paths, params and bodies.
 */
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import {
  notificationsApi,
  toAppNotification,
  toNotificationList,
  toPreferences,
  toPreferencesBody,
  toPushPayload,
} from '../../../src/features/notifications/api';

/** A BE-11 notification item (fake local data only). */
const rawNotification = (overrides: Record<string, unknown> = {}) => ({
  id: 12,
  type: 'driver_assigned',
  category: 'ride',
  title: 'Driver Assigned',
  body: 'Your ride has been accepted by Ali',
  data: { ride_id: 7 },
  image_url: null,
  action_url: null,
  action_text: null,
  is_broadcast: false,
  read_at: null,
  created_at: '2026-10-11T12:00:00+00:00',
  ...overrides,
});

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
});

describe('toAppNotification', () => {
  it('maps every BE-11 field', () => {
    expect(toAppNotification(rawNotification())).toEqual({
      id: 12,
      type: 'driver_assigned',
      category: 'ride',
      title: 'Driver Assigned',
      body: 'Your ride has been accepted by Ali',
      data: { rideId: 7, stopId: null, messageId: null, fare: null, cancelledBy: null },
      imageUrl: null,
      actionUrl: null,
      actionText: null,
      isBroadcast: false,
      readAt: null,
      createdAt: '2026-10-11T12:00:00+00:00',
    });
  });

  it('reads unknown categories as system and keeps unknown types', () => {
    const item = toAppNotification(rawNotification({ category: 'surprise', type: 'new_thing' }));
    expect(item?.category).toBe('system');
    expect(item?.type).toBe('new_thing');
  });

  it('keeps only whitelisted ids/enums from data (no names)', () => {
    const item = toAppNotification(
      rawNotification({
        category: 'chat',
        type: 'chat_message',
        data: { ride_id: '9', message_id: 3, sender_first_name: 'Ali', fare: 450, cancelled_by: 'driver' },
      }),
    );
    expect(item?.data).toEqual({ rideId: 9, stopId: null, messageId: 3, fare: '450', cancelledBy: 'driver' });
    expect(JSON.stringify(item?.data)).not.toContain('Ali');
  });

  it('drops items without a usable id and survives a non-object data', () => {
    expect(toAppNotification({ id: 'x' })).toBeNull();
    expect(toAppNotification(null)).toBeNull();
    expect(toNotificationList([rawNotification(), { id: -1 }, 'junk'])).toHaveLength(1);
    expect(toAppNotification(rawNotification({ data: [] }))?.data.rideId).toBeNull();
  });
});

describe('preferences', () => {
  it('maps the five flags and treats missing ones as on (server default)', () => {
    expect(toPreferences({ push_enabled: false, promotions: false })).toEqual({
      pushEnabled: false,
      rideUpdates: true,
      promotions: false,
      chat: true,
      soundAlerts: true,
    });
  });

  it('builds a snake_case body with only the changed keys', () => {
    expect(toPreferencesBody({ soundAlerts: false })).toEqual({ sound_alerts: false });
    expect(toPreferencesBody({ pushEnabled: true, rideUpdates: false })).toEqual({
      push_enabled: true,
      ride_updates: false,
    });
  });
});

describe('toPushPayload', () => {
  it('parses the string FCM data', () => {
    expect(
      toPushPayload({ notification_id: '15', ride_id: '7', category: 'ride', type: 'driver_arrived' }),
    ).toEqual({ notificationId: 15, rideId: 7, category: 'ride', type: 'driver_arrived' });
    expect(toPushPayload(undefined)).toEqual({ notificationId: null, rideId: null, category: 'system', type: null });
  });
});

describe('notificationsApi', () => {
  it('GET /notifications with page, per_page and unread=1 for the Unread filter', async () => {
    mock.onGet('/notifications').reply(200, {
      success: true,
      data: [rawNotification()],
      pagination: { current_page: 2, last_page: 3, per_page: 20, total: 41 },
    });

    const page = await notificationsApi.list({ page: 2, filter: 'unread' });

    expect(mock.history.get[0].params).toEqual({ page: 2, per_page: 20, unread: 1 });
    expect(page).toMatchObject({ page: 2, lastPage: 3, total: 41 });
    expect(page.items[0].id).toBe(12);
  });

  it('the All filter sends no unread param', async () => {
    mock.onGet('/notifications').reply(200, { success: true, data: [] });
    const page = await notificationsApi.list({ page: 1, filter: 'all' });
    expect(mock.history.get[0].params).toEqual({ page: 1, per_page: 20 });
    expect(page).toEqual({ items: [], page: 1, lastPage: 1, total: 0 });
  });

  it('unread count, mark read, read-all', async () => {
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { unread_count: 5 } });
    mock.onPost('/notifications/12/read').reply(200, {
      success: true,
      data: rawNotification({ read_at: '2026-10-11T12:01:00+00:00' }),
    });
    mock.onPost('/notifications/read-all').reply(200, { success: true, data: { unread_count: 0 } });

    await expect(notificationsApi.unreadCount()).resolves.toBe(5);
    await expect(notificationsApi.markRead(12)).resolves.toMatchObject({ readAt: '2026-10-11T12:01:00+00:00' });
    await expect(notificationsApi.markAllRead()).resolves.toBe(0);
  });

  it('a 404 on mark read rejects with kind not_found', async () => {
    mock.onPost('/notifications/99/read').reply(404, { success: false, message: 'Not found', code: 'NOT_FOUND' });
    await expect(notificationsApi.markRead(99)).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('preferences GET and PUT', async () => {
    mock.onGet('/notifications/preferences').reply(200, {
      success: true,
      data: { push_enabled: true, ride_updates: true, promotions: true, chat: true, sound_alerts: true },
    });
    mock.onPut('/notifications/preferences').reply(200, {
      success: true,
      data: { push_enabled: true, ride_updates: true, promotions: false, chat: true, sound_alerts: true },
    });

    await expect(notificationsApi.getPreferences()).resolves.toMatchObject({ promotions: true });
    await expect(notificationsApi.updatePreferences({ promotions: false })).resolves.toMatchObject({
      promotions: false,
    });
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ promotions: false });
  });

  it('POST /devices {token, platform} and DELETE /devices/{token}', async () => {
    mock.onPost('/devices').reply(200, { success: true, data: { platform: 'android', last_seen_at: 'now' } });
    mock.onDelete('/devices/abc%3A123').reply(200, { success: true, data: null });

    await notificationsApi.registerDevice('abc:123', 'android');
    await notificationsApi.unregisterDevice('abc:123', 5000);

    expect(JSON.parse(mock.history.post[0].data)).toEqual({ token: 'abc:123', platform: 'android' });
    expect(mock.history.delete[0].url).toBe('/devices/abc%3A123');
    expect(mock.history.delete[0].timeout).toBe(5000);
  });
});
