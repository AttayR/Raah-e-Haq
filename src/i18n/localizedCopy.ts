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

type Root = { english: object; translations: Translations; fixed: Map<Locale, object> };

const roots = new WeakMap<object, Root>();

const isPlainObject = (value: unknown): value is Record<PropertyKey, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const childOf = (node: unknown, key: string): unknown =>
  isPlainObject(node) && Object.prototype.hasOwnProperty.call(node, key) ? node[key] : undefined;

const sameKind = (override: unknown, base: unknown): boolean =>
  Array.isArray(base)
    ? Array.isArray(override) && override.every(item => typeof item === 'string')
    : typeof override === typeof base && !isPlainObject(override);

function view<T extends object>(base: T, translationNode: () => unknown, locale: () => Locale): T {
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
          child = view(value, () => childOf(translationNode(), prop), locale);
          children.set(prop, child);
        }
        return child;
      }
      if (locale() === 'en') {
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
  const localized = view(english, () => translations[getLocale()], getLocale);
  roots.set(localized, { english, translations, fixed: new Map() });
  return localized;
}

/**
 * `copy` read in one given language, whatever the active one is (T-575): for comparing a text
 * that was stored before a language switch with the labels of every language. A plain object is
 * returned as it is.
 */
export function copyInLocale<T extends object>(copy: T, locale: Locale): T {
  const root = roots.get(copy);
  if (!root) {
    return copy;
  }
  let fixed = root.fixed.get(locale);
  if (!fixed) {
    fixed = view(root.english, () => root.translations[locale], () => locale);
    root.fixed.set(locale, fixed);
  }
  return fixed as T;
}

/** True for an object `localizedCopy` returned. */
export const isLocalizedCopy = (copy: object): boolean => roots.has(copy);

/** The translation registered for `copy` in `locale`, if any (the coverage test reads it). */
export const registeredTranslation = (copy: object, locale: Exclude<Locale, 'en'>): unknown =>
  roots.get(copy)?.translations[locale];

/**
 * Registers `locale`'s translation of a `localizedCopy` object (startup, `copy-ur-Latn/index.ts`).
 * Throws for a plain object: its strings could never switch language.
 */
export function registerCopyTranslation<T extends object>(
  copy: T,
  locale: Exclude<Locale, 'en'>,
  translation: CopyTranslation<T>,
): void {
  const root = roots.get(copy);
  if (!root) {
    throw new Error('registerCopyTranslation: the copy object is not wrapped in localizedCopy');
  }
  root.translations[locale] = translation;
}
