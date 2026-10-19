import type { AppNotification, NotificationCategory } from '../../notifications/types';
import type { ChatMessage, ChatSafetyWarning, ChatSummary } from '../../chat/types';

/**
 * Debug gallery only (UI-R14): fake local Inbox data in the app's own model shapes, so the
 * Inbox previews show every row state (unread, read, each category, a flagged chat message)
 * for design screenshots. Never imported outside `dev-gallery`, never in a release bundle.
 */
const minutesAgo = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

const notification = (
  id: number,
  category: NotificationCategory,
  type: string,
  title: string,
  body: string,
  ageMinutes: number,
  read: boolean,
): AppNotification => ({
  id,
  type,
  category,
  title,
  body,
  data: { rideId: category === 'ride' ? 100 + id : null, stopId: null, messageId: null, fare: null, cancelledBy: null, requeued: false },
  imageUrl: null,
  actionUrl: null,
  actionText: null,
  isBroadcast: category === 'promo',
  readAt: read ? minutesAgo(ageMinutes - 1) : null,
  createdAt: minutesAgo(ageMinutes),
});

export const GALLERY_NOTIFICATIONS: AppNotification[] = [
  notification(1, 'ride', 'driver_arrived', 'Your driver has arrived', 'Bilal is waiting at the pickup in a white Suzuki Alto (LEC-1234).', 4, false),
  notification(2, 'chat', 'chat_message', 'New message from Bilal', 'I am at the main gate, near the pharmacy.', 6, false),
  notification(3, 'wallet', 'wallet_credit', 'Rs 500 added to your wallet', 'Your JazzCash top-up went through.', 95, true),
  notification(4, 'promo', 'promotion', '20% off rides this weekend', 'Use the offer on any car or rickshaw ride until Sunday night.', 60 * 26, true),
  notification(5, 'system', 'system', 'Your documents were approved', 'You can now go online and accept rides.', 60 * 27, true),
  notification(6, 'ride', 'ride_completed', 'Trip completed', 'You paid Rs 450 in cash. Rate your trip with Bilal.', 60 * 50, true),
];

const message = (
  id: number,
  isMine: boolean,
  body: string,
  ageMinutes: number,
  safetyWarning: ChatSafetyWarning | null = null,
): ChatMessage => ({
  id,
  rideId: 7,
  clientId: null,
  senderId: isMine ? 9 : 12,
  senderRole: isMine ? 'passenger' : 'driver',
  isMine,
  body,
  createdAt: minutesAgo(ageMinutes),
  readAt: isMine ? null : minutesAgo(ageMinutes - 1),
  safetyWarning,
});

/** Oldest first, like GET /rides/{id}/messages. */
export const GALLERY_MESSAGES: ChatMessage[] = [
  message(1, true, 'Assalam o alaikum, I am outside block N.', 60 * 25),
  message(2, false, 'Walaikum assalam, coming in 5 minutes.', 60 * 25 - 1),
  message(3, false, 'I am at the main gate, near the pharmacy.', 9),
  message(4, true, 'Ok, walking there now.', 8),
  message(5, true, 'I am wearing a blue shirt.', 8),
  message(6, false, 'Please send Rs 200 advance on Easypaisa first.', 3, {
    code: 'money_transfer_request',
    message: '',
  }),
];

const summary = (
  rideId: number,
  firstName: string,
  canSend: boolean,
  rideStatus: string,
  last: ChatMessage | null,
  unreadCount: number,
): ChatSummary => ({
  rideId,
  rideStatus,
  canSend,
  readOnlyUntil: canSend ? null : minutesAgo(-60 * 10),
  contactClosesAt: canSend ? null : minutesAgo(30),
  otherParty: { id: rideId, role: 'driver', firstName, profileImageUrl: null },
  lastMessage: last,
  unreadCount,
});

export const GALLERY_CHATS: ChatSummary[] = [
  summary(7, 'Bilal', true, 'accepted', message(3, false, 'I am at the main gate, near the pharmacy.', 3), 2),
  summary(5, 'Asad', false, 'completed', message(9, true, 'Thank you, have a good day.', 60 * 5), 0),
  summary(4, 'Kamran', false, 'completed', message(8, false, 'Reached, please come down.', 60 * 30), 0),
];
