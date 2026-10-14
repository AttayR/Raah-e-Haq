/**
 * In-ride chat models (T-510, BE-13; docs/api/CONTRACT_NOTES.md "BE-13: in-ride chat").
 * The wire shapes are snake_case and loosely typed; `api.ts` maps them into these.
 */

export type ChatRole = 'passenger' | 'driver';

/** One message (`M`). `body` is plain text: always rendered as text, never as HTML. */
export interface ChatMessage {
  id: number;
  rideId: number;
  /** Only on your own messages (null on the other party's). */
  clientId: string | null;
  senderId: number;
  senderRole: ChatRole;
  isMine: boolean;
  body: string;
  createdAt: string;
  readAt: string | null;
}

/** The other party's card (`P`). Never a phone number. */
export interface ChatParty {
  id: number;
  role: ChatRole;
  firstName: string | null;
  profileImageUrl: string | null;
}

/** One row of GET /chats. */
export interface ChatSummary {
  rideId: number;
  rideStatus: string;
  canSend: boolean;
  /** Null while the ride is active; else the ISO time the chat disappears. */
  readOnlyUntil: string | null;
  /** BE-78: when sending (and calling) closes for the caller; null while the ride is active. */
  contactClosesAt: string | null;
  otherParty: ChatParty | null;
  lastMessage: ChatMessage | null;
  unreadCount: number;
}

/** What GET /rides/{id}/messages says about the thread, besides the messages. */
export interface ChatThreadMeta {
  rideId: number;
  rideStatus: string;
  canSend: boolean;
  readOnlyUntil: string | null;
  /** BE-78: sending closes at this time (30 min after the ride ended); null while active. */
  contactClosesAt: string | null;
  otherParty: ChatParty | null;
  /** Highest id of your messages the other party has read (0 when none). */
  otherPartyReadUpToId: number;
}

/** One page of GET /rides/{id}/messages. */
export interface ChatThreadPage extends ChatThreadMeta {
  messages: ChatMessage[];
  hasMore: boolean;
  /** The cursor for the next `after_id` poll (unchanged when nothing is new). */
  lastId: number;
}

/** POST /rides/{id}/messages/read answer. */
export interface ChatReadResult {
  rideId: number;
  marked: number;
  unreadCount: number;
}
