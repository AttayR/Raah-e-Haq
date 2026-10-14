import type { ChatMessage, ChatThreadMeta, ChatThreadPage } from './types';

/**
 * The chat thread's state as a pure reducer (T-510), so merging, de-duplication, optimistic
 * sends and read receipts are unit-tested without React.
 *
 * - Server messages are kept once per `id`, sorted by id (the server's order).
 * - A send shows a pending bubble keyed by its `client_id` at once; the POST answer (or a poll
 *   that already carries the message with that `client_id`) replaces it.
 * - A failed send stays as a failed bubble; retrying reuses the same `client_id`, so the
 *   server stores it once even if the first attempt did arrive.
 */

/** Why a send failed; `retryable` ones show "Retry". */
export type ChatSendError = 'network' | 'rate_limited' | 'not_open' | 'closed' | 'invalid' | 'unknown';

export const isRetryableSendError = (error: ChatSendError): boolean =>
  error === 'network' || error === 'rate_limited' || error === 'unknown';

export interface PendingMessage {
  clientId: string;
  body: string;
  createdAt: string;
  status: 'sending' | 'failed';
  error: ChatSendError | null;
}

/** `closed`: the thread could not be read because contact closed (BE-78 403 CONTACT_CLOSED). */
export type ChatThreadStatus = 'loading' | 'ready' | 'error' | 'forbidden' | 'expired' | 'closed';

export interface ChatThreadState {
  status: ChatThreadStatus;
  meta: ChatThreadMeta | null;
  messages: ChatMessage[];
  pending: PendingMessage[];
  /** The `after_id` cursor for the next poll. */
  lastId: number;
  /** Older messages exist (load them with `before_id` = the first id shown). */
  hasOlder: boolean;
  loadingOlder: boolean;
  errorMessage: string | null;
}

export const initialThreadState: ChatThreadState = {
  status: 'loading',
  meta: null,
  messages: [],
  pending: [],
  lastId: 0,
  hasOlder: false,
  loadingOlder: false,
  errorMessage: null,
};

export type ChatThreadAction =
  | { type: 'loadStarted' }
  | { type: 'loaded'; page: ChatThreadPage }
  | { type: 'loadFailed'; message: string }
  | { type: 'ended'; status: 'forbidden' | 'expired' | 'closed' }
  | { type: 'polled'; page: ChatThreadPage }
  | { type: 'olderStarted' }
  | { type: 'olderLoaded'; page: ChatThreadPage }
  | { type: 'olderFailed' }
  | { type: 'sendStarted'; clientId: string; body: string; createdAt: string }
  | { type: 'sendSucceeded'; clientId: string; message: ChatMessage }
  | { type: 'sendFailed'; clientId: string; error: ChatSendError }
  | { type: 'retryStarted'; clientId: string }
  | { type: 'closed' };

/** `existing` plus `incoming`, one per id, sorted by id. */
export const mergeMessages = (existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] => {
  if (incoming.length === 0) return existing;
  const byId = new Map<number, ChatMessage>();
  existing.forEach((m) => byId.set(m.id, m));
  incoming.forEach((m) => byId.set(m.id, m));
  return Array.from(byId.values()).sort((a, b) => a.id - b.id);
};

/** Pending bubbles whose message the server already returned (matched by `client_id`). */
const withoutDelivered = (pending: PendingMessage[], messages: ChatMessage[]): PendingMessage[] => {
  if (pending.length === 0) return pending;
  const delivered = new Set(messages.filter((m) => m.isMine && m.clientId).map((m) => m.clientId));
  return pending.filter((p) => !delivered.has(p.clientId));
};

const metaOf = (page: ChatThreadPage, previous: ChatThreadMeta | null): ChatThreadMeta => ({
  rideId: page.rideId,
  rideStatus: page.rideStatus,
  canSend: page.canSend,
  readOnlyUntil: page.readOnlyUntil,
  contactClosesAt: page.contactClosesAt,
  otherParty: page.otherParty ?? previous?.otherParty ?? null,
  // Read receipts only move forward (a stale answer never hides "Seen").
  otherPartyReadUpToId: Math.max(page.otherPartyReadUpToId, previous?.otherPartyReadUpToId ?? 0),
});

const updatePending = (
  pending: PendingMessage[],
  clientId: string,
  patch: Partial<PendingMessage>,
): PendingMessage[] => pending.map((p) => (p.clientId === clientId ? { ...p, ...patch } : p));

export const chatThreadReducer = (state: ChatThreadState, action: ChatThreadAction): ChatThreadState => {
  switch (action.type) {
    case 'loadStarted':
      return { ...state, status: state.status === 'ready' ? 'ready' : 'loading', errorMessage: null };
    case 'loaded': {
      const messages = mergeMessages(state.messages, action.page.messages);
      return {
        ...state,
        status: 'ready',
        meta: metaOf(action.page, state.meta),
        messages,
        pending: withoutDelivered(state.pending, messages),
        lastId: Math.max(state.lastId, action.page.lastId),
        hasOlder: action.page.hasMore,
        errorMessage: null,
      };
    }
    case 'loadFailed':
      return state.status === 'ready' ? state : { ...state, status: 'error', errorMessage: action.message };
    case 'ended':
      return { ...state, status: action.status };
    case 'polled': {
      const messages = mergeMessages(state.messages, action.page.messages);
      return {
        ...state,
        meta: metaOf(action.page, state.meta),
        messages,
        pending: withoutDelivered(state.pending, messages),
        lastId: Math.max(state.lastId, action.page.lastId),
      };
    }
    case 'olderStarted':
      return { ...state, loadingOlder: true };
    case 'olderLoaded':
      return {
        ...state,
        messages: mergeMessages(state.messages, action.page.messages),
        hasOlder: action.page.hasMore,
        loadingOlder: false,
      };
    case 'olderFailed':
      return { ...state, loadingOlder: false };
    case 'sendStarted':
      return {
        ...state,
        pending: [
          ...state.pending,
          { clientId: action.clientId, body: action.body, createdAt: action.createdAt, status: 'sending', error: null },
        ],
      };
    case 'sendSucceeded': {
      const messages = mergeMessages(state.messages, [action.message]);
      return {
        ...state,
        messages,
        pending: state.pending.filter((p) => p.clientId !== action.clientId),
      };
    }
    case 'sendFailed':
      return { ...state, pending: updatePending(state.pending, action.clientId, { status: 'failed', error: action.error }) };
    case 'retryStarted':
      return { ...state, pending: updatePending(state.pending, action.clientId, { status: 'sending', error: null }) };
    case 'closed':
      return state.meta ? { ...state, meta: { ...state.meta, canSend: false } } : state;
    default:
      return state;
  }
};

/** The highest id the other party sent (what POST /read marks), or 0. */
export const highestReceivedId = (messages: ChatMessage[]): number =>
  messages.reduce((max, m) => (!m.isMine && m.id > max ? m.id : max), 0);

/** The id of your newest message the other party has read (it gets "Seen"), or null. */
export const seenMessageId = (state: Pick<ChatThreadState, 'messages' | 'meta'>): number | null => {
  const upTo = state.meta?.otherPartyReadUpToId ?? 0;
  if (upTo <= 0) return null;
  let seen: number | null = null;
  state.messages.forEach((m) => {
    if (m.isMine && m.id <= upTo) seen = m.id;
  });
  return seen;
};

/** One row of the thread list: a stored message or a pending (sending/failed) one. */
export type ThreadItem =
  | { kind: 'message'; key: string; message: ChatMessage }
  | { kind: 'pending'; key: string; pending: PendingMessage };

/** The rows newest first (for an inverted list): pending sends are always the newest. */
export const threadItemsNewestFirst = (state: Pick<ChatThreadState, 'messages' | 'pending'>): ThreadItem[] => {
  const items: ThreadItem[] = state.messages.map((message) => ({ kind: 'message', key: `m-${message.id}`, message }));
  state.pending.forEach((pending) => items.push({ kind: 'pending', key: `p-${pending.clientId}`, pending }));
  return items.reverse();
};
