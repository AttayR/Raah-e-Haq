import { apiService, unwrap } from '../../services/api';
import type {
  ChatMessage,
  ChatParty,
  ChatReadResult,
  ChatRole,
  ChatSummary,
  ChatThreadPage,
} from './types';

/**
 * In-ride chat endpoints (T-510, BE-13; docs/api/CONTRACT_NOTES.md "BE-13: in-ride chat").
 *
 * - GET /chats: the caller's chats, newest activity first (at most 50).
 * - GET /rides/{id}/messages?after_id|before_id&limit: the latest page (oldest first) without
 *   a cursor, newer messages with `after_id`, older ones with `before_id`.
 * - POST /rides/{id}/messages {body, client_id}: 201 new, 200 with the first message when
 *   `client_id` repeats (safe retry).
 * - POST /rides/{id}/messages/read {up_to_id}.
 *
 * Refusals (BE-26 envelope, `error.code`): 403 not_ride_participant, 409 chat_not_open (no
 * driver yet), 403 CONTACT_CLOSED (BE-78: sending closes 30 min after the ride ended; it was
 * 409 chat_closed before, still handled), 410 chat_expired, 422 errors.body / errors.client_id,
 * 429 rate_limited (Retry-After). Rows and pages carry `contact_closes_at` (BE-78).
 */
export const CHAT_CODES = {
  notParticipant: 'not_ride_participant',
  notOpen: 'chat_not_open',
  closed: 'chat_closed',
  contactClosed: 'CONTACT_CLOSED',
  expired: 'chat_expired',
  rateLimited: 'rate_limited',
} as const;

/** The server's body limit after cleaning (BE-13). */
export const CHAT_BODY_MAX_LENGTH = 1000;
/** Page size for the first load and for older pages. */
export const CHAT_PAGE_LIMIT = 50;

type Wire = Record<string, unknown>;

const isObject = (value: unknown): value is Wire =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toInt = (value: unknown): number | null => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) ? n : null;
};

const toStringOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const toRole = (value: unknown): ChatRole | null =>
  value === 'passenger' || value === 'driver' ? value : null;

/** A wire message, or null when it lacks the fields the thread needs (id, sender, body). */
export const toChatMessage = (raw: unknown): ChatMessage | null => {
  if (!isObject(raw)) return null;
  const id = toInt(raw.id);
  const rideId = toInt(raw.ride_id);
  const senderId = toInt(raw.sender_id);
  const senderRole = toRole(raw.sender_role);
  if (id === null || rideId === null || senderId === null || senderRole === null || typeof raw.body !== 'string') {
    return null;
  }
  return {
    id,
    rideId,
    clientId: toStringOrNull(raw.client_id),
    senderId,
    senderRole,
    isMine: raw.is_mine === true,
    body: raw.body,
    createdAt: typeof raw.created_at === 'string' ? raw.created_at : '',
    readAt: toStringOrNull(raw.read_at),
  };
};

export const toChatParty = (raw: unknown): ChatParty | null => {
  if (!isObject(raw)) return null;
  const id = toInt(raw.id);
  const role = toRole(raw.role);
  if (id === null || role === null) return null;
  return {
    id,
    role,
    firstName: toStringOrNull(raw.first_name),
    profileImageUrl: toStringOrNull(raw.profile_image_url),
  };
};

const toMessages = (raw: unknown): ChatMessage[] =>
  Array.isArray(raw) ? raw.map(toChatMessage).filter((m): m is ChatMessage => m !== null) : [];

export const toChatSummary = (raw: unknown): ChatSummary | null => {
  if (!isObject(raw)) return null;
  const rideId = toInt(raw.ride_id);
  if (rideId === null) return null;
  return {
    rideId,
    rideStatus: typeof raw.ride_status === 'string' ? raw.ride_status : '',
    canSend: raw.can_send === true,
    readOnlyUntil: toStringOrNull(raw.read_only_until),
    contactClosesAt: toStringOrNull(raw.contact_closes_at),
    otherParty: toChatParty(raw.other_party),
    lastMessage: toChatMessage(raw.last_message),
    unreadCount: Math.max(0, toInt(raw.unread_count) ?? 0),
  };
};

export const toChatThreadPage = (raw: unknown, rideId: number): ChatThreadPage => {
  const data = isObject(raw) ? raw : {};
  const messages = toMessages(data.messages);
  const highest = messages.reduce((max, m) => Math.max(max, m.id), 0);
  return {
    rideId: toInt(data.ride_id) ?? rideId,
    rideStatus: typeof data.ride_status === 'string' ? data.ride_status : '',
    canSend: data.can_send === true,
    readOnlyUntil: toStringOrNull(data.read_only_until),
    contactClosesAt: toStringOrNull(data.contact_closes_at),
    otherParty: toChatParty(data.other_party),
    otherPartyReadUpToId: Math.max(0, toInt(data.other_party_read_up_to_id) ?? 0),
    messages,
    hasMore: data.has_more === true,
    lastId: Math.max(toInt(data.last_id) ?? 0, highest),
  };
};

export interface MessagesQuery {
  afterId?: number;
  beforeId?: number;
  limit?: number;
}

export const chatApi = {
  async listChats(): Promise<ChatSummary[]> {
    const data = unwrap(await apiService.get<{ chats?: unknown }>('/chats'));
    const chats = isObject(data) && Array.isArray(data.chats) ? data.chats : [];
    return chats.map(toChatSummary).filter((c): c is ChatSummary => c !== null);
  },

  /** One cursor at most (the server 422s on both). */
  async getMessages(rideId: number, query: MessagesQuery = {}): Promise<ChatThreadPage> {
    const params: Record<string, number> = { limit: query.limit ?? CHAT_PAGE_LIMIT };
    if (query.afterId !== undefined) params.after_id = query.afterId;
    else if (query.beforeId !== undefined) params.before_id = query.beforeId;
    const data = unwrap(await apiService.get<unknown>(`/rides/${rideId}/messages`, { params }));
    return toChatThreadPage(data, rideId);
  },

  /** Resolves with the stored message (the first one when `clientId` was already used). */
  async sendMessage(rideId: number, body: string, clientId: string): Promise<ChatMessage> {
    const data = unwrap(
      await apiService.post<{ message?: unknown }>(`/rides/${rideId}/messages`, { body, client_id: clientId }),
    );
    const message = isObject(data) ? toChatMessage(data.message) : null;
    if (!message) {
      throw new Error('Invalid chat message response');
    }
    return message;
  },

  async markRead(rideId: number, upToId: number): Promise<ChatReadResult> {
    const data = unwrap(await apiService.post<unknown>(`/rides/${rideId}/messages/read`, { up_to_id: upToId }));
    const wire = isObject(data) ? data : {};
    return {
      rideId: toInt(wire.ride_id) ?? rideId,
      marked: toInt(wire.marked) ?? 0,
      unreadCount: toInt(wire.unread_count) ?? 0,
    };
  },
};
