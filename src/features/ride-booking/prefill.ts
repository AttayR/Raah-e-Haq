import { useEffect, useRef } from 'react';
import type { BookingPlace } from './buildRideRequest';
import { takeBookingDraft, type BookingDraft } from './bookingDraftStore';

/**
 * Route params of `Booking` (T-516): open the booking flow with a pickup and/or destination
 * already chosen (a saved place's "Set pickup" / "Set destination", a Home chip).
 */
export type BookingParams = {
  pickup?: BookingPlace;
  destination?: BookingPlace;
  /**
   * UI-R9b: opened from Home's "Where to?" (or the Ride card). Only this entry restores a trip
   * left on Back within 10 minutes (the in-memory booking draft), and plays the bar's move to
   * the top of the planner from `whereToTop` (its window y when tapped).
   */
  entry?: 'whereTo';
  whereToTop?: number;
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
  /** UI-R9b: stops of a restored draft (none for a prefill). */
  stops: BookingPlace[];
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
export const bookingPrefillState = (params: BookingParams | undefined, draft: BookingDraft | null = null): BookingPrefillState => {
  const pickup = params?.pickup && validPlace(params.pickup) ? params.pickup : null;
  const destination = params?.destination && validPlace(params.destination) ? params.destination : null;
  if (!pickup && !destination && draft) return draftPrefillState(draft);
  return {
    pickup,
    destination,
    pickupQuery: pickup?.address ?? '',
    destQuery: destination?.address ?? '',
    stage: pickup && destination ? 'vehicle' : pickup ? 'destination' : 'home',
    routePending: !!destination,
    stops: [],
  };
};

/**
 * UI-R9b: a trip left on Back, restored by "Where to?": both ends → "Choose a ride" (the route,
 * stops included, is drawn once the map has the points); otherwise the planner with what was
 * chosen (a missing pickup is the passenger's position again).
 */
const draftPrefillState = (draft: BookingDraft): BookingPrefillState => {
  const pickup = draft.pickup && validPlace(draft.pickup) ? draft.pickup : null;
  const destination = draft.destination && validPlace(draft.destination) ? draft.destination : null;
  return {
    pickup,
    destination,
    pickupQuery: pickup ? draft.pickupQuery || (pickup.address ?? '') : '',
    destQuery: destination ? draft.destQuery || (destination.address ?? '') : '',
    stage: pickup && destination ? 'vehicle' : 'home',
    routePending: !!destination,
    stops: destination ? draft.stops.filter(validPlace) : [],
  };
};

/** The state Booking opens with: its params, or (from "Where to?" only) the kept draft. */
export const initialBookingState = (params: BookingParams | undefined): BookingPrefillState =>
  bookingPrefillState(params, params?.entry === 'whereTo' ? takeBookingDraft() : null);

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
