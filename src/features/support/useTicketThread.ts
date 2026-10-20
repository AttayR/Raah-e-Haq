import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError } from '../../core/api/errors';
import { useRemoteData, type RemoteData } from '../../core/api/useRemoteData';
import { toast } from '../../core/toast';
import { t } from '../../i18n';
import { createClientId } from '../chat/clientId';
import type { ChatSendError, PendingMessage } from '../chat/thread';
import { supportApi, TICKET_CLOSED } from './api';
import { onSupportReplyPush } from './events';
import type { SupportTicket } from './types';

/** What the thread shows: the ticket, or `gone` (403/404: not the caller's, or removed). */
export type TicketDetail = { kind: 'ticket'; ticket: SupportTicket } | { kind: 'gone' };

export interface TicketThread extends RemoteData<TicketDetail> {
  /** Replies on their way or refused (same shape as the ride chat's pending bubbles). */
  pending: PendingMessage[];
  /** Seconds left to wait after a 429 on reply (counting down); null otherwise. */
  waitSeconds: number | null;
  /** The wait it started from (stable while it counts down, for the screen-reader label). */
  waitTotal: number | null;
  /** False when nothing was sent (empty text). */
  send: (text: string) => boolean;
  retry: (clientId: string) => void;
}

const sendErrorOf = (cause: unknown): ChatSendError => {
  const error = toApiError(cause);
  if (error.code === TICKET_CLOSED) return 'closed';
  if (error.kind === 'rate_limited') return 'rate_limited';
  if (error.kind === 'validation') return 'invalid';
  if (error.kind === 'network' || error.kind === 'timeout') return 'network';
  return 'unknown';
};

/**
 * One ticket for the thread screen (UI-R18 §H5; BE-130): GET /support/tickets/{id} on open and
 * each time the screen comes back (`enabled`), on pull to refresh and when a support push for
 * this ticket arrives. No polling. A reply shows at once as a pending bubble; once the server
 * stores it, it joins the replies (a reply to a solved ticket reopens it). 409 TICKET_CLOSED
 * marks the ticket closed (the closed bar replaces the composer); 429 says how long to wait.
 */
export function useTicketThread(id: number, enabled: boolean): TicketThread {
  const fetch = useCallback(async (): Promise<TicketDetail> => {
    try {
      return { kind: 'ticket', ticket: await supportApi.ticket(id) };
    } catch (cause: unknown) {
      const kind = toApiError(cause).kind;
      if (kind === 'forbidden' || kind === 'not_found') return { kind: 'gone' };
      throw cause;
    }
  }, [id]);
  const remote = useRemoteData<TicketDetail>({ fetch, key: String(id), fallbackError: t('support.ticketFailed'), enabled });
  const { refresh, setData } = remote;
  const dataRef = useRef(remote.data);
  dataRef.current = remote.data;

  const [pending, setPending] = useState<PendingMessage[]>([]);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const [waitSeconds, setWaitSeconds] = useState<number | null>(null);
  const [waitTotal, setWaitTotal] = useState<number | null>(null);
  const waitTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
      if (waitTimer.current) clearInterval(waitTimer.current);
    },
    [],
  );

  useEffect(() => onSupportReplyPush((ticketId) => {
    if (ticketId === id) refresh();
  }), [id, refresh]);

  // Counts down from retry_after once a second (the Banner shows it; Send is off until 0).
  const holdFor = useCallback((seconds: number) => {
    let left = Math.max(1, Math.ceil(seconds));
    setWaitSeconds(left);
    setWaitTotal(left);
    if (waitTimer.current) clearInterval(waitTimer.current);
    waitTimer.current = setInterval(() => {
      left -= 1;
      if (!mounted.current) return;
      if (left > 0) {
        setWaitSeconds(left);
        return;
      }
      if (waitTimer.current) clearInterval(waitTimer.current);
      waitTimer.current = null;
      setWaitSeconds(null);
      setWaitTotal(null);
    }, 1000);
  }, []);

  const patchTicket = useCallback(
    (patch: (ticket: SupportTicket) => SupportTicket) => {
      const current = dataRef.current;
      if (current?.kind === 'ticket') setData({ kind: 'ticket', ticket: patch(current.ticket) });
    },
    [setData],
  );

  const deliver = useCallback(
    async (clientId: string, body: string) => {
      try {
        const reply = await supportApi.reply(id, body);
        if (!mounted.current) return;
        setPending((list) => list.filter((p) => p.clientId !== clientId));
        patchTicket((ticket) => ({
          ...ticket,
          replies: ticket.replies.some((r) => r.id === reply.id) ? ticket.replies : [...ticket.replies, reply],
          // BE-130 b: a reply to a solved request reopens it.
          status: ticket.status === 'resolved' ? 'open' : ticket.status,
          lastReplyAt: reply.createdAt,
        }));
      } catch (cause: unknown) {
        if (!mounted.current) return;
        const error = sendErrorOf(cause);
        if (error === 'closed') {
          // 409 TICKET_CLOSED: the closed bar replaces the composer and says why; the text is
          // not kept as a failed bubble (the ride chat's "chat closed" wording would be wrong).
          setPending((list) => list.filter((p) => p.clientId !== clientId));
          patchTicket((ticket) => ({ ...ticket, status: 'closed' }));
          toast.info(t('support.closedBar'));
          return;
        }
        setPending((list) => list.map((p) => (p.clientId === clientId ? { ...p, status: 'failed', error } : p)));
        if (error === 'rate_limited') holdFor(toApiError(cause).retryAfter ?? 60);
      }
    },
    [id, patchTicket, holdFor],
  );

  const send = useCallback(
    (text: string): boolean => {
      const body = text.trim();
      if (!body) return false;
      const clientId = createClientId();
      setPending((list) => [...list, { clientId, body, createdAt: new Date().toISOString(), status: 'sending', error: null }]);
      deliver(clientId, body);
      return true;
    },
    [deliver],
  );

  const retry = useCallback(
    (clientId: string) => {
      const item = pendingRef.current.find((p) => p.clientId === clientId);
      if (!item || item.status === 'sending') return;
      setPending((list) => list.map((p) => (p.clientId === clientId ? { ...p, status: 'sending', error: null } : p)));
      deliver(clientId, item.body);
    },
    [deliver],
  );

  return { ...remote, pending, waitSeconds, waitTotal, send, retry };
}
