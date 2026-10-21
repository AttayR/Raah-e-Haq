import { useCallback, useEffect, useRef, useState } from 'react';
import type { RideRequest, RideResource } from '../../services/rideService';
import { createClientId } from '../chat/clientId';
import { rebookRequestFor } from './lastBooking';
import { bookingCooldownSeconds } from '../ride-booking/bookingCooldown';

/**
 * "Try again" on the "No driver found" state (BE-114, T-583): the same trip is booked again as a
 * new attempt, with a new Idempotency-Key. While it is sent the button shows its loading state and
 * a second tap sends nothing; a refusal is shown by `requestRide` (the outcome stays on screen, so
 * the passenger can try again or close). The new ride replaces the expired one in the store.
 * Without a body to send (a parcel restored after a relaunch: the receiver's number is not on
 * the ride) `onNothingToSend` runs instead, e.g. to open the parcel form. While a
 * BOOKING_COOLDOWN hold runs nothing is sent (NoDriverActions shows the countdown).
 */
export const useNoDriverRetry = (
  ride: RideResource | null,
  requestRide: (request: RideRequest, idempotencyKey?: string) => Promise<unknown>,
  onNothingToSend: () => void,
): { retry: () => void; retrying: boolean } => {
  const [retrying, setRetrying] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const latest = useRef({ ride, requestRide, onNothingToSend });
  latest.current = { ride, requestRide, onNothingToSend };

  const retry = useCallback(() => {
    const current = latest.current;
    // BOOKING_COOLDOWN: the button is disabled meanwhile; a tap that still lands sends nothing.
    if (!current.ride || inFlight.current || bookingCooldownSeconds() > 0) return;
    const request = rebookRequestFor(current.ride);
    if (!request) {
      current.onNothingToSend();
      return;
    }
    inFlight.current = true;
    setRetrying(true);
    current
      .requestRide(request, createClientId())
      .catch(() => undefined) // Already shown by requestRide.
      .finally(() => {
        inFlight.current = false;
        if (mounted.current) setRetrying(false);
      });
  }, []);

  return { retry, retrying };
};
