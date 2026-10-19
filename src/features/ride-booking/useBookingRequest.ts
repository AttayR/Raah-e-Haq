import { useCallback, useRef, useState } from 'react';
import { createClientId } from '../chat/clientId';
import type { RideRequest } from '../../services/rideService';
import { reverseGeocode } from '../../services/placesService';
import { RideRequestRefused } from '../active-ride/hooks';
import type { FareOffer } from '../fare/hooks';
import { buildRideRequest, withAddresses, type BookingPlace } from './buildRideRequest';
import { useConfirmRequest } from './useConfirmRequest';
import type { BookingFlow } from './useBookingFlow';
import { saveLastVehicle } from './vehicleSelection';

type Options = {
  flow: Pick<BookingFlow, 'pickup' | 'destination' | 'stops' | 'selectedVehicle' | 'femaleDriverOnly' | 'setError' | 'setStage'>;
  offer: FareOffer;
  /** POST /rides through the active-ride actions (it shows the server's message on a refusal). */
  requestRide: (request: RideRequest, idempotencyKey?: string) => Promise<unknown>;
};

/**
 * The choose-ride sheet's Request (moved out of PassengerMapScreen in UI-R10). T-574: the button
 * shows its loading state on the tap and the sheet moves to finding a driver at once; the request
 * starts two frames later. A refusal goes back to the choose-ride sheet (an offer outside the band
 * moves the stepper into the server's band, BE-83). The requested tier is remembered as the next
 * booking's default.
 *
 * One request at a time: while a request is being confirmed or sent, another confirm sends
 * nothing (`busy` lets the screen hold Back and the footer too). Each confirm gets its own
 * Idempotency-Key (BE-113), so a repeat of the same attempt can be recognised by the server.
 */
export const useBookingRequest = ({ flow, offer, requestRide }: Options) => {
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  const { pickup, destination, stops, selectedVehicle, femaleDriverOnly, setError, setStage } = flow;

  const send = useCallback(async (idempotencyKey: string) => {
    inFlight.current = true;
    setSending(true);
    setError(null);
    try {
      // Map-tapped points have no address yet: geocode them (or use their coordinates).
      const [p, d, ...st] = await withAddresses([pickup, destination, ...stops], reverseGeocode);
      const built = buildRideRequest({
        pickup: p,
        dropoff: d,
        stops: st.filter((x): x is BookingPlace => x !== null),
        vehicleType: selectedVehicle,
        offeredFare: offer.offeredFare,
        femaleDriverOnly,
      });
      if (!built.ok) {
        setError(built.error);
        setStage('vehicle');
        return;
      }
      await requestRide(built.request, idempotencyKey);
      saveLastVehicle(selectedVehicle);
      setStage('requesting');
    } catch (refusal) {
      if (refusal instanceof RideRequestRefused && refusal.failure.kind === 'offer_out_of_band') offer.applyBand(refusal.failure.band);
      setStage('vehicle');
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }, [pickup, destination, stops, selectedVehicle, femaleDriverOnly, requestRide, offer, setError, setStage]);

  const confirmRequest = useConfirmRequest(() => {
    if (inFlight.current) return;
    send(createClientId());
    setStage('requesting');
  });
  const { confirm: confirmTap, confirming } = confirmRequest;
  const confirm = useCallback(() => {
    if (!inFlight.current) confirmTap();
  }, [confirmTap]);

  return { sending, confirming, busy: sending || confirming, confirm };
};
