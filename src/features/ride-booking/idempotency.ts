import { useState } from 'react';
import { createClientId } from '../chat/clientId';
import { jsonEqual } from '../../core/jsonEqual';
import type { RideRequest } from '../../services/rideService';

/**
 * The Idempotency-Key of one booking attempt (BE-113, T-583). Each Confirm press is a new attempt
 * with a fresh key, except when the previous attempt got no answer (network error, timeout) and
 * the same booking is sent again: the server may have created that ride already, so the retry
 * keeps the key and the server answers with the ride it made (200 Idempotent-Replayed) instead of
 * a second one. Any answer from the server (a ride or a refusal) ends the attempt.
 */
export interface BookingAttemptKeys {
  /** The key to send `request` with. */
  keyFor: (request: RideRequest) => string;
  /** The attempt ended: `uncertain` when no answer came back (keep the key for the same body). */
  settle: (uncertain: boolean) => void;
}

export const createBookingAttemptKeys = (newKey: () => string = createClientId): BookingAttemptKeys => {
  let current: { key: string; request: RideRequest } | null = null;
  let open: { key: string; request: RideRequest } | null = null;
  return {
    keyFor: (request) => {
      current = open && jsonEqual(open.request, request) ? open : { key: newKey(), request };
      open = null;
      return current.key;
    },
    settle: (uncertain) => {
      open = uncertain ? current : null;
      current = null;
    },
  };
};

/** One `BookingAttemptKeys` per mounted booking form. */
export const useBookingAttemptKeys = (): BookingAttemptKeys => useState(() => createBookingAttemptKeys())[0];
