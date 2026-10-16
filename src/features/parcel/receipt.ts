import { t, type TranslationKey } from '../../i18n';
import type { ParcelChoice, ParcelOptions, ParcelView } from './types';

/**
 * The parcel part of a ride receipt (T-559, BE-88), for the sender and the ride's driver: how it
 * ended (delivered, returned, refused at the pickup, cancelled) with the server's reason, the
 * parcel's steps with their times, and whether the pickup photo is shown or was already removed
 * (the signed URL is null after the retention scrub).
 */

export type ParcelOutcomeKind = 'delivered' | 'returned' | 'refused' | 'cancelled';

export interface ParcelOutcome {
  kind: ParcelOutcomeKind;
  title: string;
  /** The reason's label from GET /parcels/options (the key, readable, when the list lacks it). */
  reason: string | null;
}

const OUTCOME_TITLE: Record<ParcelOutcomeKind, TranslationKey> = {
  delivered: 'parcel.outcomeDelivered',
  returned: 'parcel.outcomeReturned',
  refused: 'parcel.outcomeRefused',
  cancelled: 'parcel.outcomeCancelled',
};

/** "receiver_unavailable" -> "Receiver unavailable" (only when the server's list has no label). */
const readableKey = (key: string): string => {
  const text = key.replace(/[_-]+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : key;
};

export const reasonLabel = (key: string | null, choices: ReadonlyArray<ParcelChoice> | undefined): string | null => {
  if (!key) return null;
  return choices?.find((c) => c.key === key)?.label ?? readableKey(key);
};

type ReasonLists = Pick<ParcelOptions, 'returnReasons' | 'refusalReasons'> | null | undefined;

/** How the parcel ended; null while it is still on its way. */
export const parcelOutcome = (
  parcel: Pick<ParcelView, 'status' | 'returnReason' | 'refusalReason'>,
  lists: ReasonLists,
): ParcelOutcome | null => {
  let kind: ParcelOutcomeKind;
  let reason: string | null = null;
  switch (parcel.status) {
    case 'delivered':
      kind = 'delivered';
      break;
    case 'returned':
      kind = 'returned';
      reason = reasonLabel(parcel.returnReason, lists?.returnReasons);
      break;
    case 'cancelled':
      kind = parcel.refusalReason ? 'refused' : 'cancelled';
      reason = reasonLabel(parcel.refusalReason, lists?.refusalReasons);
      break;
    default:
      return null;
  }
  return { kind, title: t(OUTCOME_TITLE[kind]), reason };
};

/** Whether the outcome needs the reason lists (a returned or refused parcel with a reason key). */
export const needsReasonLabels = (parcel: Pick<ParcelView, 'status' | 'returnReason' | 'refusalReason'> | null): boolean =>
  !!parcel &&
  ((parcel.status === 'returned' && !!parcel.returnReason) || (parcel.status === 'cancelled' && !!parcel.refusalReason));

/** The ride's own times the parcel steps use (from the ride receipt). */
export interface ParcelRideTimes {
  requestedAt: string | null;
  acceptedAt: string | null;
  arrivedAt: string | null;
  cancelledAt: string | null;
}

export interface ParcelReceiptStep {
  key: string;
  label: string;
  at: string;
}

/**
 * The parcel's steps that happened, in order, each with its time: booked, rider accepted, rider
 * at the pickup, picked up, return started, then delivered, returned or cancelled / refused.
 */
export const parcelReceiptSteps = (
  times: ParcelRideTimes,
  parcel: Pick<ParcelView, 'status' | 'pickedUpAt' | 'returnStartedAt' | 'deliveredAt' | 'returnedAt' | 'refusalReason'>,
): ParcelReceiptStep[] => {
  const refused = parcel.status === 'cancelled' && !!parcel.refusalReason;
  const steps: Array<[string, TranslationKey, string | null]> = [
    ['requested', 'parcel.stepBooked', times.requestedAt],
    ['accepted', 'parcel.stepAccepted', times.acceptedAt],
    ['arrived', 'parcel.stepArrived', times.arrivedAt],
    ['picked_up', 'parcel.stepPickedUp', parcel.pickedUpAt],
    ['return_started', 'parcel.stepReturnStarted', parcel.returnStartedAt],
    ['delivered', 'parcel.stepDelivered', parcel.status === 'delivered' ? parcel.deliveredAt : null],
    ['returned', 'parcel.stepReturned', parcel.status === 'returned' ? parcel.returnedAt : null],
    [refused ? 'refused' : 'cancelled', refused ? 'parcel.outcomeRefused' : 'parcel.outcomeCancelled', parcel.status === 'cancelled' ? times.cancelledAt : null],
  ];
  return steps.flatMap(([key, label, at]) => (at ? [{ key, label: t(label), at }] : []));
};

/**
 * The pickup photo on the receipt: `shown` (a signed URL), `removed` (the parcel was picked up
 * but the photo is gone after the retention period), or `none` (never taken: refused or
 * cancelled before the pickup).
 */
export const pickupPhotoState = (parcel: Pick<ParcelView, 'pickupPhotoUrl' | 'pickedUpAt' | 'status'>): 'shown' | 'removed' | 'none' => {
  if (parcel.pickupPhotoUrl) return 'shown';
  const pickedUp = !!parcel.pickedUpAt || parcel.status === 'delivered' || parcel.status === 'returned' || parcel.status === 'returning' || parcel.status === 'picked_up';
  return pickedUp ? 'removed' : 'none';
};
