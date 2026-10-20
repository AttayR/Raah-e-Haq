import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError, type ApiError } from '../../core/api/errors';
import { useRemoteData, type RemoteData } from '../../core/api/useRemoteData';
import { t } from '../../i18n';
import { accountDeletionApi, DELETION_CODES, type DeletionCodeSent, type DeletionStatus } from './api';

/**
 * GET /account/deletion, read when the screen opens and again each time it is focused (back
 * from Pay now, Verify number or the code step after a 409), so the blockers are current.
 * Never cached: the consequences must be the server's answer of now.
 */
export function useDeletionStatus(focused: boolean): RemoteData<DeletionStatus> {
  const fetch = useCallback(() => accountDeletionApi.status(), []);
  return useRemoteData<DeletionStatus>({ fetch, fallbackError: t('accountDeletion.loadFailed'), enabled: focused });
}

/** Seconds left from `seconds` (restarts when `seconds` or `restartKey` changes); 1 s ticks, cleared on unmount. */
export function useCountdown(seconds: number, restartKey = 0): number {
  const [left, setLeft] = useState(Math.max(0, Math.ceil(seconds)));
  useEffect(() => {
    setLeft(Math.max(0, Math.ceil(seconds)));
    if (seconds <= 0) return undefined;
    const timer = setInterval(() => {
      setLeft((current) => {
        if (current <= 1) {
          clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [seconds, restartKey]);
  return left;
}

/** How a POST /account/deletion/code ended (§D2: "Continue" and "Resend code"). */
export type CodeSendOutcome =
  | { kind: 'sent'; sent: DeletionCodeSent }
  /** 429 otp_cooldown / otp_send_limit / otp_ip_limit: wait `retryAfter` seconds. */
  | { kind: 'wait'; retryAfter: number }
  /** 403 PHONE_NOT_VERIFIED / 409 DELETION_ALREADY_SCHEDULED: re-read the status. */
  | { kind: 'stale'; code: string }
  /** 503 sms_unavailable (server text), network or anything else. */
  | { kind: 'failed'; message: string }
  | { kind: 'cancelled' };

const sendOutcomeOf = (error: ApiError): CodeSendOutcome => {
  if (error.kind === 'cancelled') return { kind: 'cancelled' };
  if (error.status === 429) return { kind: 'wait', retryAfter: error.retryAfter ?? 60 };
  if (error.code === DELETION_CODES.phoneNotVerified || error.code === DELETION_CODES.alreadyScheduled) {
    return { kind: 'stale', code: error.code };
  }
  if (error.code === DELETION_CODES.smsUnavailable) return { kind: 'failed', message: error.message };
  return { kind: 'failed', message: t('accountDeletion.codeFailed') };
};

/** POST /account/deletion/code with a double-tap guard; never rejects. */
export function useSendDeletionCode(): { send: () => Promise<CodeSendOutcome | null>; sending: boolean } {
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const send = useCallback(async (): Promise<CodeSendOutcome | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setSending(true);
    try {
      return { kind: 'sent', sent: await accountDeletionApi.sendCode() };
    } catch (error: unknown) {
      return sendOutcomeOf(toApiError(error));
    } finally {
      inFlight.current = false;
      if (mounted.current) setSending(false);
    }
  }, []);
  return { send, sending };
}
