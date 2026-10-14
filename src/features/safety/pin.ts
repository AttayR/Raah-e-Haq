import type { ThunkRejection } from '../../core/api/errors';

/**
 * The driver's start PIN refusals (BE-81): POST /rides/{id}/start {pin}.
 * - 422 PIN_REQUIRED (no pin sent), 422 PIN_INVALID with `error.attempts_left`
 * - 423 PIN_LOCKED with `error.retry_after` seconds (and a Retry-After header)
 * - 423 PIN_BLOCKED: an admin must clear it; the driver contacts support
 * - a malformed pin is a plain 422 `errors.pin` (no attempt used)
 */
export const PIN_CODES = {
  required: 'PIN_REQUIRED',
  invalid: 'PIN_INVALID',
  locked: 'PIN_LOCKED',
  blocked: 'PIN_BLOCKED',
} as const;

export type PinRefusal =
  | { kind: 'required' }
  | { kind: 'invalid'; attemptsLeft: number | null }
  | { kind: 'locked'; retryAfterSeconds: number }
  | { kind: 'blocked' }
  | { kind: 'malformed' };

/** Default wait when a lock answer carries no usable retry_after (BE-81 locks for 2 min). */
export const DEFAULT_PIN_LOCK_SECONDS = 120;

const PIN_CODE_SET: ReadonlySet<string> = new Set(Object.values(PIN_CODES));

export const isPinRefusalCode = (code: string | undefined): boolean => !!code && PIN_CODE_SET.has(code);

/** The refusal of a start, when it is about the PIN; null for anything else. */
export const pinRefusalOf = (payload: ThunkRejection | undefined): PinRefusal | null => {
  if (!payload) return null;
  switch (payload.code) {
    case PIN_CODES.required:
      return { kind: 'required' };
    case PIN_CODES.invalid: {
      const left = payload.extra?.attempts_left;
      return { kind: 'invalid', attemptsLeft: typeof left === 'number' && left >= 0 ? Math.floor(left) : null };
    }
    case PIN_CODES.locked: {
      const seconds = payload.extra?.retry_after ?? payload.retryAfter;
      return {
        kind: 'locked',
        retryAfterSeconds: typeof seconds === 'number' && seconds > 0 ? Math.ceil(seconds) : DEFAULT_PIN_LOCK_SECONDS,
      };
    }
    case PIN_CODES.blocked:
      return { kind: 'blocked' };
    default:
      return payload.kind === 'validation' && payload.fieldErrors?.pin ? { kind: 'malformed' } : null;
  }
};

/** "1:05" for a countdown. */
export const formatCountdown = (seconds: number): string => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
