import type { BadgeTone, IconName } from '../../components/ui';
import { toApiError } from '../../core/api/errors';
import { t, type TranslationKey } from '../../i18n';
import { formatRelativeDate, formatTime } from '../../utils/format';
import type { SupportCategory, SupportTicket, TicketStatus } from './types';

/** Topic glyph by slug (§H1.2); the server's `icon` / `color` are never used. */
const TOPIC_GLYPH: Readonly<Record<string, IconName>> = {
  ride_issue: 'car',
  billing: 'cash',
  account: 'account',
  driver_issue: 'steering',
  technical: 'smartphone',
  complaint: 'report',
  suggestion: 'chat',
  general: 'help',
};

export const topicGlyph = (slug: string): IconName => TOPIC_GLYPH[slug] ?? 'help';

const TOPIC_LABEL_KEY: Readonly<Record<string, TranslationKey>> = {
  ride_issue: 'support.topics.ride_issue',
  billing: 'support.topics.billing',
  account: 'support.topics.account',
  driver_issue: 'support.topics.driver_issue',
  technical: 'support.topics.technical',
  complaint: 'support.topics.complaint',
  suggestion: 'support.topics.suggestion',
  general: 'support.topics.general',
};

/** The topic's label in the active language; the server's name for a slug the app has no copy for. */
export const topicLabel = (category: Pick<SupportCategory, 'slug' | 'name'>): string => {
  const key = TOPIC_LABEL_KEY[category.slug];
  return key ? t(key) : category.name;
};

/** A ticket's topic label from its category slug alone (no server name at hand). */
export const ticketTopicLabel = (slug: string, categories: ReadonlyArray<SupportCategory> | null): string => {
  const known = categories?.find((c) => c.slug === slug);
  return topicLabel(known ?? { slug, name: sentenceCase(slug) });
};

const STATUS_PILL: Readonly<Record<TicketStatus, { key: TranslationKey; tone: BadgeTone }>> = {
  open: { key: 'support.status.open', tone: 'info' },
  in_progress: { key: 'support.status.in_progress', tone: 'info' },
  pending_customer: { key: 'support.status.pending_customer', tone: 'warning' },
  resolved: { key: 'support.status.resolved', tone: 'success' },
  closed: { key: 'support.status.closed', tone: 'neutral' },
};
const isTicketStatus = (status: string): status is TicketStatus => Object.prototype.hasOwnProperty.call(STATUS_PILL, status);

/** "in_review" -> "In review". */
export const sentenceCase = (value: string): string => {
  const words = value.replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : '';
};

/** The status pill (§H2): word and tone; an unknown status shows as sent, neutral. */
export const ticketStatusPill = (status: string): { label: string; tone: BadgeTone } =>
  isTicketStatus(status)
    ? { label: t(STATUS_PILL[status].key), tone: STATUS_PILL[status].tone }
    : { label: sentenceCase(status), tone: 'neutral' };

/** "8:22 AM" today, else "Yesterday" / "Mon, 28 Sep". */
export const shortDate = (value: string | null, now: Date = new Date()): string => {
  const date = formatRelativeDate(value, now);
  return date === t('format.today') ? formatTime(value) : date;
};

/** "Today · 8:22 AM", "Mon, 28 Sep · 9:10 AM". */
export const dateTime = (value: string | null): string =>
  [formatRelativeDate(value), formatTime(value)].filter(Boolean).join(' · ');

/** The row's meta line: "{last reply or created} · #{number}" (date first: the number truncates). */
export const ticketMeta = (ticket: SupportTicket, now: Date = new Date()): string =>
  t('support.ticketMeta', { number: ticket.ticketNumber, date: shortDate(ticket.lastReplyAt ?? ticket.createdAt, now) });

/** The row's second line: the newest reply, else what the user wrote. One line, no newlines. */
export const ticketPreview = (ticket: SupportTicket): string =>
  (ticket.lastReplyPreview ?? ticket.description).replace(/\s+/g, ' ').trim();

/** Whole minutes to wait (at least 1) from a 429 `retry_after` in seconds; null without one. */
export const retryMinutes = (cause: unknown): number | null => {
  const error = toApiError(cause);
  if (error.kind !== 'rate_limited') return null;
  return Math.max(1, Math.ceil((error.retryAfter ?? 60) / 60));
};

/** Phone digits for `tel:` / wa.me (a leading + kept for tel only). */
export const phoneDigits = (value: string): string => value.replace(/[^\d]/g, '');
