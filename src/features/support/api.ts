import { apiService, unwrap } from '../../services/api';
import { isRecord, readId, readNumber, readText } from '../../core/api/read';
import type {
  NewTicketInput,
  SupportCategory,
  SupportContacts,
  SupportTicket,
  TicketPage,
  TicketReply,
  TicketRide,
} from './types';

/**
 * Help & support through the shared axios client (UI-R18; BE-17 + BE-130, CONTRACT_NOTES):
 * - GET  /support/categories           -> data: [{ slug, name, … }] for the caller's role
 * - GET  /support/tickets?page=n        -> data: T[], meta { current_page, last_page, per_page, total }
 * - GET  /support/tickets/{id}          -> data: T with replies[] (opening it marks it read)
 * - POST /support/tickets               -> 201 data: T (422 per field, 429 + retry_after)
 * - POST /support/tickets/{id}/reply    -> 201 data: reply (409 TICKET_CLOSED, 429 + retry_after)
 * - GET  /settings/public               -> data: [{ key, value, type }] (no sign-in needed)
 * Agent identities (`assigned_to`, `replies[].user`) are never read.
 */

/** Server caps (BE-130 d). */
export const SUBJECT_MAX = 120;
export const DESCRIPTION_MIN = 10;
export const MESSAGE_MAX = 2000;
/** GET /support/tickets page size. */
export const TICKETS_PER_PAGE = 20;
/** BE-130 b: a reply to a closed ticket. */
export const TICKET_CLOSED = 'TICKET_CLOSED';

const toRide = (raw: unknown): TicketRide | null => {
  if (!isRecord(raw)) return null;
  const id = readId(raw.id);
  if (id === null) return null;
  return {
    id,
    pickupAddress: readText(raw.pickup_address) ?? '',
    dropoffAddress: readText(raw.dropoff_address) ?? '',
    completedAt: readText(raw.completed_at),
  };
};

export const toTicketReply = (raw: unknown): TicketReply | null => {
  if (!isRecord(raw)) return null;
  const id = readId(raw.id);
  const message = typeof raw.message === 'string' ? raw.message : null;
  if (id === null || message === null || raw.is_internal === true) return null;
  return { id, message, fromSupport: raw.author_role === 'support', createdAt: readText(raw.created_at) ?? '' };
};

/** One TicketResource; null without an id. */
export const toTicket = (raw: unknown): SupportTicket | null => {
  if (!isRecord(raw)) return null;
  const id = readId(raw.id);
  if (id === null) return null;
  const replies = (Array.isArray(raw.replies) ? raw.replies : [])
    .map(toTicketReply)
    .filter((reply): reply is TicketReply => reply !== null);
  return {
    id,
    ticketNumber: readText(raw.ticket_number) ?? String(id),
    subject: readText(raw.subject) ?? '',
    description: typeof raw.description === 'string' ? raw.description : '',
    category: readText(raw.category) ?? 'general',
    status: readText(raw.status) ?? 'open',
    ride: toRide(raw.ride),
    lastReplyPreview: readText(raw.last_reply_preview),
    lastReplyAt: readText(raw.last_reply_at),
    unread: raw.unread === true,
    createdAt: readText(raw.created_at) ?? '',
    updatedAt: readText(raw.updated_at),
    replies,
  };
};

export const toTicketPage = (body: unknown, page: number): TicketPage => {
  const envelope = isRecord(body) ? body : {};
  const items = (Array.isArray(envelope.data) ? envelope.data : [])
    .map(toTicket)
    .filter((ticket): ticket is SupportTicket => ticket !== null);
  const meta = isRecord(envelope.meta) ? envelope.meta : {};
  return {
    items,
    page: readNumber(meta.current_page, page),
    lastPage: readNumber(meta.last_page, page),
    total: readNumber(meta.total, items.length),
  };
};

export const toCategories = (raw: unknown): SupportCategory[] =>
  (Array.isArray(raw) ? raw : []).flatMap((item) => {
    if (!isRecord(item)) return [];
    const slug = readText(item.slug);
    if (!slug) return [];
    return [{ slug, name: readText(item.name) ?? slug }];
  });

const PUBLIC_KEYS: Record<string, keyof SupportContacts> = {
  support_phone: 'supportPhone',
  support_email: 'supportEmail',
  support_whatsapp: 'supportWhatsapp',
  support_hours: 'supportHours',
  terms_url: 'termsUrl',
  privacy_url: 'privacyUrl',
};

const isHttpsUrl = (value: string): boolean => /^https:\/\/[^\s]+$/i.test(value);

/**
 * The rows of GET /settings/public this feature uses. Links count only as `https:` (anything
 * else hides its row, shared-settings §6); blank values are null.
 */
export const toSupportContacts = (raw: unknown): SupportContacts => {
  const contacts: SupportContacts = {
    supportPhone: null,
    supportEmail: null,
    supportWhatsapp: null,
    supportHours: null,
    termsUrl: null,
    privacyUrl: null,
  };
  (Array.isArray(raw) ? raw : []).forEach((row) => {
    if (!isRecord(row)) return;
    const key = typeof row.key === 'string' ? PUBLIC_KEYS[row.key] : undefined;
    const value = readText(row.value)?.trim() ?? null;
    if (!key || !value) return;
    if ((key === 'termsUrl' || key === 'privacyUrl') && !isHttpsUrl(value)) return;
    contacts[key] = value;
  });
  return contacts;
};

/** POST body: `ride_id` only when a trip is attached; text trimmed. */
export const toCreateBody = (input: NewTicketInput): Record<string, unknown> => ({
  category: input.category,
  subject: input.subject.trim(),
  description: input.description.trim(),
  ...(input.rideId !== null ? { ride_id: input.rideId } : {}),
});

export const supportApi = {
  async categories(): Promise<SupportCategory[]> {
    return toCategories(unwrap(await apiService.get<unknown>('/support/categories')));
  },

  async tickets(page: number): Promise<TicketPage> {
    return toTicketPage(await apiService.get<unknown>('/support/tickets', { params: { page } }), page);
  },

  async ticket(id: number): Promise<SupportTicket> {
    const ticket = toTicket(unwrap(await apiService.get<unknown>(`/support/tickets/${id}`)));
    if (!ticket) throw new Error('Invalid ticket response');
    return ticket;
  },

  async create(input: NewTicketInput): Promise<SupportTicket> {
    const ticket = toTicket(unwrap(await apiService.post<unknown>('/support/tickets', toCreateBody(input))));
    if (!ticket) throw new Error('Invalid ticket response');
    return ticket;
  },

  async reply(id: number, message: string): Promise<TicketReply> {
    const reply = toTicketReply(unwrap(await apiService.post<unknown>(`/support/tickets/${id}/reply`, { message: message.trim() })));
    if (!reply) throw new Error('Invalid reply response');
    return reply;
  },

  async publicSettings(): Promise<SupportContacts> {
    return toSupportContacts(unwrap(await apiService.get<unknown>('/settings/public')));
  },
};
