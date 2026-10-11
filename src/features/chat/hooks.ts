import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { isApiError } from '../../core/api/errors';
import { errorToastMessage } from '../../core/toast/toast';
import { CHAT_BODY_MAX_LENGTH, CHAT_CODES, chatApi } from './api';
import { createClientId } from './clientId';
import { CHAT_COPY } from './copy';
import { usePolling, type PollOutcome } from './polling';
import {
  chatThreadReducer,
  initialThreadState,
  isRetryableSendError,
  type ChatSendError,
  type ChatThreadState,
} from './thread';
import type { ChatSummary } from './types';

/** 403 (not a participant, e.g. a requeued driver), 404 and 410 end the thread for good. */
const terminalStatusOf = (error: unknown): 'forbidden' | 'expired' | null => {
  if (!isApiError(error)) return null;
  if (error.status === 410 || error.code === CHAT_CODES.expired) return 'expired';
  if (error.status === 403 || error.status === 404) return 'forbidden';
  return null;
};

/** Why a POST /messages failed, for the failed bubble's text and whether it can be retried. */
export const sendErrorOf = (error: unknown): ChatSendError => {
  if (!isApiError(error)) return 'unknown';
  if (error.code === CHAT_CODES.closed) return 'closed';
  if (error.code === CHAT_CODES.notOpen) return 'not_open';
  switch (error.kind) {
    case 'network':
    case 'timeout':
      return 'network';
    case 'rate_limited':
      return 'rate_limited';
    case 'validation':
      return 'invalid';
    case 'conflict':
      return 'closed';
    default:
      return 'unknown';
  }
};

export interface ChatThread {
  state: ChatThreadState;
  /** Reloads the latest page (the error state's "Try again"). */
  reload: () => void;
  loadOlder: () => void;
  /** Sends `text` optimistically; false when it is empty or too long (nothing is sent). */
  send: (text: string) => boolean;
  /** Resends a failed message with its original `client_id`. */
  retry: (clientId: string) => void;
}

/**
 * One ride's chat thread (T-510): the first page, polling for newer messages while `visible`
 * (screen focused + app in the foreground) and the ride is still active, older pages on
 * demand, optimistic sends with an idempotent retry, and read receipts for what was shown.
 */
export const useChatThread = (rideId: number, visible: boolean): ChatThread => {
  const [state, dispatch] = useReducer(chatThreadReducer, initialThreadState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  // Cursors kept outside React state so a poll fired right after a dispatch reads the newest.
  const lastIdRef = useRef(0);
  const lastFetchedAt = useRef(0);

  const endIfTerminal = useCallback((error: unknown): boolean => {
    const status = terminalStatusOf(error);
    if (status) dispatch({ type: 'ended', status });
    return status !== null;
  }, []);

  const load = useCallback(async () => {
    dispatch({ type: 'loadStarted' });
    try {
      const page = await chatApi.getMessages(rideId);
      lastIdRef.current = Math.max(lastIdRef.current, page.lastId);
      lastFetchedAt.current = Date.now();
      dispatch({ type: 'loaded', page });
    } catch (error) {
      if (!endIfTerminal(error)) {
        dispatch({ type: 'loadFailed', message: errorToastMessage(error, CHAT_COPY.threadError) ?? CHAT_COPY.threadError });
      }
    }
  }, [rideId, endIfTerminal]);

  useEffect(() => {
    load();
  }, [load]);

  const poll = useCallback(async (): Promise<PollOutcome> => {
    try {
      const page = await chatApi.getMessages(rideId, { afterId: lastIdRef.current });
      lastIdRef.current = Math.max(lastIdRef.current, page.lastId);
      dispatch({ type: 'polled', page });
      if (page.hasMore) return 'again';
      // An ended ride gets no new messages (the server refuses sends): stop asking.
      return page.readOnlyUntil ? 'stop' : 'continue';
    } catch (error) {
      if (endIfTerminal(error)) return 'stop';
      throw error;
    }
  }, [rideId, endIfTerminal]);

  // Only an open chat gets new messages: an ended ride (read_only_until set) or a 409
  // chat_closed (can_send false at once) stops the poll.
  const pollEnabled =
    visible && state.status === 'ready' && state.meta !== null && state.meta.canSend && state.meta.readOnlyUntil === null;
  usePolling({ enabled: pollEnabled, run: poll, lastFetchedAt });

  const loadOlder = useCallback(() => {
    const current = stateRef.current;
    const first = current.messages[0];
    if (!first || !current.hasOlder || current.loadingOlder || current.status !== 'ready') return;
    dispatch({ type: 'olderStarted' });
    chatApi
      .getMessages(rideId, { beforeId: first.id })
      .then((page) => dispatch({ type: 'olderLoaded', page }))
      .catch((error) => {
        if (!endIfTerminal(error)) dispatch({ type: 'olderFailed' });
      });
  }, [rideId, endIfTerminal]);

  // Read receipts: while the thread is visible, mark up to the highest received id once a
  // received message is still unread on the server.
  const lastMarked = useRef(0);
  let highestReceived = 0;
  let highestUnread = 0;
  state.messages.forEach((m) => {
    if (m.isMine) return;
    highestReceived = Math.max(highestReceived, m.id);
    if (m.readAt === null) highestUnread = Math.max(highestUnread, m.id);
  });
  useEffect(() => {
    if (!visible || state.status !== 'ready' || highestUnread <= lastMarked.current) return;
    const previous = lastMarked.current;
    const upTo = highestReceived;
    lastMarked.current = upTo;
    chatApi.markRead(rideId, upTo).catch((error) => {
      if (endIfTerminal(error)) return;
      // Try again with the next change (a new message or coming back to the thread).
      if (lastMarked.current === upTo) lastMarked.current = previous;
    });
  }, [visible, state.status, highestReceived, highestUnread, rideId, endIfTerminal]);

  const deliver = useCallback(
    async (clientId: string, body: string, autoRetry: boolean): Promise<void> => {
      try {
        const message = await chatApi.sendMessage(rideId, body, clientId);
        dispatch({ type: 'sendSucceeded', clientId, message });
      } catch (error) {
        if (endIfTerminal(error)) {
          dispatch({ type: 'sendFailed', clientId, error: 'unknown' });
          return;
        }
        const reason = sendErrorOf(error);
        // A timeout or dropped connection may have stored it: one automatic resend with the
        // same client_id is safe (the server answers with the first message).
        if (reason === 'network' && autoRetry) {
          await deliver(clientId, body, false);
          return;
        }
        dispatch({ type: 'sendFailed', clientId, error: reason });
        if (reason === 'closed' || reason === 'not_open') {
          // The ride ended (or has no driver) meanwhile: switch to read-only from the server.
          dispatch({ type: 'closed' });
          load();
        }
      }
    },
    [rideId, endIfTerminal, load],
  );

  const send = useCallback(
    (text: string): boolean => {
      const body = text.trim();
      if (body.length === 0 || body.length > CHAT_BODY_MAX_LENGTH) return false;
      const clientId = createClientId();
      dispatch({ type: 'sendStarted', clientId, body, createdAt: new Date().toISOString() });
      deliver(clientId, body, true);
      return true;
    },
    [deliver],
  );

  const retry = useCallback(
    (clientId: string) => {
      const pending = stateRef.current.pending.find((p) => p.clientId === clientId);
      if (!pending || pending.status !== 'failed' || !pending.error || !isRetryableSendError(pending.error)) return;
      dispatch({ type: 'retryStarted', clientId });
      deliver(clientId, pending.body, false);
    },
    [deliver],
  );

  return { state, reload: load, loadOlder, send, retry };
};

export type ChatListStatus = 'loading' | 'ready' | 'error';

export interface ChatList {
  chats: ChatSummary[];
  status: ChatListStatus;
  errorMessage: string | null;
  refreshing: boolean;
  refresh: () => void;
}

/**
 * The Chat tab's list (GET /chats). Loaded when the tab becomes `visible` (focused), again on
 * every return to it and on pull-to-refresh; a stale answer never overwrites a newer one.
 */
export const useChatList = (visible: boolean): ChatList => {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [status, setStatus] = useState<ChatListStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadedOnce = useRef(false);
  const requestSeq = useRef(0);

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'silent') => {
    const seq = ++requestSeq.current;
    if (mode === 'refresh') setRefreshing(true);
    if (mode === 'initial') setStatus('loading');
    try {
      const result = await chatApi.listChats();
      if (seq !== requestSeq.current) return;
      loadedOnce.current = true;
      setChats(result);
      setStatus('ready');
      setErrorMessage(null);
    } catch (error) {
      if (seq !== requestSeq.current) return;
      // A failed background refresh keeps the list it has.
      if (!loadedOnce.current || mode !== 'silent') {
        setErrorMessage(errorToastMessage(error, CHAT_COPY.listError) ?? CHAT_COPY.listError);
        if (!loadedOnce.current) setStatus('error');
      }
    } finally {
      if (seq === requestSeq.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (visible) load(loadedOnce.current ? 'silent' : 'initial');
  }, [visible, load]);

  const refresh = useCallback(() => {
    load(loadedOnce.current ? 'refresh' : 'initial');
  }, [load]);

  return { chats, status, errorMessage, refreshing, refresh };
};
