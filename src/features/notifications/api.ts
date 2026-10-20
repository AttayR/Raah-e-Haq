import { apiService, unwrap } from '../../services/api';
import {
  NOTIFICATION_CATEGORIES,
  type AppNotification,
  type DevicePlatform,
  type NotificationCategory,
  type NotificationFilter,
  type NotificationPage,
  type NotificationPayload,
  type NotificationPreferences,
  type PushPayload,
} from './types';

/**
 * Notifications, preferences and push devices (BE-11, docs/api/CONTRACT_NOTES.md "BE-11"):
 * - GET  /notifications?page&per_page&unread=1  -> data: [N], pagination
 * - GET  /notifications/unread-count            -> data: {unread_count}
 * - POST /notifications/{id}/read               -> data: N (404 NOT_FOUND if not the caller's)
 * - POST /notifications/read-all                -> data: {unread_count: 0}
 * - GET|PUT /notifications/preferences          -> data: the five flags
 * - POST /devices {token, platform}             -> upsert of this device's FCM token
 * - DELETE /devices/{token}                     -> always 200
 * All through the shared axios client; errors are ApiErrors (toThunkRejection reads them).
 */

export const NOTIFICATIONS_PAGE_SIZE = 20;

type RawRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toId = (value: unknown): number | null => {
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
};

const toText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

const toCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

/** BE-130: `{ ticketId }` for a support row or push that names its request, else nothing. */
const ticketIdOf = (value: unknown): { ticketId?: number } => {
  const id = toId(value);
  return id === null ? {} : { ticketId: id };
};

/** Unknown or missing categories are `system` (the contract says so). */
export const toCategory = (value: unknown): NotificationCategory =>
  NOTIFICATION_CATEGORIES.find((known) => known === value) ?? 'system';

const CANCELLED_BY = ['passenger', 'driver', 'admin'] as const;

const toPayload = (raw: unknown): NotificationPayload => {
  const data = isRecord(raw) ? raw : {};
  return {
    rideId: toId(data.ride_id),
    stopId: toId(data.stop_id),
    messageId: toId(data.message_id),
    fare: typeof data.fare === 'number' ? String(data.fare) : toText(data.fare),
    cancelledBy: CANCELLED_BY.find((who) => who === data.cancelled_by) ?? null,
    requeued: data.requeued === true || data.requeued === 'true' || data.requeued === 1,
    // BE-114: only said when it is so (older rows and other cancels carry no `reason`).
    ...(data.reason === 'no_driver' ? { noDriver: true } : {}),
    ...ticketIdOf(data.ticket_id),
  };
};

/** One server notification item as an AppNotification; null when it has no usable id. */
export const toAppNotification = (raw: unknown): AppNotification | null => {
  if (!isRecord(raw)) return null;
  const id = toId(raw.id);
  if (id === null) return null;
  return {
    id,
    type: toText(raw.type) ?? 'system',
    category: toCategory(raw.category),
    title: toText(raw.title) ?? '',
    body: typeof raw.body === 'string' ? raw.body : '',
    data: toPayload(raw.data),
    imageUrl: toText(raw.image_url),
    actionUrl: toText(raw.action_url),
    actionText: toText(raw.action_text),
    isBroadcast: raw.is_broadcast === true,
    readAt: toText(raw.read_at),
    createdAt: toText(raw.created_at) ?? '',
  };
};

export const toNotificationList = (raw: unknown): AppNotification[] =>
  (Array.isArray(raw) ? raw : [])
    .map(toAppNotification)
    .filter((item): item is AppNotification => item !== null);

export const toPreferences = (raw: unknown): NotificationPreferences => {
  const data = isRecord(raw) ? raw : {};
  // Missing flags read as on: the server default is all true until saved.
  const flag = (value: unknown) => value !== false;
  return {
    pushEnabled: flag(data.push_enabled),
    rideUpdates: flag(data.ride_updates),
    promotions: flag(data.promotions),
    chat: flag(data.chat),
    soundAlerts: flag(data.sound_alerts),
  };
};

const PREFERENCE_FIELDS: Record<keyof NotificationPreferences, string> = {
  pushEnabled: 'push_enabled',
  rideUpdates: 'ride_updates',
  promotions: 'promotions',
  chat: 'chat',
  soundAlerts: 'sound_alerts',
};

export const toPreferencesBody = (changes: Partial<NotificationPreferences>): Record<string, boolean> => {
  const body: Record<string, boolean> = {};
  (Object.keys(changes) as Array<keyof NotificationPreferences>).forEach((key) => {
    const value = changes[key];
    if (typeof value === 'boolean') body[PREFERENCE_FIELDS[key]] = value;
  });
  return body;
};

/**
 * The FCM `data` of a push (strings on the wire). BE-93 adds `ride_status` to ride pushes and
 * `requeued` ("true" | "false") to `ride_cancelled`; older pushes without them read null / false.
 */
export const toPushPayload = (raw: unknown): PushPayload => {
  const data = isRecord(raw) ? raw : {};
  return {
    notificationId: toId(data.notification_id),
    rideId: toId(data.ride_id),
    category: toCategory(data.category),
    type: toText(data.type),
    rideStatus: toText(data.ride_status),
    requeued: data.requeued === 'true',
    ...(data.reason === 'no_driver' ? { noDriver: true } : {}),
    ...ticketIdOf(data.ticket_id),
  };
};

export interface ListParams {
  page: number;
  filter: NotificationFilter;
  perPage?: number;
}

export const notificationsApi = {
  async list({ page, filter, perPage = NOTIFICATIONS_PAGE_SIZE }: ListParams): Promise<NotificationPage> {
    const params: Record<string, number> = { page, per_page: perPage };
    if (filter === 'unread') params.unread = 1;
    const body = await apiService.get<unknown>('/notifications', { params });
    const items = toNotificationList(unwrap(body));
    const pagination = body.pagination;
    return {
      items,
      page: pagination?.current_page ?? page,
      lastPage: pagination?.last_page ?? page,
      total: pagination?.total ?? items.length,
    };
  },

  async unreadCount(): Promise<number> {
    const data = unwrap(await apiService.get<unknown>('/notifications/unread-count'));
    return toCount(isRecord(data) ? data.unread_count : undefined);
  },

  async markRead(id: number): Promise<AppNotification | null> {
    return toAppNotification(unwrap(await apiService.post<unknown>(`/notifications/${id}/read`)));
  },

  /** Resolves the server's unread count afterwards (0). */
  async markAllRead(): Promise<number> {
    const data = unwrap(await apiService.post<unknown>('/notifications/read-all'));
    return toCount(isRecord(data) ? data.unread_count : undefined);
  },

  async getPreferences(): Promise<NotificationPreferences> {
    return toPreferences(unwrap(await apiService.get<unknown>('/notifications/preferences')));
  },

  async updatePreferences(changes: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    return toPreferences(
      unwrap(await apiService.put<unknown>('/notifications/preferences', toPreferencesBody(changes))),
    );
  },

  async registerDevice(token: string, platform: DevicePlatform): Promise<void> {
    await apiService.post('/devices', { token, platform });
  },

  async unregisterDevice(token: string, timeoutMs?: number): Promise<void> {
    await apiService.delete(`/devices/${encodeURIComponent(token)}`, timeoutMs ? { timeout: timeoutMs } : undefined);
  },
};
