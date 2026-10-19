import type { ChatRole } from './types';
import { localizedCopy } from '../../i18n/localizedCopy';
import { strings, t } from '../../i18n';

/** Static copy for in-ride chat (T-510). Every name, message and count comes from the server. */
export const CHAT_COPY = localizedCopy({
  listTitle: 'Messages',
  listEmptyTitle: 'No messages',
  listEmpty: 'Chats appear here during a ride.',
  listEmptyPassenger: 'You can message your driver during a ride.',
  listEmptyDriver: 'You can message your passenger during a ride.',
  listError: "We couldn't load your chats.",
  listErrorTitle: "Couldn't load messages",
  listLoadingA11y: 'Loading messages',
  sectionCurrent: 'Current ride',
  sectionEarlier: 'Earlier',
  ended: 'Ended',
  endedA11y: 'Chat ended',
  youPrefix: (text: string) => `You: ${text}`,
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
  loading: 'Loading messages…',
  threadError: "We couldn't load this chat.",
  threadForbidden: 'This chat is not available to you.',
  threadExpired: 'This chat has expired.',
  threadExpiredBody: 'Chats are kept for 24 hours after a ride ends.',
  threadClosed: 'Chat closed',
  threadClosedBody: 'Messages and calls close 30 minutes after a ride ends.',
  threadEmpty: 'No messages yet. Say hello.',
  threadEmptyPassenger: 'Messages are shared only with your driver for this ride.',
  threadEmptyDriver: 'Messages are shared only with your passenger for this ride.',
  loadOlder: 'Loading earlier messages…',
  composerPlaceholder: 'Type a message',
  composerPlaceholderTo: (name: string) => `Message ${name}`,
  quickRepliesA11y: 'Quick replies',
  quickRepliesPassenger: ["I'm on my way", "I'm at the pickup", 'Please wait 2 minutes'],
  quickRepliesDriver: ["I've arrived", "I'm on my way", 'Running a few minutes late'],
  sent: 'Sent',
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
    closed: 'Not sent. Chat closed for this ride.',
    invalid: 'Not sent. This message is empty or too long.',
    unknown: 'Not sent.',
  },
  closedNotice: 'Chat closed. You can still read the messages.',
  closedUntil: (time: string) => `Chat closed. You can read the messages until ${time}.`,
  /** BE-78: the ride ended, sending stays open for 30 min. */
  closesAt: (time: string) => `The ride has ended. Chat closes at ${time}.`,
  notOpenNotice: 'Chat opens once a driver accepts the ride.',
  cannotSendNotice: "You can't send messages in this chat.",
  // Entry points.
  message: 'Message',
  messageA11y: (name: string) => `Message ${name}`,
});

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
  const f = strings().format;
  const suffix = hours >= 12 ? f.pm : f.am;
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${suffix}`;
};

/** The local calendar day as a day number (DST-safe: the local date, counted in UTC days). */
const dayIndexOf = (date: Date): number =>
  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;

/**
 * A time with its day when it isn't today (T-512): "9:05 AM" today, "tomorrow at 9:05 AM",
 * "yesterday at 9:05 AM", otherwise "12 Oct at 9:05 AM" (plus the year when it differs).
 * '' when the time does not parse. Local time, like `formatChatTime`.
 */
export const formatChatDayTime = (iso: string | null | undefined, now: Date = new Date()): string => {
  const time = formatChatTime(iso);
  if (!time || !iso) return time;
  const date = new Date(iso);
  const dayDiff = dayIndexOf(date) - dayIndexOf(now);
  if (dayDiff === 0) return time;
  // T-575: day words and month names in the active language (Latin digits in every language).
  if (dayDiff === 1) return t('format.tomorrowAt', { time });
  if (dayDiff === -1) return t('format.yesterdayAt', { time });
  const year = date.getFullYear() === now.getFullYear() ? '' : ` ${date.getFullYear()}`;
  const day = `${date.getDate()} ${strings().format.monthsShort[date.getMonth()]}${year}`;
  return t('format.dateAt', { date: day, time });
};

/**
 * UI-R14: the time on a Messages row: "9:05 AM" today, "Yesterday", else "28 Sep" (plus the
 * year when it differs). '' when the time does not parse.
 */
export const formatChatListTime = (iso: string | null | undefined, now: Date = new Date()): string => {
  const time = formatChatTime(iso);
  if (!time || !iso) return time;
  const date = new Date(iso);
  const dayDiff = dayIndexOf(now) - dayIndexOf(date);
  if (dayDiff <= 0) return time;
  const f = strings().format;
  if (dayDiff === 1) return f.yesterday;
  const year = date.getFullYear() === now.getFullYear() ? '' : ` ${date.getFullYear()}`;
  return `${date.getDate()} ${f.monthsShort[date.getMonth()]}${year}`;
};
