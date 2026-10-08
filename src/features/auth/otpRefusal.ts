import type { ApiErrorKind } from '../../core/api/errors';

/**
 * What an OTP screen does with a refused send or verify (BE-28 contract, T-111). The
 * decision is made on the server's `code`, never on status heuristics:
 *
 * - burned       `code_exhausted`: the code is spent (too many wrong tries). Clear the input,
 *                stop verifying, allow Resend after `retry_after`.
 * - cooldown     `otp_cooldown`, `otp_send_limit`, the throttle's `rate_limited`, or a 429
 *                without a code: count down from `retry_after` before the next send.
 * - limit        `otp_ip_limit`, `otp_verify_limit`: phone sign-in is capped for now. Show the
 *                server's message and suggest email sign-in.
 * - unavailable  503 `sms_unavailable` / `busy`: show the server's message and hold resending
 *                for `retry_after`.
 * - other        anything else (wrong code 401, 403 ACCOUNT_*, validation, network).
 */
export type OtpRefusalAction = 'burned' | 'cooldown' | 'limit' | 'unavailable' | 'other';

export interface OtpRefusalLike {
  kind?: ApiErrorKind;
  code?: string;
}

export function classifyOtpRefusal(refusal: OtpRefusalLike | null | undefined): OtpRefusalAction {
  switch (refusal?.code) {
    case 'code_exhausted':
      return 'burned';
    case 'otp_cooldown':
    case 'otp_send_limit':
    case 'rate_limited':
      return 'cooldown';
    case 'otp_ip_limit':
    case 'otp_verify_limit':
      return 'limit';
    case 'sms_unavailable':
    case 'busy':
      return 'unavailable';
    default:
      // A 429 from a route or proxy that sends no code: still a "wait" (retry_after or 60 s).
      return refusal?.kind === 'rate_limited' && !refusal.code ? 'cooldown' : 'other';
  }
}
