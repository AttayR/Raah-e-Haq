import type { ChatRole } from './types';

/** Static copy for in-ride chat (T-510). Every name, message and count comes from the server. */
export const CHAT_COPY = {
  listTitle: 'Messages',
  listEmptyTitle: 'No chats yet',
  listEmpty: 'Chats appear here during a ride.',
  listError: "We couldn't load your chats.",
  retry: 'Try again',
  noMessagesYet: 'No messages yet',
  readOnly: 'Read-only',
  unreadA11y: (count: number) => `${count} unread`,
  yourDriver: 'Your driver',
  yourPassenger: 'Your passenger',
  roleDriver: 'Driver',
  rolePassenger: 'Passenger',
  // Thread.
  back: 'Back',
  call: 'Call',
  callA11y: (name: string) => `Call ${name}`,
  callFailed: "Couldn't start the call.",
  loading: 'Loading messages…',
  threadError: "We couldn't load this chat.",
  threadForbidden: 'This chat is not available to you.',
  threadExpired: 'This chat has expired.',
  threadExpiredBody: 'Chats are kept for 24 hours after a ride ends.',
  threadEmpty: 'No messages yet. Say hello.',
  loadOlder: 'Loading earlier messages…',
  composerPlaceholder: 'Type a message',
  composerA11y: 'Message',
  send: 'Send',
  sendA11y: 'Send message',
  seen: 'Seen',
  sending: 'Sending…',
  notSent: 'Not sent.',
  tapToRetry: 'Tap to retry',
  retrySendA11y: 'Retry sending this message',
  sendErrors: {
    network: 'Not sent. Check your connection.',
    rate_limited: 'Not sent. Too many messages, wait a moment.',
    not_open: 'Not sent. Chat opens once a driver accepts the ride.',
    closed: 'Not sent. This ride has ended.',
    invalid: 'Not sent. This message is empty or too long.',
    unknown: 'Not sent.',
  },
  closedNotice: 'This ride has ended. The chat is read-only.',
  closedUntil: (time: string) => `This ride has ended. The chat is read-only until ${time}.`,
  notOpenNotice: 'Chat opens once a driver accepts the ride.',
  cannotSendNotice: "You can't send messages in this chat.",
  // Entry points.
  message: 'Message',
  messageA11y: (name: string) => `Message ${name}`,
};

export const fallbackNameOf = (role: ChatRole | null | undefined): string =>
  role === 'passenger' ? CHAT_COPY.yourPassenger : CHAT_COPY.yourDriver;

export const roleLabelOf = (role: ChatRole | null | undefined): string =>
  role === 'passenger' ? CHAT_COPY.rolePassenger : CHAT_COPY.roleDriver;

/** "9:05 AM" from an ISO time, or '' when it does not parse. */
export const formatChatTime = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${suffix}`;
};
