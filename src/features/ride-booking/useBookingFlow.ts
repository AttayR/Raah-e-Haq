import { useCallback, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import type { MapPressEvent } from 'react-native-maps';
import { reverseGeocode } from '../../services/placesService';
import { displayAddress } from '../passenger-home/greeting';
import type { BookingPlace } from './buildRideRequest';
import { MAX_STOPS } from './components/BookingStages';
import { BOOKING_COPY } from './copy';
import { mapTapTarget, type MapPickTarget } from './mapTap';
import type { BookingPrefillState } from './prefill';

/**
 * The booking steps; `requesting` is also the stage while a ride is shown. UI-R10: `vehicle` is
 * the one "Choose a ride" sheet (tier, fare and request); there is no separate fare step.
 */
export type BookingStage = 'home' | 'pickup' | 'destination' | 'vehicle' | 'requesting';

const STAGE_ORDER: BookingStage[] = ['home', 'pickup', 'destination', 'vehicle', 'requesting'];
/** The route is drawn from the vehicle step on; an earlier step shows no route (T-551). */
const ROUTE_FROM = STAGE_ORDER.indexOf('vehicle');
/**
 * T-594 (Android smoke issue 7): Back goes one sheet state back (DS §12.5): Choose a ride and the
 * one-field searches return to the Where to sheet ("Plan your trip", both fields, picks kept) in
 * one press, not through each search step (it took three presses).
 */
const PREVIOUS_STAGE: Record<BookingStage, BookingStage | null> = {
  home: null,
  pickup: 'home',
  destination: 'home',
  vehicle: 'home',
  requesting: 'vehicle',
};

type LatLng = { latitude: number; longitude: number };

/**
 * Text the screen puts in a search field. Every set bumps `revision`, so the field takes it even
 * when the passenger typed something else meanwhile (T-534: typed text stays in the field).
 */
export type FieldText = { text: string; revision: number };

export interface BookingDirections {
  fetchRoute: (pickup: LatLng, destination: LatLng) => unknown;
  fetchRouteWithWaypoints: (pickup: LatLng, waypoints: LatLng[], destination: LatLng) => unknown;
  clearRoute: () => void;
}

const samePoint = (a: LatLng | null | undefined, b: LatLng): boolean =>
  !!a && a.latitude === b.latitude && a.longitude === b.longitude;

/**
 * T-582: a point tapped on the map gets its street address (one reverse geocode per tap, never
 * per pan), so the trip card and the field show where it is, not "Pinned on map". The answer is
 * kept only while the place is still that point, and a field still showing the label.
 */
const resolvePinnedAddress = (point: LatLng, onAddress: (address: string) => void): void => {
  reverseGeocode(point.latitude, point.longitude)
    .then((raw) => {
      const address = raw ? displayAddress(raw) : null;
      if (address) onAddress(address);
    })
    .catch(() => undefined);
};

const useFieldText = (initial: string) => {
  const [field, setField] = useState<FieldText>({ text: initial, revision: 0 });
  const set = useCallback((text: string) => setField((f) => ({ text, revision: f.revision + 1 })), []);
  /** Puts `text` in the field only while it still shows `label` (a late answer never overwrites a pick). */
  const replaceLabel = useCallback(
    (label: string, text: string) => setField((f) => (f.text === label ? { text, revision: f.revision + 1 } : f)),
    [],
  );
  return [field, set, replaceLabel] as const;
};

type Options = {
  prefill: BookingPrefillState;
  currentLocation: LatLng | null;
  rideShown: boolean;
  directions: BookingDirections;
};

/**
 * The booking state of the passenger map (T-534 split of PassengerMapScreen): the chosen
 * points, the step, the map-pick mode and what the search fields show, with the handlers that
 * move between steps and draw the route.
 */
export const useBookingFlow = ({ prefill, currentLocation, rideShown, directions }: Options) => {
  const { fetchRoute, fetchRouteWithWaypoints, clearRoute } = directions;
  const [pickup, setPickup] = useState<BookingPlace | null>(prefill.pickup);
  const [stops, setStops] = useState<BookingPlace[]>([]);
  const [destination, setDestination] = useState<BookingPlace | null>(prefill.destination);
  // Map taps set a location only in this explicit mode (T-304, PAX-14).
  const [mapPick, setMapPick] = useState<MapPickTarget | null>(null);
  const [stage, setStage] = useState<BookingStage>(prefill.stage);
  const [pickupField, setPickupQuery, replacePickupLabel] = useFieldText(prefill.pickupQuery);
  const [destField, setDestQuery, replaceDestLabel] = useFieldText(prefill.destQuery);
  const [selectedVehicle, setSelectedVehicle] = useState<string | undefined>();
  // BE-87: "Female driver" on the choose-ride sheet (shown only to passengers the server lets ask).
  const [femaleDriverOnly, setFemaleDriverOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // T-576: the planner opened from "Where to?" (nothing prefilled) focuses the destination field
  // once, as passenger-destination-search.md asks ("focused on mount"). Typing right after the
  // tap then lands in the field. It ends for good when the booking leaves the start step or a
  // ride shows, so a later return to the start (Back, a reset after a ride) never pops the keyboard.
  const [focusDestinationOnOpen, setFocusDestinationOnOpen] = useState(prefill.stage === 'home' && !prefill.destination && !rideShown);
  if (focusDestinationOnOpen && (stage !== 'home' || rideShown)) setFocusDestinationOnOpen(false);

  // The points and what their fields say swap together.
  const swapPickupDrop = useCallback(() => {
    if (pickup && destination) {
      setPickup(destination);
      setDestination(pickup);
      setPickupQuery(destField.text);
      setDestQuery(pickupField.text);
      clearRoute();
      fetchRoute(destination, pickup);
    }
  }, [pickup, destination, pickupField.text, destField.text, fetchRoute, clearRoute, setPickupQuery, setDestQuery]);

  // T-582 review: the latest tapped point per field; an answer for an older tap is dropped
  // (both the place and the field label), so a late first answer never names the second point.
  const latestTap = useRef<Record<'pickup' | 'destination', LatLng | null>>({ pickup: null, destination: null });

  // PAX-14/PAX-24: only in the explicit choose-on-map mode, never on a marker press.
  const onPressMap = useCallback((e: MapPressEvent) => {
    const target = mapTapTarget({ mode: mapPick, action: e.nativeEvent.action, rideShown });
    if (!target) return;
    const point = { latitude: e.nativeEvent.coordinate.latitude, longitude: e.nativeEvent.coordinate.longitude };
    setMapPick(null);
    if (target === 'pickup') {
      setPickup(point);
      setPickupQuery(BOOKING_COPY.pinnedOnMap);
      latestTap.current.pickup = point;
      resolvePinnedAddress(point, (address) => {
        if (latestTap.current.pickup !== point) return;
        setPickup((p) => (samePoint(p, point) ? { ...point, address } : p));
        replacePickupLabel(BOOKING_COPY.pinnedOnMap, address);
      });
      if (destination) {
        fetchRouteWithWaypoints(point, stops, destination);
        setStage('vehicle');
      } else {
        clearRoute();
        setStage('destination');
      }
    } else if (target === 'destination') {
      setDestination(point);
      setDestQuery(BOOKING_COPY.pinnedOnMap);
      latestTap.current.destination = point;
      resolvePinnedAddress(point, (address) => {
        if (latestTap.current.destination !== point) return;
        setDestination((d) => (samePoint(d, point) ? { ...point, address } : d));
        replaceDestLabel(BOOKING_COPY.pinnedOnMap, address);
      });
      if (pickup) {
        fetchRouteWithWaypoints(pickup, stops, point);
        setStage('vehicle');
      } else {
        setStage('pickup');
      }
    } else if (pickup && destination && stops.length < MAX_STOPS) {
      const ns = [...stops, point];
      setStops(ns);
      fetchRouteWithWaypoints(pickup, ns, destination);
      // Each stop's answer names only that stop (matched by its own point object).
      resolvePinnedAddress(point, (address) =>
        setStops((list) => list.map((s) => (s === point ? { ...s, address } : s))),
      );
    }
  }, [mapPick, rideShown, pickup, stops, destination, fetchRouteWithWaypoints, clearRoute, setPickupQuery, setDestQuery, replacePickupLabel, replaceDestLabel]);

  const resetSelection = useCallback(() => {
    setPickup(null);
    setStops([]);
    setDestination(null);
    setMapPick(null);
    setStage('home');
    setSelectedVehicle(undefined);
    setFemaleDriverOnly(false);
    setPickupQuery('');
    setDestQuery('');
    setError(null);
    clearRoute();
  }, [clearRoute, setPickupQuery, setDestQuery]);

  /**
   * Back steps through the booking; a ride stays in Redux, so Back then leaves the screen. Back
   * to a search step drops the old route: the next pick draws a new one (T-551).
   */
  const stepBack = useCallback((): boolean => {
    // UI-R10: while POST /rides is in flight (no ride shown yet) Back is held, never a step back to
    // "Choose a ride" under a request that is being created (a second tap could send it twice).
    if (stage === 'requesting' && !rideShown) return true;
    const previous = PREVIOUS_STAGE[stage];
    if (previous !== null && !rideShown) {
      if (STAGE_ORDER.indexOf(previous) < ROUTE_FROM) clearRoute();
      setStage(previous);
      setError(null);
      return true;
    }
    return false;
  }, [stage, rideShown, clearRoute]);

  /** The vehicle step's edit chips: back to that search, without the old route (T-551). */
  const editPoint = useCallback((target: 'pickup' | 'destination') => {
    clearRoute();
    setStage(target);
  }, [clearRoute]);

  // Pickup at the passenger's position; its address is resolved and kept with the point.
  const pickupAtCurrentLocation = useCallback(async () => {
    if (!currentLocation) return null;
    const cur = { latitude: currentLocation.latitude, longitude: currentLocation.longitude };
    setPickup(cur);
    setPickupQuery(BOOKING_COPY.resolvingAddress);
    const raw = await reverseGeocode(cur.latitude, cur.longitude).catch(() => null);
    // Street address without a leading Plus Code; the field says "Current location" until edited.
    const addr = raw ? displayAddress(raw) : null;
    setPickupQuery(BOOKING_COPY.currentLocation);
    // Only if the passenger has not picked another pickup meanwhile.
    if (addr) setPickup((p) => (p && p.latitude === cur.latitude && p.longitude === cur.longitude ? { ...p, address: addr } : p));
    return cur;
  }, [currentLocation, setPickupQuery]);

  // "Set location on map" from the search results: close the keyboard, enter the map pick mode.
  const chooseOnMap = useCallback((target: MapPickTarget) => {
    Keyboard.dismiss();
    setMapPick(target);
  }, []);

  // A re-picked pickup or destination keeps the stops already on the trip (T-551).
  const routeVia = useCallback((from: LatLng, to: LatLng) => {
    if (stops.length > 0) fetchRouteWithWaypoints(from, stops, to);
    else fetchRoute(from, to);
  }, [stops, fetchRoute, fetchRouteWithWaypoints]);

  const updateStops = useCallback((ns: BookingPlace[]) => {
    if (!pickup || !destination) return;
    setStops(ns);
    fetchRouteWithWaypoints(pickup, ns, destination);
  }, [pickup, destination, fetchRouteWithWaypoints]);

  /**
   * A pickup picked in the search. With `routeIfReady` (the two-field start) and a destination,
   * the route and the vehicle step; the two-field start without a destination stays put, so the
   * pickup row keeps showing the pick above the destination row (T-553); the pickup step goes on
   * to the destination step.
   */
  const selectPickup = useCallback((c: LatLng, address: string, routeIfReady: boolean) => {
    setPickup({ ...c, address });
    // The field keeps the picked address (Back to this step shows it, not the old text).
    setPickupQuery(address);
    if (destination && routeIfReady) {
      routeVia(c, destination);
      setStage('vehicle');
    } else if (!routeIfReady) {
      setStage('destination');
    }
  }, [destination, routeVia, setPickupQuery]);

  /** A destination picked in the search: the route from the pickup (else the passenger's position). */
  const selectDestination = useCallback((c: LatLng, address: string, fallbackToGps: boolean) => {
    const gps = currentLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude } : null;
    if (!pickup && fallbackToGps && gps) {
      setPickup(gps);
      setPickupQuery(BOOKING_COPY.currentLocation);
    }
    const from = pickup ?? (fallbackToGps ? gps : null);
    setDestination({ ...c, address });
    setDestQuery(address);
    if (from) {
      routeVia(from, c);
      setStage('vehicle');
    } else {
      setStage(fallbackToGps ? 'vehicle' : 'pickup');
    }
  }, [pickup, currentLocation, routeVia, setPickupQuery, setDestQuery]);

  const pickCurrentLocation = useCallback(async () => {
    const cur = await pickupAtCurrentLocation();
    if (cur && destination) {
      routeVia(cur, destination);
      setStage('vehicle');
    }
  }, [pickupAtCurrentLocation, destination, routeVia]);

  return {
    pickup,
    setPickup,
    stops,
    destination,
    setDestination,
    mapPick,
    setMapPick,
    stage,
    setStage,
    focusDestinationOnOpen,
    pickupField,
    setPickupQuery,
    destField,
    setDestQuery,
    selectedVehicle,
    setSelectedVehicle,
    femaleDriverOnly,
    setFemaleDriverOnly,
    error,
    setError,
    swapPickupDrop,
    onPressMap,
    resetSelection,
    stepBack,
    editPoint,
    pickupAtCurrentLocation,
    chooseOnMap,
    updateStops,
    selectPickup,
    selectDestination,
    pickCurrentLocation,
  };
};

export type BookingFlow = ReturnType<typeof useBookingFlow>;
