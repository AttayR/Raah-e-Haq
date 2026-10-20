/**
 * T-523 / T-575: the Roman Urdu dictionary covers `en.ts` key for key (the debug-only kit gallery
 * excepted), keeps every `{placeholder}`, and its feature copy translations only name keys that
 * exist in the English copy, with the same placeholders and function arity.
 */
import { en } from '../../src/i18n';
import { urLatn } from '../../src/i18n/ur-Latn';
import '../../src/i18n/copy-ur-Latn';
import { LOGIN_COPY } from '../../src/features/auth/copy/login';
import { PHONE_AUTH_COPY } from '../../src/features/auth/copy/phoneAuth';
import { REGISTRATION_COPY } from '../../src/features/auth/copy/registration';
import { REGISTRATION_FIELDS } from '../../src/features/auth/copy/registrationFields';
import { REGISTRATION_ERRORS } from '../../src/features/auth/copy/registrationErrors';
import { ACCOUNT_STATUS_COPY, ACCOUNT_STATUS_VARIANTS } from '../../src/features/auth/copy/accountStatus';
import { BOOKING_COPY } from '../../src/features/ride-booking/copy';
import { ACTIVE_RIDE_COPY } from '../../src/features/active-ride/copy';
import { DRIVER_REQUESTS_COPY } from '../../src/features/driver-requests/copy';
import { DRIVER_RIDE_COPY } from '../../src/features/driver-ride/copy';
import { DRIVER_STATUS_COPY } from '../../src/features/driver-status/copy';
import {
  SETTLEMENT_FORM_ERRORS,
  SETTLEMENT_KIND_LABEL,
  SETTLEMENT_METHOD_LABEL,
  SETTLEMENT_STATUS_LABEL,
  WALLET_COPY,
} from '../../src/features/wallet/copy';
import { PAYMENT_STATUS_LABEL, RIDE_HISTORY_COPY, RIDE_STATUS_LABEL, TIMELINE_LABEL, VEHICLE_LABEL } from '../../src/features/ride-history/copy';
import { NOTIFICATIONS_COPY } from '../../src/features/notifications/copy';
import { CHAT_COPY } from '../../src/features/chat/copy';
import { STATS_COPY } from '../../src/features/stats/copy';
import { DRIVER_PROFILE_COPY } from '../../src/features/driver-profile/copy';
import { DRIVER_DOCUMENTS_COPY } from '../../src/features/driverDocuments/copy';
import { DRIVER_HOME_COPY } from '../../src/components/driver/home/copy';
import { isLocalizedCopy, registeredTranslation } from '../../src/i18n/localizedCopy';
import { resetLanguagePreferenceForTests } from '../../src/i18n/languagePreference';
import { setLocale } from '../../src/i18n';

/** Sections of en.ts that stay English on purpose. */
const ENGLISH_ONLY_SECTIONS = ['kitGallery'];

type Leaf = { path: string; value: unknown };

const leavesOf = (node: unknown, prefix = ''): Leaf[] => {
  if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
    return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
      leavesOf(value, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [{ path: prefix, value: node }];
};

const valueAt = (node: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>(
    (at, part) => (at !== null && typeof at === 'object' ? (at as Record<string, unknown>)[part] : undefined),
    node,
  );

const placeholders = (text: string): string[] => (text.match(/\{\w+\}/g) ?? []).sort();

describe('Roman Urdu dictionary (en.ts)', () => {
  const english = leavesOf(en).filter(leaf => !ENGLISH_ONLY_SECTIONS.includes(leaf.path.split('.')[0]));
  const roman = leavesOf(urLatn);

  it('translates every English key (kit gallery excepted)', () => {
    const missing = english.filter(leaf => valueAt(urLatn, leaf.path) === undefined).map(leaf => leaf.path);
    // Lists any key a later task adds to en.ts without its Roman Urdu line.
    expect(missing).toEqual([]);
    expect(english.length).toBeGreaterThan(900);
  });

  it('has no key that en.ts lacks', () => {
    const orphans = roman.filter(leaf => valueAt(en, leaf.path) === undefined).map(leaf => leaf.path);
    expect(orphans).toEqual([]);
  });

  it('keeps every {placeholder} and the shape of every list', () => {
    const problems: string[] = [];
    for (const leaf of roman) {
      const base = valueAt(en, leaf.path);
      if (typeof base === 'string') {
        if (typeof leaf.value !== 'string') {
          problems.push(`${leaf.path}: not a string`);
        } else if (placeholders(base).join() !== placeholders(leaf.value).join()) {
          problems.push(`${leaf.path}: ${placeholders(leaf.value).join()} vs ${placeholders(base).join()}`);
        } else if (leaf.value.trim() === '') {
          problems.push(`${leaf.path}: empty`);
        }
      } else if (Array.isArray(base)) {
        if (!Array.isArray(leaf.value) || leaf.value.length !== base.length) {
          problems.push(`${leaf.path}: list length`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('keeps the currency label "Rs"', () => {
    expect(urLatn.format?.currencyPKR).toBe('Rs');
  });
});

const COPY_OBJECTS: Record<string, object> = {
  LOGIN_COPY,
  PHONE_AUTH_COPY,
  REGISTRATION_COPY,
  REGISTRATION_FIELDS,
  // T-575: validation messages and vehicle names.
  REGISTRATION_ERRORS,
  ACCOUNT_STATUS_VARIANTS,
  ACCOUNT_STATUS_COPY,
  BOOKING_COPY,
  ACTIVE_RIDE_COPY,
  DRIVER_REQUESTS_COPY,
  DRIVER_RIDE_COPY,
  DRIVER_STATUS_COPY,
  WALLET_COPY,
  SETTLEMENT_STATUS_LABEL,
  SETTLEMENT_METHOD_LABEL,
  SETTLEMENT_KIND_LABEL,
  SETTLEMENT_FORM_ERRORS,
  RIDE_HISTORY_COPY,
  RIDE_STATUS_LABEL,
  TIMELINE_LABEL,
  VEHICLE_LABEL,
  PAYMENT_STATUS_LABEL,
  NOTIFICATIONS_COPY,
  CHAT_COPY,
  STATS_COPY,
  DRIVER_PROFILE_COPY,
  DRIVER_DOCUMENTS_COPY,
  DRIVER_HOME_COPY,
};

/** Copy strings that read the same in Roman Urdu (brand, formats, shared English words). */
const SAME_IN_BOTH = new Set([
  'brandName',
  'emailPlaceholder',
  'cnicPlaceholder',
  'dobPlaceholder',
  'expiryPlaceholder',
  'icon',
  'tone',
  'canCheckStatus',
]);

describe('Roman Urdu feature copy (T-523)', () => {
  afterEach(() => resetLanguagePreferenceForTests());

  it.each(Object.entries(COPY_OBJECTS))('%s is localised and fully translated', (_name, copy) => {
    expect(isLocalizedCopy(copy)).toBe(true);
    const translation = registeredTranslation(copy, 'ur-Latn');
    const englishLeaves = leavesOf(copy);
    const problems: string[] = [];
    for (const leaf of englishLeaves) {
      const key = leaf.path.split('.').pop() ?? '';
      const roman = valueAt(translation, leaf.path);
      if (typeof leaf.value === 'string') {
        if (SAME_IN_BOTH.has(key)) continue;
        if (typeof roman !== 'string') {
          problems.push(`${leaf.path}: not translated`);
        } else if (placeholders(roman).join() !== placeholders(leaf.value).join()) {
          problems.push(`${leaf.path}: placeholders`);
        }
      } else if (typeof leaf.value === 'function') {
        if (typeof roman !== 'function') {
          problems.push(`${leaf.path}: not translated`);
        } else if (roman.length !== leaf.value.length) {
          problems.push(`${leaf.path}: arity`);
        }
      }
    }
    // A translated key the English copy lacks would never be read.
    for (const leaf of leavesOf(translation)) {
      if (valueAt(copy, leaf.path) === undefined) problems.push(`${leaf.path}: not in the English copy`);
    }
    expect(problems).toEqual([]);
  });

  it('reads the Roman Urdu copy only while Roman Urdu is active', () => {
    setLocale('en');
    expect(WALLET_COPY.retry).toBe('Try again');
    setLocale('ur-Latn');
    expect(WALLET_COPY.retry).toBe('Dobara koshish karein');
    expect(LOGIN_COPY.forgot.sentBody('a@b.pk')).toContain('a@b.pk');
    expect(ACCOUNT_STATUS_COPY.greeting('Ali')).toBe('Salaam Ali.');
    // Non-text fields of a translated object stay as written.
    expect(ACCOUNT_STATUS_VARIANTS.pendingDriver.icon).toBe('applicationReview');
    expect(ACCOUNT_STATUS_VARIANTS.pendingDriver.badge).toEqual({ icon: 'clock', tone: 'accent' });
  });
});
