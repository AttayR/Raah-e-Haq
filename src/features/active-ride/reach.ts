/**
 * Request reach on Finding a driver (T-587, passenger-finding-driver.md § Request reach, BE-116):
 * `reach: {sent, viewing}` inside the passenger's own `GET /rides/{id}` while the ride is
 * `requested`, read on the existing ride poll (no request of its own). Counts only: no driver
 * identity. Women-mode requests carry null counts. Pure, unit tested in
 * `__tests__/features/activeRide/requestReach.test.tsx`.
 */
import { useRef } from 'react';
import { isRecord, readNumberOrNull } from '../../core/api/read';
import { t, type TranslationKey } from '../../i18n';
import type { RideResource } from '../../services/rideService';

export interface RequestReach {
  /** Drivers the request was shown to; null when the server hides the counts (women mode). */
  sent: number | null;
  /** Drivers looking at it now, never above `sent`; null with `sent`. */
  viewing: number | null;
}

const count = (value: unknown): number | null => {
  const n = readNumberOrNull(value);
  return n !== null && n >= 0 ? Math.floor(n) : null;
};

/** The ride's `reach`, or null when it carries none (an older server, or not `requested`). */
export const reachOf = (ride: RideResource | null | undefined): RequestReach | null => {
  const raw = ride?.reach;
  if (!isRecord(raw)) return null;
  const sent = count(raw.sent);
  if (sent === null) return { sent: null, viewing: null };
  const viewing = count(raw.viewing);
  // A race may return more viewing than sent: never show it above `sent`.
  return { sent, viewing: viewing === null ? 0 : Math.min(viewing, sent) };
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
  /** Only while someone is viewing. */
  viewing: CountText | null;
  /** The visible text (the strip's accessibility label). */
  label: string;
}

/** What the strip says for `reach`, in the active language (read at render). */
export const reachContent = (reach: RequestReach): ReachContent => {
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
