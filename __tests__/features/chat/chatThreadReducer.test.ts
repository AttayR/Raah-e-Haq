/**
 * T-510: the thread reducer de-duplicates by id, swaps an optimistic bubble for the stored
 * message by client_id (from the POST answer or from a poll), keeps failed sends for retry,
 * and derives "Seen" from other_party_read_up_to_id.
 */
import {
  chatThreadReducer,
  highestReceivedId,
  initialThreadState,
  isRetryableSendError,
  seenMessageId,
  threadItemsNewestFirst,
  type ChatThreadState,
} from '../../../src/features/chat/thread';
import { mine, theirs, threadPage } from '../../../test-utils/chatFixtures';

const loaded = (overrides: Parameters<typeof threadPage>[0] = {}): ChatThreadState =>
  chatThreadReducer(initialThreadState, { type: 'loaded', page: threadPage(overrides) });

describe('chatThreadReducer', () => {
  it('loads the first page and moves the cursor', () => {
    const state = loaded({ messages: [theirs(1), mine(2)], lastId: 2, hasMore: true });
    expect(state.status).toBe('ready');
    expect(state.messages.map((m) => m.id)).toEqual([1, 2]);
    expect(state.lastId).toBe(2);
    expect(state.hasOlder).toBe(true);
  });

  it('a poll merges by id: repeats are not duplicated and order follows the id', () => {
    let state = loaded({ messages: [theirs(1), theirs(3)], lastId: 3 });
    state = chatThreadReducer(state, { type: 'polled', page: threadPage({ messages: [theirs(3), theirs(4), theirs(2)], lastId: 4 }) });
    expect(state.messages.map((m) => m.id)).toEqual([1, 2, 3, 4]);
    expect(state.lastId).toBe(4);
    // A stale (lower) cursor never moves it back.
    state = chatThreadReducer(state, { type: 'polled', page: threadPage({ lastId: 2 }) });
    expect(state.lastId).toBe(4);
  });

  it('older pages prepend without touching the poll cursor', () => {
    let state = loaded({ messages: [theirs(10)], lastId: 10, hasMore: true });
    state = chatThreadReducer(state, { type: 'olderStarted' });
    state = chatThreadReducer(state, { type: 'olderLoaded', page: threadPage({ messages: [theirs(8), theirs(9)], hasMore: false }) });
    expect(state.messages.map((m) => m.id)).toEqual([8, 9, 10]);
    expect(state.hasOlder).toBe(false);
    expect(state.loadingOlder).toBe(false);
    expect(state.lastId).toBe(10);
  });

  it('optimistic send: pending at once, replaced by the stored message on success', () => {
    let state = loaded({ messages: [theirs(1)], lastId: 1 });
    state = chatThreadReducer(state, { type: 'sendStarted', clientId: 'c-1', body: 'Hi', createdAt: 'now' });
    expect(state.pending).toEqual([{ clientId: 'c-1', body: 'Hi', createdAt: 'now', status: 'sending', error: null }]);
    expect(threadItemsNewestFirst(state)[0]).toMatchObject({ kind: 'pending', key: 'p-c-1' });

    state = chatThreadReducer(state, { type: 'sendSucceeded', clientId: 'c-1', message: mine(2, 'c-1', 'Hi') });
    expect(state.pending).toEqual([]);
    expect(state.messages.map((m) => m.id)).toEqual([1, 2]);
  });

  it('a poll that already carries the sent message (same client_id) clears the pending bubble, once', () => {
    let state = loaded({ lastId: 0 });
    state = chatThreadReducer(state, { type: 'sendStarted', clientId: 'c-1', body: 'Hi', createdAt: 'now' });
    state = chatThreadReducer(state, { type: 'polled', page: threadPage({ messages: [mine(5, 'c-1', 'Hi')], lastId: 5 }) });
    expect(state.pending).toEqual([]);
    // The POST answer arriving afterwards does not add it twice.
    state = chatThreadReducer(state, { type: 'sendSucceeded', clientId: 'c-1', message: mine(5, 'c-1', 'Hi') });
    expect(state.messages.filter((m) => m.id === 5)).toHaveLength(1);
  });

  it('failed sends stay with their reason; retry goes back to sending with the same client_id', () => {
    let state = loaded();
    state = chatThreadReducer(state, { type: 'sendStarted', clientId: 'c-1', body: 'Hi', createdAt: 'now' });
    state = chatThreadReducer(state, { type: 'sendFailed', clientId: 'c-1', error: 'network' });
    expect(state.pending[0]).toMatchObject({ clientId: 'c-1', status: 'failed', error: 'network' });
    state = chatThreadReducer(state, { type: 'retryStarted', clientId: 'c-1' });
    expect(state.pending[0]).toMatchObject({ clientId: 'c-1', status: 'sending', error: null });
    expect(isRetryableSendError('network')).toBe(true);
    expect(isRetryableSendError('rate_limited')).toBe(true);
    expect(isRetryableSendError('closed')).toBe(false);
    expect(isRetryableSendError('invalid')).toBe(false);
  });

  it('closed turns the composer off; 403/410 end the thread', () => {
    let state = chatThreadReducer(loaded(), { type: 'closed' });
    expect(state.meta?.canSend).toBe(false);
    state = chatThreadReducer(state, { type: 'ended', status: 'expired' });
    expect(state.status).toBe('expired');
  });

  it('a failed reload keeps a loaded thread; a failed first load shows the error', () => {
    expect(chatThreadReducer(loaded(), { type: 'loadFailed', message: 'x' }).status).toBe('ready');
    expect(chatThreadReducer(initialThreadState, { type: 'loadFailed', message: 'x' })).toMatchObject({
      status: 'error',
      errorMessage: 'x',
    });
  });

  it('"Seen" marks your newest message at or below other_party_read_up_to_id; receipts never go back', () => {
    let state = loaded({ messages: [mine(1), theirs(2), mine(3), mine(5)], otherPartyReadUpToId: 4, lastId: 5 });
    expect(seenMessageId(state)).toBe(3);
    state = chatThreadReducer(state, { type: 'polled', page: threadPage({ otherPartyReadUpToId: 1 }) });
    expect(state.meta?.otherPartyReadUpToId).toBe(4);
    state = chatThreadReducer(state, { type: 'polled', page: threadPage({ otherPartyReadUpToId: 5 }) });
    expect(seenMessageId(state)).toBe(5);
    expect(seenMessageId(loaded({ messages: [mine(1)] }))).toBeNull();
  });

  it('highestReceivedId ignores your own messages', () => {
    expect(highestReceivedId([theirs(2), mine(9), theirs(4)])).toBe(4);
    expect(highestReceivedId([mine(9)])).toBe(0);
  });
});
