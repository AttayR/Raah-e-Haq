/**
 * Request reach on Finding a driver (T-587, passenger-finding-driver.md § Request reach, BE-116):
 * `reach: {sent, viewing}` inside the passenger's own `GET /rides/{id}` while the ride is
 * `requested`, read on the existing ride poll (no request of its own). No driver identity.
 * Women-mode requests carry null counts. Pure, unit tested in
 * `__tests__/features/activeRide/requestReach.test.tsx`.
 *
 * BE-119 (SEC-32, Phase 2 map rings): `sent_ids` / `viewing_ids` are public marker ids of the
 * passenger's own latest nearby answer (fine markers only), valid only for the answer whose
 * `meta.fine_epoch` equals `reach.epoch` (`reachMarksFor`). Women mode: no ids, null epoch.
 * There is never a declined count or id (`viewing` also counts drivers who opened and declined).
 */
import { useRef } from 'react';
import { isRecord, readNumberOrNull } from '../../core/api/read';
import { t, type TranslationKey } from '../../i18n';
import type { RideResource } from '../../services/rideService';

export interface RequestReach {
  /** Drivers the request was shown to; null when the server hides the counts (women mode). */
  sent: number | null;
  /**
   * Drivers who opened the offer (BE-119: declines included, so it never drops), never above
   * `sent`; null with `sent`.
   */
  viewing: number | null;
  /** BE-119: fine nearby marker ids the request was sent to (empty in women mode or on an older server). */
  sentIds: string[];
  /** BE-119: fine nearby marker ids whose driver opened the offer (declined included). */
  viewingIds: string[];
  /** BE-119: the nearby answer (`meta.fine_epoch`) the ids belong to; null when none. */
  epoch: string | null;
}

const count = (value: unknown): number | null => {
  const n = readNumberOrNull(value);
  return n !== null && n >= 0 ? Math.floor(n) : null;
};

const MAX_IDS = 50;

const ids = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string' && v !== ''))].slice(0, MAX_IDS) : [];

/** The ride's `reach`, or null when it carries none (an older server, or not `requested`). */
export const reachOf = (ride: RideResource | null | undefined): RequestReach | null => {
  const raw = ride?.reach;
  if (!isRecord(raw)) return null;
  const sent = count(raw.sent);
  // Women mode (null counts): no ids and no epoch, whatever else the body carries.
  if (sent === null) return { sent: null, viewing: null, sentIds: [], viewingIds: [], epoch: null };
  const viewing = count(raw.viewing);
  const epoch = typeof raw.epoch === 'string' && raw.epoch !== '' ? raw.epoch : null;
  return {
    sent,
    // A race may return more viewing than sent: never show it above `sent`.
    viewing: viewing === null ? 0 : Math.min(viewing, sent),
    sentIds: epoch ? ids(raw.sent_ids) : [],
    viewingIds: epoch ? ids(raw.viewing_ids) : [],
    epoch,
  };
};

/** Which drawn nearby markers the request reached (BE-119), by public marker id. */
export interface ReachMarks {
  sent: ReadonlySet<string>;
  viewing: ReadonlySet<string>;
}

/**
 * The marks to draw on the nearby answer whose `meta.fine_epoch` is `fineEpoch`, or null (draw
 * nothing): no reach, women mode, no ids, or the ids belong to another answer than the one drawn
 * (a newer or older nearby read). Pure.
 */
export const reachMarksFor = (reach: RequestReach | null, fineEpoch: string | null | undefined): ReachMarks | null => {
  if (!reach || reach.sent === null || !reach.epoch || !fineEpoch || reach.epoch !== fineEpoch) return null;
  if (reach.sentIds.length === 0 && reach.viewingIds.length === 0) return null;
  // A viewing driver was sent the request, even if a race left it out of `sent_ids`.
  return { sent: new Set([...reach.sentIds, ...reach.viewingIds]), viewing: new Set(reach.viewingIds) };
};

/** A template split round its `{n}`, so the number can crossfade on its own. */
export interface CountText {
  before: string;
  n: number;
  after: string;
}

const splitCount = (key: TranslationKey, n: number): CountText => {
  const template = t(key);
  const at = template.indexOf('{n}');
  return at < 0 ? { before: template, n, after: '' } : { before: template.slice(0, at), n, after: template.slice(at + 3) };
};

const joined = (part: CountText): string => `${part.before}${part.n}${part.after}`;

export interface ReachContent {
  /** "Sending to drivers nearby…" when nothing was sent yet (or the counts are hidden). */
  sending: string | null;
  sent: CountText | null;
  /** Only once a driver opened the offer. */
  viewing: CountText | null;
  /** The visible text (the strip's accessibility label). */
  label: string;
}

/** What the strip says for `reach`, in the active language (read at render). */
export const reachContent = (reach: Pick<RequestReach, 'sent' | 'viewing'>): ReachContent => {
  if (reach.sent === null || reach.sent === 0) {
    const sending = t('rideReach.sending');
    return { sending, sent: null, viewing: null, label: sending };
  }
  const sent = splitCount(reach.sent === 1 ? 'rideReach.sentOne' : 'rideReach.sent', reach.sent);
  const m = reach.viewing ?? 0;
  const viewing = m > 0 ? splitCount(m === 1 ? 'rideReach.viewingOne' : 'rideReach.viewing', m) : null;
  return { sending: null, sent, viewing, label: viewing ? `${joined(sent)} · ${joined(viewing)}` : joined(sent) };
};

/** Said once when `sent` first becomes > 0, and once when `viewing` first does. */
export const reachAnnouncement = (kind: 'sent' | 'viewing', n: number): string =>
  kind === 'sent'
    ? n === 1 ? t('rideReach.announceSentOne') : t('rideReach.announceSent', { n })
    : n === 1 ? t('rideReach.announceViewingOne') : t('rideReach.announceViewing', { n });

/**
 * The reach to show for the searched ride: the latest the poll carried, else the last one this
 * search round had (a reply without it, or a failed poll, keeps the value), else null (the strip
 * stays hidden: the title already says we are looking). A re-queue (T-546) starts a new round
 * with the server's new counts.
 */
export const useRequestReach = (ride: RideResource | null, searching: boolean): RequestReach | null => {
  const last = useRef<{ round: string; reach: RequestReach } | null>(null);
  if (!ride || !searching) return null;
  const round = `${ride.id}:${ride.requeue_count ?? 0}`;
  const current = reachOf(ride);
  if (current) last.current = { round, reach: current };
  return current ?? (last.current?.round === round ? last.current.reach : null);
};
