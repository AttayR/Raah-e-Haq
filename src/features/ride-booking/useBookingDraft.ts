import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { confirm } from '../../core/dialog';
import type { SearchDraft } from '../active-ride/components/FindingDriver';
import type { FareOffer } from '../fare/hooks';
import type { FareEstimates } from './api';
import { requestFareText } from './components/BookingChoices';
import { tripCardStops } from './components/BookingStages';
import { BOOKING_COPY } from './copy';
import { clearBookingDraft, keepBookingDraft } from './bookingDraftStore';
import { currentSessionEpoch, isStaleSession } from '../../store/sessionEpoch';
import { estimateFor } from './hooks';
import type { BookingFlow } from './useBookingFlow';
import type { VehicleOption } from './vehicleOptions';

type DraftOptions = {
  flow: Pick<BookingFlow, 'pickup' | 'destination' | 'stops' | 'pickupField' | 'destField' | 'selectedVehicle'>;
  options: ReadonlyArray<VehicleOption>;
  estimates: FareEstimates | null;
  offer: FareOffer;
};

/**
 * The booking as the passenger is about to send it (UI-R10): addresses, stops, the tier's server
 * name and the fare the Request button names. The finding-driver card shows it while POST /rides
 * is in flight, so the sheet never flashes empty between the tap and the created ride.
 */
export const useBookingDraft = ({ flow, options, estimates, offer }: DraftOptions): SearchDraft | null => {
  const { pickup, destination, stops, pickupField, destField, selectedVehicle } = flow;
  const pickupLabel = pickup?.address || pickupField.text;
  const dropoffLabel = destination?.address || destField.text;
  const option = options.find((o) => o.id === selectedVehicle) ?? null;
  const fare = requestFareText(estimateFor(estimates, selectedVehicle), offer);
  return useMemo(
    () =>
      pickupLabel && dropoffLabel
        ? {
            pickup: pickupLabel,
            dropoff: dropoffLabel,
            stops: tripCardStops(stops).map((s) => s.address),
            vehicleKey: selectedVehicle ?? null,
            vehicleName: option?.name ?? null,
            fare,
          }
        : null,
    [pickupLabel, dropoffLabel, stops, selectedVehicle, option?.name, fare],
  );
};

type LeaveOptions = {
  flow: Pick<BookingFlow, 'stepBack' | 'destination' | 'stops'>;
  rideShown: boolean;
  /** A request is being confirmed or sent: Back does nothing (UI-R10, no duplicate POST /rides). */
  blocked?: boolean;
  onLeave: () => void;
  /** UI-R9b: "Discard" was chosen: the trip is not kept for the next "Where to?". */
  onDiscard?: () => void;
};

/**
 * The booking map's Back (DS §12.5, UI-R10): one sheet state back; at the first state it leaves the
 * screen. With a trip planned (a destination or stops) and no ride yet it asks first: "Discard
 * this trip?" with "Keep editing" (the default) and "Discard" (passenger-vehicle-fare.md). It never
 * says "Cancel ride" before a ride exists. One question at a time.
 */
export const useDiscardOnLeave = ({ flow, rideShown, blocked = false, onLeave, onDiscard }: LeaveOptions): (() => void) => {
  const { stepBack, destination, stops } = flow;
  const asking = useRef(false);
  const hasDraft = !rideShown && (destination !== null || stops.length > 0);
  return useCallback(() => {
    if (blocked) return;
    if (stepBack()) return;
    if (!hasDraft) {
      onLeave();
      return;
    }
    if (asking.current) return;
    asking.current = true;
    confirm({
      title: BOOKING_COPY.discardTitle,
      body: BOOKING_COPY.discardBody,
      confirmLabel: BOOKING_COPY.discard,
      cancelLabel: BOOKING_COPY.keepEditing,
      destructive: true,
    })
      .then((yes) => {
        if (!yes) return;
        onDiscard?.();
        onLeave();
      })
      .finally(() => {
        asking.current = false;
      });
  }, [blocked, stepBack, hasDraft, onLeave, onDiscard]);
};

/**
 * Android hardware back on the booking map (UI-R10): always handled here, so it follows the same
 * rules as the on-screen Back (one state back, the discard question, held while a request is sent)
 * and, while finding a driver, opens the cancel-request dialog. Only while the screen is focused.
 */
export const useBookingHardwareBack = (enabled: boolean, onBack: () => void): void => {
  const handler = useRef(onBack);
  handler.current = onBack;
  useEffect(() => {
    if (!enabled) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handler.current();
      return true;
    });
    return () => sub.remove();
  }, [enabled]);
};

type KeepOptions = {
  flow: Pick<BookingFlow, 'pickup' | 'destination' | 'stops' | 'pickupField' | 'destField'>;
  rideShown: boolean;
};

/**
 * UI-R9b (passenger-destination-search Interactions): leaving Booking with a trip planned and no
 * ride (Back without the question, the iOS swipe, Android back at the start) keeps the trip in
 * the in-memory booking draft; Home's "Where to?" opens it again within 10 minutes. A ride on
 * screen, or "Discard" (the returned function), drops it. Local only: no request, no storage.
 */
export const useKeepBookingDraft = ({ flow, rideShown }: KeepOptions): (() => void) => {
  const latest = useRef({ flow, rideShown, discarded: false });
  latest.current = { flow, rideShown, discarded: latest.current.discarded };
  // Review (retry 1): a sign-out (401 included) clears the draft before Booking unmounts; the
  // trip of a session that has ended is never kept for the next user.
  const [mountEpoch] = useState(currentSessionEpoch);
  useEffect(() => {
    if (rideShown) clearBookingDraft();
  }, [rideShown]);
  useEffect(
    () => () => {
      const { flow: f, rideShown: shown, discarded } = latest.current;
      if (shown || discarded || isStaleSession(mountEpoch)) return;
      keepBookingDraft(
        {
        pickup: f.pickup,
        destination: f.destination,
        stops: f.stops,
        pickupQuery: f.pickupField.text,
        destQuery: f.destField.text,
        },
        Date.now(),
        mountEpoch,
      );
    },
    [mountEpoch],
  );
  return useCallback(() => {
    latest.current.discarded = true;
    clearBookingDraft();
  }, []);
};
