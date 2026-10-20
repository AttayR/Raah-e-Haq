import type { BannerTone } from '../../components/ui';
import { formatMoney } from '../../core/format/money';
import { strings, t, type TranslationKey } from '../../i18n';
import { formatTime } from '../../utils/format';
import type { DeletionBlocker } from './api';

/**
 * Copy for the deletion screens (UI-R18 §D1): one line per known erase/keep key (unknown keys are
 * not shown, so the copy never promises more than the server does), the blocker Banners, the
 * reason chips, and the server's dates as text (never computed on the device).
 */

const ERASE_LINES: Readonly<Record<string, TranslationKey>> = {
  profile: 'accountDeletion.erase.profile',
  phone_email: 'accountDeletion.erase.phone_email',
  saved_places: 'accountDeletion.erase.saved_places',
  emergency_contacts: 'accountDeletion.erase.emergency_contacts',
  documents: 'accountDeletion.erase.documents',
  vehicle_photos: 'accountDeletion.erase.vehicle_photos',
  chats: 'accountDeletion.erase.chats',
  // `devices` and `notifications` are one line ("Notification settings and devices").
  devices: 'accountDeletion.erase.devices',
  notifications: 'accountDeletion.erase.devices',
};

const KEEP_LINES: Readonly<Record<string, TranslationKey>> = {
  trips: 'accountDeletion.keepItems.trips',
  payments: 'accountDeletion.keepItems.payments',
  safety_reports: 'accountDeletion.keepItems.safety_reports',
  support_requests: 'accountDeletion.keepItems.support_requests',
  ratings: 'accountDeletion.keepItems.ratings',
  device_checks: 'accountDeletion.keepItems.device_checks',
};

/** One entry per line: the first key that maps to it, and its text. */
export interface ConsequenceLine {
  key: string;
  text: string;
}

const linesOf = (keys: ReadonlyArray<string>, table: Readonly<Record<string, TranslationKey>>): ConsequenceLine[] => {
  const seen = new Set<TranslationKey>();
  const lines: ConsequenceLine[] = [];
  keys.forEach((key) => {
    const copy = table[key];
    if (!copy || seen.has(copy)) return;
    seen.add(copy);
    lines.push({ key, text: t(copy) });
  });
  return lines;
};

export const eraseLines = (keys: ReadonlyArray<string>): ConsequenceLine[] => linesOf(keys, ERASE_LINES);
export const keepLines = (keys: ReadonlyArray<string>): ConsequenceLine[] => linesOf(keys, KEEP_LINES);

const REASON_LABELS: Readonly<Record<string, TranslationKey>> = {
  not_using: 'accountDeletion.reasons.not_using',
  too_expensive: 'accountDeletion.reasons.too_expensive',
  safety: 'accountDeletion.reasons.safety',
  privacy: 'accountDeletion.reasons.privacy',
  other_app: 'accountDeletion.reasons.other_app',
  other: 'accountDeletion.reasons.other',
};

export const KNOWN_REASONS = Object.keys(REASON_LABELS);

/** The reason chips: the server's slugs the app has copy for (all known ones when it sends none). */
export const reasonOptions = (serverReasons: ReadonlyArray<string>): Array<{ slug: string; label: string }> =>
  (serverReasons.length > 0 ? serverReasons : KNOWN_REASONS)
    .filter((slug) => REASON_LABELS[slug] !== undefined)
    .map((slug) => ({ slug, label: t(REASON_LABELS[slug]) }));

const toDate = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

const NBSP = '\u00A0';

/**
 * A value that must not wrap mid-unit inside a sentence ("+92 3•• •••• 099", "19 Nov 2026",
 * "3:40 PM"): its spaces become no-break spaces (U+00A0), so the line breaks around it instead.
 */
export const keepTogether = (value: string): string => value.replace(/ /g, NBSP);

/**
 * The server's date as "19 Nov 2026" (always with the year: it is a deadline), with no-break
 * spaces so it never splits across lines (D1, D2 Dialog, the toast, D4). '' when unknown.
 */
export const formatDeletionDate = (iso: string | null | undefined): string => {
  const d = toDate(iso);
  if (!d) return '';
  return keepTogether(`${d.getDate()} ${strings().format.monthsShort[d.getMonth()]} ${d.getFullYear()}`);
};

/** "3:40 PM" on the same day, else "21 Oct 2026, 3:40 PM" (BE-135 `retry_after_at`). */
export const formatRetryAt = (iso: string, now: Date = new Date()): string => {
  const d = toDate(iso);
  if (!d) return '';
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? keepTogether(formatTime(d)) : `${formatDeletionDate(iso)}, ${keepTogether(formatTime(d))}`;
};

/** A wait in seconds as "m:ss", or "{n} hours" from an hour on (daily SMS limits). */
export const formatWait = (seconds: number): string => {
  const s = Math.max(0, Math.ceil(seconds));
  if (s >= 3600) return t('accountDeletion.waitHours', { n: Math.ceil(s / 3600) });
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export type BlockerAction = 'goToRide' | 'payNow' | 'verifyPhone';

export interface BlockerView {
  tone: BannerTone;
  text: string;
  action: { kind: BlockerAction; label: string } | null;
}

/** §D1.2: one Banner per blocker; TOPUP_PENDING and unknown blockers carry no action. */
export const blockerView = (blocker: DeletionBlocker, now: Date = new Date()): BlockerView => {
  switch (blocker.code) {
    case 'ACTIVE_RIDE':
      return {
        tone: 'danger',
        text: t('accountDeletion.blockerActiveRide'),
        action: { kind: 'goToRide', label: t('accountDeletion.blockerGoToRide') },
      };
    case 'COMMISSION_OWED':
      return {
        tone: 'warning',
        text: t('accountDeletion.blockerOwed', { amount: formatMoney(blocker.amount, { currency: blocker.currency }) }),
        action: { kind: 'payNow', label: t('accountDeletion.blockerPayNow') },
      };
    case 'PHONE_NOT_VERIFIED':
      return {
        tone: 'warning',
        text: t('accountDeletion.blockerPhone'),
        action: { kind: 'verifyPhone', label: t('accountDeletion.blockerVerifyPhone') },
      };
    case 'TOPUP_PENDING': {
      const when = blocker.retryAfterAt ? formatRetryAt(blocker.retryAfterAt, now) : '';
      return {
        tone: 'warning',
        text: when ? t('accountDeletion.blockerTopUpLate', { when }) : t('accountDeletion.blockerTopUp'),
        action: null,
      };
    }
    default:
      return { tone: 'danger', text: t('accountDeletion.blockerOther'), action: null };
  }
};

/**
 * "Pay now" for COMMISSION_OWED, chosen by the server's `pay_with`: a driver who may also report a
 * payment (`settlement`) goes to Pay commission; otherwise Add money with the amount filled in.
 */
export const payNowTarget = (
  blocker: Extract<DeletionBlocker, { code: 'COMMISSION_OWED' }>,
  isDriver: boolean,
): { route: 'PayCommission'; params: { owed: number; currency: string } } | { route: 'AddMoney'; params: { amount: number } | undefined } =>
  isDriver && blocker.payWith.includes('settlement')
    ? { route: 'PayCommission', params: { owed: blocker.amount, currency: blocker.currency ?? 'PKR' } }
    : { route: 'AddMoney', params: blocker.amount > 0 ? { amount: blocker.amount } : undefined };
