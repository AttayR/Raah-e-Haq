import { I18nManager } from 'react-native';
import { en, type Strings } from './en';

/**
 * Minimal i18n scaffold (DESIGN_SYSTEM §7, §12.8). English only today; Urdu plugs in as another
 * table of the same shape. `t('kitGallery.title')` is type-checked against `en.ts`, so a missing
 * key fails type-check.
 */
export type Locale = 'en';

const tables: Record<Locale, Strings> = { en };

let activeLocale: Locale = 'en';

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

const lookup = (table: Strings, key: string): unknown =>
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
  const value = lookup(tables[activeLocale], key) ?? lookup(en, key);
  return interpolate(typeof value === 'string' ? value : key, params);
}

/** The whole active table, for non-string entries such as month names. */
export const strings = (): Strings => tables[activeLocale];

export const getLocale = (): Locale => activeLocale;

export const setLocale = (locale: Locale): void => {
  activeLocale = locale;
};

/** BCP 47 tag for `Intl` and time formatting (§2: 12-hour `en-PK`). */
export const localeTag = (): string => (activeLocale === 'en' ? 'en-PK' : activeLocale);

/** Layout direction; Urdu will flip this through I18nManager (§12.8). */
export const isRTL = (): boolean => I18nManager.isRTL;

export { en };
