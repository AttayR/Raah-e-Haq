import type { BookingPlace } from './buildRideRequest';
import { BOOKING_COPY, isCurrentLocationLabel } from './copy';
import { currentSessionEpoch } from '../../store/sessionEpoch';

/** How long a trip left on Back is offered again by "Where to?" (passenger-destination-search Interactions). */
export const BOOKING_DRAFT_TTL_MS = 10 * 60 * 1000;

/** The trip the passenger was planning: the chosen points and what their fields said. */
export interface BookingDraft {
  pickup: BookingPlace | null;
  destination: BookingPlace | null;
  stops: BookingPlace[];
  pickupQuery: string;
  destQuery: string;
}

/** `epoch`: the session it belongs to (sessionEpoch); another session's draft is never offered. */
type Stored = BookingDraft & { savedAt: number; epoch: number };

/**
 * UI-R9b: the booking draft lives in memory only (never sent to the server, never written to
 * storage): one trip, kept for 10 minutes, offered by the next "Where to?" and dropped at
 * sign-out. A pickup at the passenger's position ("Current location", or its address being looked
 * up) is not kept: the next booking starts from where they are then.
 */
let stored: Stored | null = null;

/** The pickup field says the pickup is the passenger's own position (or is looking it up). */
const atPosition = (text: string): boolean => isCurrentLocationLabel(text) || text === BOOKING_COPY.resolvingAddress;

/** The part of a booking worth offering again, or null when nothing was chosen. */
export const toBookingDraft = (draft: BookingDraft): BookingDraft | null => {
  const pickupAtPosition = atPosition(draft.pickupQuery) || !draft.pickup;
  const pickup = pickupAtPosition ? null : draft.pickup;
  if (!pickup && !draft.destination && draft.stops.length === 0) return null;
  return {
    pickup,
    destination: draft.destination,
    stops: [...draft.stops],
    pickupQuery: pickup ? draft.pickupQuery : '',
    destQuery: draft.destination ? draft.destQuery || draft.destination.address || '' : '',
  };
};

/**
 * Keeps the trip (or forgets the old one when nothing was chosen), for the session `epoch` it
 * was planned in (default: the current one).
 */
export const keepBookingDraft = (draft: BookingDraft, now: number = Date.now(), epoch: number = currentSessionEpoch()): void => {
  const kept = toBookingDraft(draft);
  stored = kept ? { ...kept, savedAt: now, epoch } : null;
};

/**
 * The kept trip while it is under 10 minutes old (an older one is dropped). Reading does not
 * clear it: the Booking screen it opens keeps (or clears) it again when it closes.
 */
export const takeBookingDraft = (now: number = Date.now()): BookingDraft | null => {
  const draft = stored;
  if (!draft) return null;
  if (draft.epoch !== currentSessionEpoch() || now - draft.savedAt > BOOKING_DRAFT_TTL_MS || now < draft.savedAt) {
    stored = null;
    return null;
  }
  return {
    pickup: draft.pickup,
    destination: draft.destination,
    stops: draft.stops,
    pickupQuery: draft.pickupQuery,
    destQuery: draft.destQuery,
  };
};

/** "Discard", a requested ride, sign-out: the trip is not offered again. */
export const clearBookingDraft = (): void => {
  stored = null;
};
