import { firstFieldMessages, type ThunkRejection } from '../../core/api/errors';
import { LOGIN_COPY } from './copy/login';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 6;

export const isValidEmail = (value: string): boolean => EMAIL_PATTERN.test(value);

export type LoginFieldErrors = { email?: string; password?: string };

/**
 * Client checks before sign-in (spec auth-login). The email is trimmed; the password is checked
 * exactly as typed, since spaces can be part of it (T-204, AUTH-14).
 */
export function validateLogin(email: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {};
  const trimmed = email.trim();
  if (!trimmed) {
    errors.email = LOGIN_COPY.validation.emailRequired;
  } else if (!isValidEmail(trimmed)) {
    errors.email = LOGIN_COPY.validation.emailInvalid;
  }
  if (!password) {
    errors.password = LOGIN_COPY.validation.passwordRequired;
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = LOGIN_COPY.validation.passwordShort;
  }
  return errors;
}

/**
 * Where a refused sign-in is shown (T-603 "pick one", QA T-104 "error below the fold"): wrong
 * credentials (401) and validation (422) go inline, next to the fields — the server's per-field
 * messages, or its message under the password. Everything else (403 account refusal with its
 * reason, network, rate limit, server) is a toast, and returns null here.
 */
export function inlineLoginErrors(rejection: ThunkRejection | undefined, fallback: string): LoginFieldErrors | null {
  if (!rejection || (rejection.kind !== 'auth' && rejection.kind !== 'validation')) {
    return null;
  }
  const fields = firstFieldMessages(rejection.fieldErrors);
  if (fields.email || fields.password) {
    return { email: fields.email, password: fields.password };
  }
  return { password: rejection.message || fallback };
}
