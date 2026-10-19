import { toApiError } from '../../core/api/errors';
import { logger } from '../../core/logging/logger';
import { currentSessionEpoch, isStaleSession, onSessionEpochChange } from '../../store/sessionEpoch';
import { autoAcceptApi } from './api';

/**
 * Offer reporting for request reach (T-587, BE-116; map-vehicles.md §7.4): the passenger's
 * "Sent to N drivers · M viewing" counts come from these.
 *
 * - `reportOfferViewed`: once per ride per app run, when the request card has been on screen
 *   for OFFER_VIEWED_DELAY_MS (the caller times it).
 * - `reportOfferDeclined`: once per ride, when the driver turns the request down.
 *
 * Both are fire-and-forget and never block or change the card. A 404 OFFER_NOT_FOUND (the ride
 * was taken, cancelled or never served to this driver) and any other 4xx (429 included) are
 * dropped silently. A network error, timeout or 5xx is retried once after OFFER_RETRY_DELAY_MS,
 * never in a loop.
 */
export const OFFER_VIEWED_DELAY_MS = 1_000;
export const OFFER_RETRY_DELAY_MS = 3_000;
/** Ride ids remembered per kind; the oldest are forgotten first (a long online session). */
const MAX_REMEMBERED = 200;

type OfferReportKind = 'viewed' | 'declined';

const reported: Record<OfferReportKind, Set<number>> = { viewed: new Set(), declined: new Set() };

const remember = (kind: OfferReportKind, rideId: number): boolean => {
  const set = reported[kind];
  if (set.has(rideId)) return false;
  set.add(rideId);
  if (set.size > MAX_REMEMBERED) {
    const oldest = set.values().next().value;
    if (oldest !== undefined) set.delete(oldest);
  }
  return true;
};

/** Worth one more try: the request may not have reached the server. */
const isRetryable = (error: unknown): boolean => {
  const { kind } = toApiError(error);
  return kind === 'network' || kind === 'timeout' || kind === 'server';
};

const send = (kind: OfferReportKind, rideId: number, attempt: number): void => {
  const call = kind === 'viewed' ? autoAcceptApi.offerViewed : autoAcceptApi.offerDeclined;
  // The retry belongs to this session: after a sign-out it would go out with the next
  // driver's token (or none).
  const startedIn = currentSessionEpoch();
  call(rideId).catch((error: unknown) => {
    if (attempt === 0 && isRetryable(error) && !isStaleSession(startedIn)) {
      setTimeout(() => {
        if (!isStaleSession(startedIn)) send(kind, rideId, 1);
      }, OFFER_RETRY_DELAY_MS);
      return;
    }
    logger.debug('offer report dropped', { kind, error: toApiError(error).kind });
  });
};

export const reportOfferViewed = (rideId: number): void => {
  if (remember('viewed', rideId)) send('viewed', rideId, 0);
};

export const reportOfferDeclined = (rideId: number): void => {
  if (remember('declined', rideId)) send('declined', rideId, 0);
};

const forgetAll = (): void => {
  reported.viewed.clear();
  reported.declined.clear();
};

// A new session (another driver on this phone) starts with nothing reported.
onSessionEpochChange(forgetAll);

/** Tests only. */
export const __resetOfferReportsForTests = forgetAll;
