/**
 * Small readers for untyped JSON from the API. Mappers in src/features/<x>/api.ts use them so
 * a missing or mistyped field becomes a safe default instead of a crash in a screen.
 */

export type RawRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A positive integer id (numeric strings accepted); null otherwise. */
export const readId = (value: unknown): number | null => {
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
};

/** A non-empty string; null otherwise. */
export const readText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

/** A finite number (numeric strings accepted); null otherwise. */
export const readNumberOrNull = (value: unknown): number | null => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/** A finite number, or `fallback` (0). */
export const readNumber = (value: unknown, fallback = 0): number => readNumberOrNull(value) ?? fallback;

/** One of `allowed`, or `fallback`. */
export const readOneOf = <T extends string>(value: unknown, allowed: ReadonlyArray<T>, fallback: T): T =>
  allowed.find((item) => item === value) ?? fallback;
