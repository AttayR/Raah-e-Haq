/**
 * Redacting logger.
 *
 * - `debug`, `info` and `warn` print only in development (`__DEV__`).
 * - `error` always prints, so release builds keep a trace of real failures.
 * - Every argument is passed through `redact()` first: values under keys that look like
 *   credentials or PII (password, token, otp, cnic, phone, email, account, address, licence,
 *   plate, uid, api key, fcm ...) are replaced with `[REDACTED]`, in nested objects and arrays too.
 * - `error` is the only level that prints in release, so it uses a stricter set that also
 *   redacts names and coordinates (lat, lng, location, coords).
 * - Strings have `key=` / `token=` style query values masked, so a logged URL never carries
 *   an API key.
 *
 * Redaction is by key. A sensitive value passed as a bare positional argument
 * (`logger.debug('phone', user.phone)`) cannot be detected, so never do that.
 */

export const REDACTED = '[REDACTED]';

const SENSITIVE_KEY =
  /password|passwd|secret|token|otp|cnic|phone|email|account|iban|authorization|cookie|fcm|emergency|contact|bank|verification|address|license|plate|api_?key|uid/i;

/** Extra keys redacted on the error path, the only one that prints in release builds. */
const STRICT_EXTRA_KEY = /lat|lng|latitude|longitude|location|coords|name/i;

const SECRET_QUERY_PARAM = /([?&](?:key|api_?key|token|access_token|otp)=)[^&#\s]*/gi;

const MAX_DEPTH = 6;

export function isSensitiveKey(key: string, strict = false): boolean {
  return SENSITIVE_KEY.test(key) || (strict && STRICT_EXTRA_KEY.test(key));
}

interface RedactContext {
  seen: WeakSet<object>;
  strict: boolean;
}

interface AxiosLikeError extends Error {
  isAxiosError: true;
  code?: string;
  config?: {method?: string; url?: string};
  response?: {status?: number; data?: unknown};
}

function isAxiosLikeError(value: object): value is AxiosLikeError {
  return value instanceof Error && (value as Partial<AxiosLikeError>).isAxiosError === true;
}

function redactValue(value: unknown, depth: number, ctx: RedactContext): unknown {
  if (typeof value === 'string') {
    return value.replace(SECRET_QUERY_PARAM, `$1${REDACTED}`);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (ctx.seen.has(value)) {
    return '[Circular]';
  }
  if (depth >= MAX_DEPTH) {
    return '[Truncated]';
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
  }
  // `seen` holds only the current ancestors, so a shared (non-circular) reference is
  // still printed in full.
  ctx.seen.add(value);
  try {
    return redactObject(value, depth, ctx);
  } finally {
    ctx.seen.delete(value);
  }
}

function redactObject(value: object, depth: number, ctx: RedactContext): unknown {
  if (Array.isArray(value)) {
    return value.map(item => redactValue(item, depth + 1, ctx));
  }

  if (isAxiosLikeError(value)) {
    // The raw request config holds the Authorization header and the request body as an
    // unparsed JSON string (passwords, OTPs), so only a safe summary is kept.
    return {
      name: value.name,
      message: redactValue(value.message, depth + 1, ctx),
      code: value.code,
      method: value.config?.method,
      url: redactValue(value.config?.url, depth + 1, ctx),
      status: value.response?.status,
      responseData: redactValue(value.response?.data, depth + 1, ctx),
    };
  }

  const out: Record<string, unknown> = {};
  if (value instanceof Error) {
    out.name = value.name;
    out.message = redactValue(value.message, depth + 1, ctx);
    if (value.stack) {
      out.stack = value.stack;
    }
  }
  for (const key of Object.keys(value)) {
    if (isSensitiveKey(key, ctx.strict)) {
      out[key] = REDACTED;
      continue;
    }
    try {
      out[key] = redactValue((value as Record<string, unknown>)[key], depth + 1, ctx);
    } catch {
      // A throwing getter must never make the logger itself throw.
      out[key] = '[Unreadable]';
    }
  }
  return out;
}

/**
 * Returns a deep copy of `value` with sensitive keys replaced by `[REDACTED]`.
 * `strict` also redacts names and coordinates (used for `logger.error`).
 */
export function redact(value: unknown, strict = false): unknown {
  return redactValue(value, 0, {seen: new WeakSet(), strict});
}

type LogMethod = (...args: unknown[]) => void;

function isDev(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function emit(level: 'log' | 'info' | 'warn' | 'error', args: unknown[]): void {
  // The logger is the only module that should call console directly.
  const strict = level === 'error';
  console[level](...args.map(arg => redact(arg, strict)));
}

export const logger: {
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
} = {
  debug: (...args) => {
    if (isDev()) {
      emit('log', args);
    }
  },
  info: (...args) => {
    if (isDev()) {
      emit('info', args);
    }
  },
  warn: (...args) => {
    if (isDev()) {
      emit('warn', args);
    }
  },
  error: (...args) => {
    emit('error', args);
  },
};

export default logger;
