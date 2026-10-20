import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';
import { haptics } from '../../../core/haptics';
import { formatMoney, formatTime } from '../../../utils/format';
import { ACTIVE_RIDE_COPY } from '../copy';
import type { PassengerRideStage } from '../stage';
import type { PassengerTripView } from './usePassengerTripView';

/** A driver accepted this recently: the sheet that just appeared is the "driver found" moment. */
const JUST_ACCEPTED_MS = 30_000;

const driverDetails = (view: PassengerTripView): string => {
  const d = view.driver;
  if (!d) return '';
  const vehicle = [d.vehicleName, d.color].filter(Boolean).join(' · ');
  return [d.name ?? ACTIVE_RIDE_COPY.driverFallbackName, vehicle, d.plate ? ACTIVE_RIDE_COPY.plateA11y(d.plate) : null]
    .filter(Boolean)
    .join(', ');
};

/** What a screen reader hears when the trip enters `stage` (PA7, PT6, PR6). */
export const tripAnnouncement = (stage: PassengerRideStage, view: PassengerTripView, now: number = Date.now()): string | null => {
  switch (stage) {
    case 'driver_en_route':
      return ACTIVE_RIDE_COPY.driverFoundA11y(driverDetails(view), view.header.etaMinutes);
    case 'driver_arrived':
      return ACTIVE_RIDE_COPY.driverHereA11y(view.driver?.plate ?? null);
    case 'in_trip': {
      const eta = view.header.etaMinutes;
      return ACTIVE_RIDE_COPY.tripStartedA11y(eta !== null ? formatTime(new Date(now + eta * 60_000)) : null);
    }
    case 'completed':
      return ACTIVE_RIDE_COPY.arrivedA11y(view.fare !== null ? formatMoney(view.fare) : null);
    default:
      return null;
  }
};

/**
 * The trip's moments (TS7, PA6/PA7, PT5/PT6, PR4/PR6): one haptic and one announcement when the
 * stage changes, never on an ETA tick. Driver found (`notificationSuccess`) only when the accept
 * is fresh, so reopening a ride later stays quiet; arrived `notificationWarning`; complete
 * `notificationSuccess`. A completed stop announces the next one.
 */
export const useTripMoments = (view: PassengerTripView): void => {
  const last = useRef<PassengerRideStage | null>(null);
  // Read for its words when the stage changes; a new ride read alone never announces again.
  const viewRef = useRef(view);
  viewRef.current = view;
  const lastNextStop = useRef<number | null>(null);
  const { stage } = view;
  const acceptedAt = view.ride?.accepted_at ?? null;
  const nextStop = stage === 'in_trip' ? view.stops.find((stop) => !stop.done)?.n ?? null : null;

  useEffect(() => {
    const previous = last.current;
    last.current = stage;
    if (previous === stage) return;
    if (previous === null) {
      // First render: only a fresh accept is the "driver found" moment (not a reopen or restore).
      const accepted = acceptedAt ? Date.parse(acceptedAt) : NaN;
      if (stage !== 'driver_en_route' || !Number.isFinite(accepted) || Date.now() - accepted > JUST_ACCEPTED_MS) return;
    }
    if (stage === 'driver_en_route' || stage === 'completed') haptics.notificationSuccess();
    if (stage === 'driver_arrived') haptics.notificationWarning();
    const text = tripAnnouncement(stage, viewRef.current);
    if (text) AccessibilityInfo.announceForAccessibility(text);
  }, [stage, acceptedAt]);

  useEffect(() => {
    const previous = lastNextStop.current;
    lastNextStop.current = nextStop;
    if (previous !== null && nextStop !== null && nextStop !== previous) {
      AccessibilityInfo.announceForAccessibility(ACTIVE_RIDE_COPY.nextStopA11y(nextStop));
    }
  }, [nextStop]);
};
