import type { Strings } from './en';

/** `en`'s literal types widened to plain strings, so another language can fill the same shape. */
export type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : T extends object
      ? { readonly [K in keyof T]: Widen<T[K]> }
      : T;

type DeepPartial<T> = T extends string
  ? T
  : T extends readonly unknown[]
    ? T
    : { readonly [K in keyof T]?: DeepPartial<T[K]> };

/**
 * A translation of `en.ts`: the same keys (an unknown key is a type error), every one optional at
 * type level so a key added to `en.ts` never breaks type-check; the key-coverage test
 * (`__tests__/i18n/romanUrdu.test.ts`) lists the ones a language still lacks, and `t()` falls back
 * to English for them.
 */
export type TranslationTable = DeepPartial<Widen<Strings>>;

/**
 * A translation of a feature copy object (`src/features/x/copy.ts`): any of its strings, string
 * lists or text-building functions (same parameters), nested the same way.
 */
export type CopyTranslation<T> = {
  readonly [K in keyof T]?: T[K] extends string
    ? string
    : T[K] extends (...args: infer A) => string
      ? (...args: A) => string
      : T[K] extends readonly string[]
        ? readonly string[]
        : T[K] extends object
          ? CopyTranslation<T[K]>
          : never;
};
