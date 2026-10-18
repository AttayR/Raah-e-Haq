/**
 * T-570 (QA 2026-10-18): the phone-code send hold outlives the PhoneAuth screen.
 *
 * The server allows one code per number per 60 s (BE-16) and holds every number after a global
 * refusal (sms_unavailable, busy, otp_ip_limit). The screen kept that hold in component state,
 * so leaving PhoneAuth and coming back inside the cooldown showed an enabled "Send Code" whose
 * first tap only earned a 429. The last hold is remembered here, in memory only (never persisted
 * or logged), so the screen opens with that number and its "Send Code (0:45)" countdown.
 */
export type OtpSendHold = {
  /** E.164 number the hold is about. */
  phone: string;
  /** Every number is held, not just `phone`. */
  global: boolean;
  /** Seconds left, rounded up. */
  seconds: number;
};

type Stored = { phone: string; global: boolean; until: number };

let last: Stored | null = null;

/** Remember a hold of `seconds` for `phone` (or every number when `global`). */
export function rememberOtpSendHold(phone: string, global: boolean, seconds: number, now: number = Date.now()): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  last = { phone, global, until: now + seconds * 1000 };
}

/** The hold still running, or null once it has passed. */
export function activeOtpSendHold(now: number = Date.now()): OtpSendHold | null {
  if (!last) return null;
  const left = last.until - now;
  if (left <= 0) {
    last = null;
    return null;
  }
  return { phone: last.phone, global: last.global, seconds: Math.ceil(left / 1000) };
}

/** Forget the hold (tests, sign-out). */
export function resetOtpSendHold(): void {
  last = null;
}
