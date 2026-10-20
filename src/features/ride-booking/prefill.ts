import { useEffect, useRef } from 'react';
import type { BookingPlace } from './buildRideRequest';

/**
 * Route params of `Booking` (T-516): open the booking flow with a pickup and/or destination
 * already chosen (a saved place's "Set pickup" / "Set destination", a Home chip).
 */
export type BookingParams = {
  pickup?: BookingPlace;
  destination?: BookingPlace;
};

export type BookingPrefillStage = 'home' | 'destination' | 'vehicle';

export interface BookingPrefillState {
  pickup: BookingPlace | null;
  destination: BookingPlace | null;
  pickupQuery: string;
  destQuery: string;
  stage: BookingPrefillStage;
  /** A destination was given: draw the route as soon as there is a pickup (maybe the GPS one). */
  routePending: boolean;
}

const validPlace = (place: BookingPlace | undefined): place is BookingPlace =>
  !!place && Number.isFinite(place.latitude) && Number.isFinite(place.longitude);

/**
 * The booking state a prefill starts from:
 * - pickup and destination: both set, straight to the vehicle step (route drawn first);
 * - destination only: the pickup stays the passenger's position, vehicle step once it is known;
 * - pickup only: the destination search;
 * - nothing (or unusable coordinates): the normal start.
 */
export const bookingPrefillState = (params: BookingParams | undefined): BookingPrefillState => {
  const pickup = params?.pickup && validPlace(params.pickup) ? params.pickup : null;
  const destination = params?.destination && validPlace(params.destination) ? params.destination : null;
  return {
    pickup,
    destination,
    pickupQuery: pickup?.address ?? '',
    destQuery: destination?.address ?? '',
    stage: pickup && destination ? 'vehicle' : pickup ? 'destination' : 'home',
    routePending: !!destination,
  };
};

type PrefillOptions = {
  params: BookingParams | undefined;
  /** The state the screen started from (`bookingPrefillState(params)` at mount). */
  initial: BookingPrefillState;
  /** A ride on screen wins: a prefill is ignored while one is shown. */
  rideShown: boolean;
  pickup: BookingPlace | null;
  destination: BookingPlace | null;
  /** New params arrived while the screen was open: apply the points that are set. */
  apply: (state: BookingPrefillState) => void;
  /** Draw the route and move to the vehicle step. */
  route: (pickup: BookingPlace, destination: BookingPlace) => void;
};

/**
 * Applies `Booking` params after mount (the mount itself uses `initial` as the useState
 * defaults) and draws the route once a prefilled destination has a pickup.
 */
export function useBookingPrefill({ params, initial, rideShown, pickup, destination, apply, route }: PrefillOptions): void {
  const applied = useRef(params);
  const routePending = useRef(initial.routePending);
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const routeRef = useRef(route);
  routeRef.current = route;

  useEffect(() => {
    if (params === applied.current) return;
    applied.current = params;
    if (rideShown) return;
    const next = bookingPrefillState(params);
    if (!next.pickup && !next.destination) return;
    // Either point may combine with one already chosen on screen: route once both exist.
    routePending.current = true;
    applyRef.current(next);
  }, [params, rideShown]);

  useEffect(() => {
    if (!routePending.current || rideShown || !pickup || !destination) return;
    routePending.current = false;
    routeRef.current(pickup, destination);
  }, [pickup, destination, rideShown]);
}

/** The booking flow's setters a prefill writes (T-516). */
export type BookingPrefillTarget = {
  setMapPick: (target: null) => void;
  setError: (error: null) => void;
  setPickup: (place: BookingPlace) => void;
  setPickupQuery: (text: string) => void;
  setDestination: (place: BookingPlace) => void;
  setDestQuery: (text: string) => void;
  setStage: (stage: 'home' | 'destination') => void;
};

/**
 * New prefill params while the screen is open (T-516): replace the points they carry and go to
 * the trip start (or the destination search when there is still no destination).
 */
export const applyBookingPrefill = (flow: BookingPrefillTarget, next: BookingPrefillState, hadDestination: boolean): void => {
  flow.setMapPick(null);
  flow.setError(null);
  if (next.pickup) {
    flow.setPickup(next.pickup);
    flow.setPickupQuery(next.pickupQuery);
  }
  if (next.destination) {
    flow.setDestination(next.destination);
    flow.setDestQuery(next.destQuery);
  }
  flow.setStage(next.destination || hadDestination ? 'home' : 'destination');
};
