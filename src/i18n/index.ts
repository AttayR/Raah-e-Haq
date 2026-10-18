import { I18nManager } from 'react-native';
import { en, type Strings } from './en';
import { urLatn } from './ur-Latn';
import type { TranslationTable, Widen } from './types';

/**
 * i18n (DESIGN_SYSTEM §7, §12.8). English is the full table; other languages are partial tables
 * of the same shape (T-523: Roman Urdu first; Urdu script with RTL, `'ur'`, comes later as one
 * more table). `t('kitGallery.title')` is type-checked against `en.ts`, so a missing key fails
 * type-check; a key a translation lacks falls back to English.
 */
export type Locale = 'en' | 'ur-Latn';

/** Every language the app offers, in picker order. */
export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'ur-Latn'];

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);

const tables: Record<Locale, TranslationTable> = { en, 'ur-Latn': urLatn };

let activeLocale: Locale = 'en';
const listeners = new Set<() => void>();

/** Dot paths to every string leaf of the strings table (arrays excluded). */
type StringKeys<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : T[K] extends object
        ? StringKeys<T[K], `${Prefix}${K}.`>
        : never;
}[keyof T & string];

export type TranslationKey = StringKeys<Strings>;

export type TranslationParams = Record<string, string | number>;

const lookup = (table: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => {
    if (node !== null && typeof node === 'object' && part in node) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, table);

/** Fills `{name}` placeholders; unknown placeholders are left as written. */
export const interpolate = (template: string, params?: TranslationParams): string =>
  params
    ? template.replace(/\{(\w+)\}/g, (match, name: string) =>
        Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
      )
    : template;

/** The string for `key` in the active locale, falling back to English, then to the key itself. */
export function t(key: TranslationKey, params?: TranslationParams): string {
  const translated = lookup(tables[activeLocale], key);
  const value = typeof translated === 'string' ? translated : lookup(en, key);
  return interpolate(typeof value === 'string' ? value : key, params);
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** `base` with every leaf `overrides` has (of the same kind) replaced; arrays count as leaves. */
const mergeTable = (base: Record<string, unknown>, overrides: Record<string, unknown>): Record<string, unknown> => {
  const merged: Record<string, unknown> = {};
  for (const key of Object.keys(base)) {
    const value = base[key];
    const override = overrides[key];
    if (isPlainObject(value)) {
      merged[key] = isPlainObject(override) ? mergeTable(value, override) : value;
    } else if (Array.isArray(value)) {
      merged[key] = Array.isArray(override) && override.length === value.length ? override : value;
    } else {
      merged[key] = typeof override === typeof value ? override : value;
    }
  }
  return merged;
};

const mergedTables = new Map<Locale, Widen<Strings>>();

/** The whole active table (English where it has no entry), for non-string entries such as month names. */
export const strings = (): Widen<Strings> => {
  if (activeLocale === 'en') {
    return en;
  }
  let merged = mergedTables.get(activeLocale);
  if (!merged) {
    // mergeTable keeps en's exact shape, filling each leaf from the translation when it has one.
    merged = mergeTable(en, tables[activeLocale]) as Widen<Strings>;
    mergedTables.set(activeLocale, merged);
  }
  return merged;
};

export const getLocale = (): Locale => activeLocale;

/**
 * Switches the language for every later `t()` / copy read and tells subscribers (`useLocale`).
 * Persisting the choice is `changeLanguage` (languagePreference.ts); this only sets it.
 */
export const setLocale = (locale: Locale): void => {
  if (locale === activeLocale) {
    return;
  }
  activeLocale = locale;
  listeners.forEach(listener => listener());
};

/** Calls `listener` after every language change; returns the unsubscribe. */
export const subscribeLocale = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * A value built from copy (an option list, a status-to-label map) that is created once per
 * language, so a module-level list follows a language switch and keeps a stable identity
 * otherwise. Call the returned getter during render, not at module load.
 */
export function perLocale<T>(build: () => T): () => T {
  const built = new Map<Locale, { value: T }>();
  return () => {
    let entry = built.get(activeLocale);
    if (!entry) {
      entry = { value: build() };
      built.set(activeLocale, entry);
    }
    return entry.value;
  };
}

/** BCP 47 tag for `Intl` and time formatting (§2: 12-hour `en-PK`; Roman Urdu keeps Latin digits). */
export const localeTag = (): string => (activeLocale === 'en' || activeLocale === 'ur-Latn' ? 'en-PK' : activeLocale);

/**
 * The `Accept-Language` the API client sends (T-523), so the server can localise its messages
 * later; English is the fallback the server already speaks.
 */
export const acceptLanguage = (): string => (activeLocale === 'en' ? 'en' : `${activeLocale}, en;q=0.8`);

/** Layout direction; Urdu script will flip this through I18nManager (§12.8). Roman Urdu is LTR. */
export const isRTL = (): boolean => I18nManager.isRTL;

export { en };
export type { TranslationTable, Widen } from './types';
