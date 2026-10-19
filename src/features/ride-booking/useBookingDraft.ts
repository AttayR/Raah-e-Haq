import { useCallback, useEffect, useMemo, useRef } from 'react';
import { BackHandler } from 'react-native';
import { confirm } from '../../core/dialog';
import type { SearchDraft } from '../active-ride/components/FindingDriver';
import type { FareOffer } from '../fare/hooks';
import type { FareEstimates } from './api';
import { requestFareText } from './components/BookingChoices';
import { tripCardStops } from './components/BookingStages';
import { BOOKING_COPY } from './copy';
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
};

/**
 * The booking map's Back (DS §12.5, UI-R10): one sheet state back; at the first state it leaves the
 * screen. With a trip planned (a destination or stops) and no ride yet it asks first: "Discard
 * this trip?" with "Keep editing" (the default) and "Discard" (passenger-vehicle-fare.md). It never
 * says "Cancel ride" before a ride exists. One question at a time.
 */
export const useDiscardOnLeave = ({ flow, rideShown, blocked = false, onLeave }: LeaveOptions): (() => void) => {
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
        if (yes) onLeave();
      })
      .finally(() => {
        asking.current = false;
      });
  }, [blocked, stepBack, hasDraft, onLeave]);
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

/** The one navigation call the swipe-back guard needs. */
type GestureNavigator = { setOptions: (options: { gestureEnabled: boolean }) => void };

/**
 * T-583: the iOS edge swipe-back is off while a request is being confirmed or sent and while a
 * driver is being searched for, the same moments the on-screen Back is held or replaced by
 * "Cancel request" (UI-R10), so a swipe never leaves under a POST /rides in flight.
 */
export const useBookingSwipeBack = (navigation: GestureNavigator, blocked: boolean): void => {
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !blocked });
  }, [navigation, blocked]);
};
