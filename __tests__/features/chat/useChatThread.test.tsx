/**
 * T-510: useChatThread loads the latest page, polls after_id with the server's last_id only
 * while visible and the ride is active, sends optimistically with a UUID client_id (one silent
 * resend on a network error, manual retry with the same client_id), de-duplicates, marks read
 * with the highest received id, and handles chat_closed / chat_expired.
 */
import { act, renderHook } from '@testing-library/react-native';
import { ApiError } from '../../../src/core/api/errors';
import { chatApi } from '../../../src/features/chat/api';
import { CLIENT_ID_PATTERN } from '../../../src/features/chat/clientId';
import { sendErrorOf, useChatThread } from '../../../src/features/chat/hooks';
import { CHAT_POLL_INTERVAL_MS } from '../../../src/features/chat/polling';
import { mine, theirs, threadPage } from '../../../test-utils/chatFixtures';

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
    }
  });
};

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
};

const networkError = () => new ApiError({ kind: 'network', message: 'offline' });
const apiRefusal = (status: number, code: string, kind: ApiError['kind']) =>
  new ApiError({ kind, status, code, message: code });

let getMessages: jest.SpyInstance;
let sendMessage: jest.SpyInstance;
let markRead: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  getMessages = jest.spyOn(chatApi, 'getMessages');
  sendMessage = jest.spyOn(chatApi, 'sendMessage');
  markRead = jest.spyOn(chatApi, 'markRead').mockResolvedValue({ rideId: 7, marked: 1, unreadCount: 0 });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const renderThread = async (visible = true) => {
  const hook = renderHook(({ on }: { on: boolean }) => useChatThread(7, on), { initialProps: { on: visible } });
  await flush();
  return hook;
};

describe('useChatThread', () => {
  it('loads, then polls after_id = last_id every interval only while visible', async () => {
    getMessages
      .mockResolvedValueOnce(threadPage({ messages: [theirs(1), mine(2)], lastId: 2 }))
      .mockResolvedValueOnce(threadPage({ messages: [theirs(3)], lastId: 3 }))
      .mockResolvedValue(threadPage({ lastId: 3 }));
    const hook = await renderThread();

    expect(getMessages).toHaveBeenNthCalledWith(1, 7);
    expect(hook.result.current.state.status).toBe('ready');

    await advance(CHAT_POLL_INTERVAL_MS);
    expect(getMessages).toHaveBeenNthCalledWith(2, 7, { afterId: 2 });
    expect(hook.result.current.state.messages.map((m) => m.id)).toEqual([1, 2, 3]);

    await advance(CHAT_POLL_INTERVAL_MS);
    expect(getMessages).toHaveBeenNthCalledWith(3, 7, { afterId: 3 });

    // Blur / background: no more requests.
    hook.rerender({ on: false });
    await advance(CHAT_POLL_INTERVAL_MS * 5);
    expect(getMessages).toHaveBeenCalledTimes(3);

    // Back after a long time: catches up at once, then resumes the interval.
    hook.rerender({ on: true });
    await advance(0);
    expect(getMessages).toHaveBeenCalledTimes(4);
    hook.unmount();
    await advance(CHAT_POLL_INTERVAL_MS * 3);
    expect(getMessages).toHaveBeenCalledTimes(4);
  });

  it('does not poll a read-only (ended) chat', async () => {
    getMessages.mockResolvedValue(
      threadPage({ canSend: false, readOnlyUntil: '2026-10-12T12:00:00+00:00', rideStatus: 'completed', messages: [theirs(1, 'x', 'r')], lastId: 1 }),
    );
    await renderThread();
    await advance(CHAT_POLL_INTERVAL_MS * 3);
    expect(getMessages).toHaveBeenCalledTimes(1);
  });

  it('optimistic send with a UUID client_id; a network error resends once with the same client_id', async () => {
    getMessages.mockResolvedValue(threadPage({ lastId: 0 }));
    let resolveSecond: (value: ReturnType<typeof mine>) => void = () => {};
    sendMessage
      .mockRejectedValueOnce(networkError())
      .mockImplementationOnce(() => new Promise((r) => { resolveSecond = r; }));
    const hook = await renderThread(false);

    let accepted = false;
    act(() => {
      accepted = hook.result.current.send('  Hello  ');
    });
    expect(accepted).toBe(true);
    expect(hook.result.current.state.pending).toEqual([
      expect.objectContaining({ body: 'Hello', status: 'sending' }),
    ]);
    await flush();

    expect(sendMessage).toHaveBeenCalledTimes(2);
    const [rideId, body, clientId] = sendMessage.mock.calls[0];
    expect([rideId, body]).toEqual([7, 'Hello']);
    expect(clientId).toMatch(CLIENT_ID_PATTERN);
    expect(sendMessage.mock.calls[1]).toEqual([7, 'Hello', clientId]);

    await act(async () => resolveSecond(mine(9, clientId, 'Hello')));
    await flush();
    expect(hook.result.current.state.pending).toEqual([]);
    expect(hook.result.current.state.messages.map((m) => m.id)).toEqual([9]);
  });

  it('empty or whitespace-only text is not sent', async () => {
    getMessages.mockResolvedValue(threadPage());
    const hook = await renderThread(false);
    let accepted = true;
    act(() => {
      accepted = hook.result.current.send('   \n ');
    });
    expect(accepted).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('a failed send stays failed; retry reuses the client_id; the poll does not duplicate it', async () => {
    getMessages.mockResolvedValueOnce(threadPage({ lastId: 0 }));
    sendMessage.mockRejectedValueOnce(networkError()).mockRejectedValueOnce(networkError());
    const hook = await renderThread(false);

    act(() => {
      hook.result.current.send('Hi');
    });
    await flush();
    const [pending] = hook.result.current.state.pending;
    expect(pending).toMatchObject({ status: 'failed', error: 'network' });
    const clientId = pending.clientId;

    sendMessage.mockResolvedValueOnce(mine(4, clientId, 'Hi'));
    act(() => {
      hook.result.current.retry(clientId);
    });
    await flush();
    expect(sendMessage).toHaveBeenLastCalledWith(7, 'Hi', clientId);
    expect(hook.result.current.state.pending).toEqual([]);

    // The same message coming back from a poll (by id) is kept once.
    getMessages.mockResolvedValue(threadPage({ messages: [mine(4, clientId, 'Hi')], lastId: 4 }));
    hook.rerender({ on: true });
    await advance(CHAT_POLL_INTERVAL_MS);
    expect(hook.result.current.state.messages.filter((m) => m.id === 4)).toHaveLength(1);
  });

  it('429 on send is retryable; a non-retryable failure (422) ignores retry', async () => {
    getMessages.mockResolvedValue(threadPage());
    sendMessage
      .mockRejectedValueOnce(apiRefusal(429, 'rate_limited', 'rate_limited'))
      .mockRejectedValueOnce(new ApiError({ kind: 'validation', status: 422, message: 'bad', fieldErrors: { body: ['bad'] } }));
    const hook = await renderThread(false);

    act(() => {
      hook.result.current.send('one');
    });
    await flush();
    act(() => {
      hook.result.current.send('two');
    });
    await flush();
    const [first, second] = hook.result.current.state.pending;
    expect(first).toMatchObject({ status: 'failed', error: 'rate_limited' });
    expect(second).toMatchObject({ status: 'failed', error: 'invalid' });

    act(() => {
      hook.result.current.retry(second.clientId);
    });
    await flush();
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('409 chat_closed switches to read-only and reloads from the server', async () => {
    getMessages
      .mockResolvedValueOnce(threadPage())
      .mockResolvedValue(threadPage({ canSend: false, rideStatus: 'completed', readOnlyUntil: '2026-10-12T12:00:00+00:00' }));
    sendMessage.mockRejectedValueOnce(apiRefusal(409, 'chat_closed', 'conflict'));
    const hook = await renderThread(false);

    act(() => {
      hook.result.current.send('late');
    });
    await flush();

    expect(hook.result.current.state.pending[0]).toMatchObject({ status: 'failed', error: 'closed' });
    expect(hook.result.current.state.meta?.canSend).toBe(false);
    expect(hook.result.current.state.meta?.readOnlyUntil).toBe('2026-10-12T12:00:00+00:00');
    expect(getMessages).toHaveBeenCalledTimes(2);
  });

  it('409 chat_closed stops polling at once, while visible', async () => {
    getMessages
      .mockResolvedValueOnce(threadPage())
      .mockResolvedValue(threadPage({ canSend: false, rideStatus: 'completed', readOnlyUntil: '2026-10-12T12:00:00+00:00' }));
    sendMessage.mockRejectedValueOnce(apiRefusal(409, 'chat_closed', 'conflict'));
    const hook = await renderThread(true);

    act(() => {
      hook.result.current.send('late');
    });
    await flush();
    const calls = getMessages.mock.calls.length;
    await advance(CHAT_POLL_INTERVAL_MS * 4);
    expect(getMessages).toHaveBeenCalledTimes(calls);
    expect(getMessages.mock.calls.some((c) => c[1]?.afterId !== undefined)).toBe(false);
  });

  it('410 chat_expired and 403 not_ride_participant end the thread', async () => {
    getMessages.mockRejectedValueOnce(apiRefusal(410, 'chat_expired', 'unknown'));
    const expired = await renderThread();
    expect(expired.result.current.state.status).toBe('expired');

    getMessages.mockRejectedValueOnce(apiRefusal(403, 'not_ride_participant', 'forbidden'));
    const forbidden = await renderThread();
    expect(forbidden.result.current.state.status).toBe('forbidden');
  });

  it('a network failure on the first load shows the error, and reload recovers', async () => {
    getMessages.mockRejectedValueOnce(networkError()).mockResolvedValue(threadPage({ messages: [theirs(1, 'x', 'r')], lastId: 1 }));
    const hook = await renderThread(false);
    expect(hook.result.current.state.status).toBe('error');
    await act(async () => {
      hook.result.current.reload();
    });
    await flush();
    expect(hook.result.current.state.status).toBe('ready');
  });

  it('marks read up to the highest received id while visible, once per new message', async () => {
    getMessages
      .mockResolvedValueOnce(threadPage({ messages: [theirs(1), mine(2), theirs(3), mine(4)], lastId: 4 }))
      .mockResolvedValueOnce(threadPage({ messages: [theirs(5)], lastId: 5 }))
      .mockResolvedValue(threadPage({ lastId: 5 }));
    const hook = await renderThread(false);

    // Not visible: nothing is marked.
    expect(markRead).not.toHaveBeenCalled();

    hook.rerender({ on: true });
    await flush();
    expect(markRead).toHaveBeenCalledTimes(1);
    expect(markRead).toHaveBeenLastCalledWith(7, 3);

    await advance(CHAT_POLL_INTERVAL_MS);
    expect(markRead).toHaveBeenCalledTimes(2);
    expect(markRead).toHaveBeenLastCalledWith(7, 5);

    await advance(CHAT_POLL_INTERVAL_MS);
    expect(markRead).toHaveBeenCalledTimes(2);
  });

  it('does not mark read when everything received is already read', async () => {
    getMessages.mockResolvedValue(threadPage({ messages: [theirs(1, 'x', '2026-10-11T12:01:00Z')], lastId: 1 }));
    await renderThread();
    expect(markRead).not.toHaveBeenCalled();
  });

  it('maps send refusals to bubble reasons', () => {
    expect(sendErrorOf(networkError())).toBe('network');
    expect(sendErrorOf(new ApiError({ kind: 'timeout', message: 't' }))).toBe('network');
    expect(sendErrorOf(apiRefusal(409, 'chat_not_open', 'conflict'))).toBe('not_open');
    expect(sendErrorOf(apiRefusal(500, 'x', 'server'))).toBe('unknown');
    expect(sendErrorOf(new Error('x'))).toBe('unknown');
  });
});
