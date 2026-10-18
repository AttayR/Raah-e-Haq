import { getLocale, type Locale } from './index';
import type { CopyTranslation } from './types';

/**
 * Feature copy objects (`FOO_COPY` in `src/features/x/copy.ts`) in the active language (T-523).
 *
 * `localizedCopy({...} as const)` returns a read-only view of the English object: every property
 * read returns the active language's string (or text function, or string list) when a
 * translation registered one, else the English value. Reads happen at render time, so screens
 * keep writing `FOO_COPY.title` and follow a language switch. The English object itself is never
 * changed. Translations live in `src/i18n/copy-ur-Latn/` and are registered at startup.
 */
type Translations = Partial<Record<Locale, unknown>>;

const roots = new WeakMap<object, Translations>();

const isPlainObject = (value: unknown): value is Record<PropertyKey, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const childOf = (node: unknown, key: string): unknown =>
  isPlainObject(node) && Object.prototype.hasOwnProperty.call(node, key) ? node[key] : undefined;

const sameKind = (override: unknown, base: unknown): boolean =>
  Array.isArray(base)
    ? Array.isArray(override) && override.every(item => typeof item === 'string')
    : typeof override === typeof base && !isPlainObject(override);

function view<T extends object>(base: T, translationNode: () => unknown): T {
  const children = new Map<string, unknown>();
  return new Proxy(base, {
    get(target, prop, receiver) {
      const value: unknown = Reflect.get(target, prop, receiver);
      if (typeof prop !== 'string') {
        return value;
      }
      if (isPlainObject(value)) {
        let child = children.get(prop);
        if (!child) {
          child = view(value, () => childOf(translationNode(), prop));
          children.set(prop, child);
        }
        return child;
      }
      if (getLocale() === 'en') {
        return value;
      }
      const override = childOf(translationNode(), prop);
      return override !== undefined && sameKind(override, value) ? override : value;
    },
  });
}

/** Wraps a feature's English copy object so it reads in the active language. */
export function localizedCopy<T extends object>(english: T): T {
  const translations: Translations = {};
  const localized = view(english, () => translations[getLocale()]);
  roots.set(localized, translations);
  return localized;
}

/** True for an object `localizedCopy` returned. */
export const isLocalizedCopy = (copy: object): boolean => roots.has(copy);

/** The translation registered for `copy` in `locale`, if any (the coverage test reads it). */
export const registeredTranslation = (copy: object, locale: Exclude<Locale, 'en'>): unknown =>
  roots.get(copy)?.[locale];

/**
 * Registers `locale`'s translation of a `localizedCopy` object (startup, `copy-ur-Latn/index.ts`).
 * Throws for a plain object: its strings could never switch language.
 */
export function registerCopyTranslation<T extends object>(
  copy: T,
  locale: Exclude<Locale, 'en'>,
  translation: CopyTranslation<T>,
): void {
  const translations = roots.get(copy);
  if (!translations) {
    throw new Error('registerCopyTranslation: the copy object is not wrapped in localizedCopy');
  }
  translations[locale] = translation;
}
