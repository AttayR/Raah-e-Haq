import { useCallback, useEffect, useState } from 'react';
import { secondsUntil } from '../services/otpService';

/** BE-16: the server allows one send per 60 s per phone (and says so with 429 retry_after). */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
/** Used only if a send-otp response lacks a usable expires_in (BE-16 default TTL). */
export const OTP_FALLBACK_TTL_SECONDS = 60;

const positiveOr = (value: number | undefined | null, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

/**
 * Resend cooldown and code expiry for the phone-code screen, both as deadlines so a
 * backgrounded app still shows the right numbers. One 1 s ticker runs only while a
 * deadline is in the future and is cleared on unmount.
 */
export function useOtpTimers() {
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const resendIn = secondsUntil(resendAt, now);
  const expiresIn = secondsUntil(expiresAt, now);
  const ticking = resendIn > 0 || expiresIn > 0;

  useEffect(() => {
    if (!ticking) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  /** A code was sent: start expiry from the server's expires_in and the resend cooldown. */
  const codeSent = useCallback((expiresInSeconds?: number | null) => {
    const t = Date.now();
    setNow(t);
    setExpiresAt(t + positiveOr(expiresInSeconds, OTP_FALLBACK_TTL_SECONDS) * 1000);
    setResendAt(t + OTP_RESEND_COOLDOWN_SECONDS * 1000);
  }, []);

  /** The server refused a send (429): block resending for retry_after seconds. */
  const blockResend = useCallback((retryAfterSeconds?: number | null) => {
    const t = Date.now();
    setNow(t);
    setResendAt(t + positiveOr(retryAfterSeconds, OTP_RESEND_COOLDOWN_SECONDS) * 1000);
  }, []);

  /** The current code can no longer be used (e.g. too many wrong attempts). */
  const expireCode = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setExpiresAt(t);
  }, []);

  const clearCode = useCallback(() => setExpiresAt(null), []);

  return {
    resendIn,
    expiresIn,
    /** True once a sent code's lifetime has run out. */
    isExpired: expiresAt != null && expiresIn === 0,
    codeSent,
    blockResend,
    expireCode,
    clearCode,
  };
}
