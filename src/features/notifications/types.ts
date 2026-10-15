/**
 * App models for the notifications feature (BE-11, docs/api/CONTRACT_NOTES.md "BE-11").
 * The raw server shapes are mapped in api.ts; screens only ever see these.
 */

export type NotificationCategory = 'ride' | 'promo' | 'wallet' | 'chat' | 'system';

export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  'ride',
  'promo',
  'wallet',
  'chat',
  'system',
];

/** `data` of a notification: a server whitelist of ids/enums only (no names, phones, addresses). */
export interface NotificationPayload {
  rideId: number | null;
  stopId: number | null;
  messageId: number | null;
  /** PKR amount as the server sends it (string). */
  fare: string | null;
  cancelledBy: 'passenger' | 'driver' | 'admin' | null;
  /** BE-85: a driver's cancel put the ride back in the queue (the passenger is still searching). */
  requeued: boolean;
}

export interface AppNotification {
  id: number;
  /** Server type (e.g. `driver_assigned`, `chat_message`, `promotion`); unknown types are kept. */
  type: string;
  category: NotificationCategory;
  title: string;
  /** Plain text; render as text. */
  body: string;
  data: NotificationPayload;
  imageUrl: string | null;
  actionUrl: string | null;
  actionText: string | null;
  isBroadcast: boolean;
  /** ISO time, null while unread. */
  readAt: string | null;
  /** ISO time it was sent. */
  createdAt: string;
}

export interface NotificationPage {
  items: AppNotification[];
  page: number;
  lastPage: number;
  total: number;
}

export type NotificationFilter = 'all' | 'unread';

/** GET/PUT /notifications/preferences (all true until saved). They gate push only. */
export interface NotificationPreferences {
  pushEnabled: boolean;
  rideUpdates: boolean;
  promotions: boolean;
  chat: boolean;
  soundAlerts: boolean;
}

export type NotificationPreferenceKey = keyof NotificationPreferences;

/** The FCM `data` of a push (all strings on the wire), parsed. */
export interface PushPayload {
  notificationId: number | null;
  rideId: number | null;
  category: NotificationCategory;
  type: string | null;
}

export type DevicePlatform = 'ios' | 'android';
