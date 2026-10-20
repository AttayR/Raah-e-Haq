import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Details, LatLng, Region } from 'react-native-maps';
import type { SafeMapViewRef } from '../../components/SafeMapView';
import { logger } from '../../core/logging/logger';
import { reverseGeocode } from '../../services/placesService';
import { displayAddress } from '../passenger-home/greeting';
import type { MapPickTarget } from './mapTap';
import type { BookingFlow } from './useBookingFlow';

/** One address lookup once the map has been still this long (never one per pan frame). */
export const PICKER_GEOCODE_SETTLE_MS = 300;
/** The camera move to the starting point. */
const START_MOVE_MS = 300;
/** About 1 m: a "new" centre this close to the last one is the same point (no second lookup). */
const SAME_POINT_DEGREES = 0.00001;

const samePoint = (a: LatLng | null, b: LatLng): boolean =>
  !!a && Math.abs(a.latitude - b.latitude) < SAME_POINT_DEGREES && Math.abs(a.longitude - b.longitude) < SAME_POINT_DEGREES;

const centreOf = (region: Region): LatLng => ({ latitude: region.latitude, longitude: region.longitude });

type Options = {
  mapRef: RefObject<SafeMapViewRef | null>;
  /** The picker is open for this field (flow `mapPick`), or closed. */
  target: MapPickTarget | null;
  /** Where the pin starts: the point being changed, else the passenger's position. */
  startPoint: LatLng | null;
  /** The map's first region (the centre until the map reports a move). */
  initialRegion: Region;
  /** "Confirm …": the point under the pin, with its address when the lookup has answered. */
  onConfirm: (target: MapPickTarget, point: LatLng, address: string | null) => void;
};

export type MapPicker = {
  target: MapPickTarget | null;
  /** The map is being moved (the pin is lifted, the address is a skeleton). */
  moving: boolean;
  /** The street address under the pin; null while looking it up or when none was found. */
  address: string | null;
  resolving: boolean;
  onRegionChangeStart: () => void;
  onRegionChangeComplete: (region: Region) => void;
  confirm: () => void;
  /** Centres the pin on `point` (the locate control while picking). */
  centreOn: (point: LatLng) => void;
  /** True while open: the booking camera keeps still (no refit under the passenger's pan). */
  holdsCamera: () => boolean;
};

/**
 * UI-R9b: the full-screen centre-pin picker (passenger-destination-search block 5, DS §5.21,
 * motion §6.6). The point is the map's centre (the pin's tip). On open the map moves to the
 * point being changed (else the passenger); each time the map comes to rest the address under the
 * pin is looked up once, after a 300 ms pause (a newer move drops an older answer). No request
 * while the map moves. Handlers are stable (the memoised booking map is not re-rendered).
 */
export function useMapPicker({ mapRef, target, startPoint, initialRegion, onConfirm }: Options): MapPicker {
  const [moving, setMoving] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const region = useRef<Region>(initialRegion);
  const centre = useRef<LatLng>(centreOf(initialRegion));
  const looked = useRef<LatLng | null>(null);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(false);
  active.current = target !== null;
  const startRef = useRef(startPoint);
  startRef.current = startPoint;
  const latest = useRef({ target, address, resolving, moving, onConfirm });
  latest.current = { target, address, resolving, moving, onConfirm };

  const cancelLookup = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    seq.current += 1;
  }, []);

  const lookUp = useCallback(
    (point: LatLng) => {
      if (samePoint(looked.current, point)) return;
      cancelLookup();
      setResolving(true);
      timer.current = setTimeout(() => {
        timer.current = null;
        const id = seq.current;
        looked.current = point;
        reverseGeocode(point.latitude, point.longitude)
          .then((raw) => (raw ? displayAddress(raw) : null))
          .catch((e: unknown) => {
            logger.debug('map picker: address lookup failed', e);
            return null;
          })
          .then((found) => {
            if (id !== seq.current || !active.current) return;
            setAddress(found);
            setResolving(false);
          });
      }, PICKER_GEOCODE_SETTLE_MS);
    },
    [cancelLookup],
  );

  const centreOn = useCallback(
    (point: LatLng) => {
      const { latitudeDelta, longitudeDelta } = region.current;
      try {
        mapRef.current?.animateToRegion({ ...point, latitudeDelta, longitudeDelta }, START_MOVE_MS);
      } catch (e) {
        logger.debug('map picker: could not move the map', e);
      }
    },
    [mapRef],
  );

  // Open: start on the point being changed (or the passenger); closed: forget the lookup.
  useEffect(() => {
    if (!target) {
      cancelLookup();
      looked.current = null;
      setMoving(false);
      setAddress(null);
      setResolving(false);
      return;
    }
    const start = startRef.current;
    if (start && !samePoint(centre.current, start)) {
      centre.current = { latitude: start.latitude, longitude: start.longitude };
      centreOn(start);
    }
    lookUp(centre.current);
  }, [target, cancelLookup, centreOn, lookUp]);

  useEffect(() => cancelLookup, [cancelLookup]);

  const onRegionChangeStart = useCallback(() => {
    if (!active.current) return;
    cancelLookup();
    looked.current = null;
    setMoving(true);
    setResolving(true);
  }, [cancelLookup]);

  const onRegionChangeComplete = useCallback(
    (next: Region) => {
      region.current = next;
      centre.current = centreOf(next);
      if (!active.current) return;
      setMoving(false);
      lookUp(centre.current);
    },
    [lookUp],
  );

  const confirm = useCallback(() => {
    const now = latest.current;
    if (!now.target || now.moving) return;
    now.onConfirm(now.target, centre.current, now.resolving ? null : now.address);
  }, []);

  const holdsCamera = useCallback(() => active.current, []);

  return { target, moving, address, resolving, onRegionChangeStart, onRegionChangeComplete, confirm, centreOn, holdsCamera };
}

type BookingPickOptions = {
  mapRef: RefObject<SafeMapViewRef | null>;
  flow: Pick<BookingFlow, 'mapPick' | 'pickup' | 'destination' | 'placeOnMap'>;
  currentLocation: LatLng | null;
  rideShown: boolean;
  initialRegion: Region;
  rideCamera: { holdsCamera: () => boolean; onRegionChangeComplete: (region: Region, details?: Details) => void };
};

/**
 * The booking screen's picker wiring (UI-R9b): open while the flow's map-pick mode is on (never
 * with a ride), starting on the point being changed; the booking camera holds still while it is
 * open; one region handler feeds the ride camera and the picker; locate centres the pin on the
 * passenger while picking.
 */
export function useBookingMapPick({ mapRef, flow, currentLocation, rideShown, initialRegion, rideCamera }: BookingPickOptions) {
  const { mapPick, pickup, destination, placeOnMap } = flow;
  const target = rideShown ? null : mapPick;
  const startPoint =
    target === 'pickup'
      ? pickup ?? currentLocation
      : target === 'destination'
        ? destination ?? pickup ?? currentLocation
        : currentLocation ?? pickup;
  const picker = useMapPicker({ mapRef, target, startPoint, initialRegion, onConfirm: placeOnMap });
  const { holdsCamera: rideHolds, onRegionChangeComplete: rideRegion } = rideCamera;
  const { holdsCamera: pickerHolds, onRegionChangeComplete: pickerRegion, centreOn } = picker;
  const holdsMap = useCallback(() => rideHolds() || pickerHolds(), [rideHolds, pickerHolds]);
  const onRegionChangeComplete = useCallback(
    (region: Region, details?: Details) => {
      rideRegion(region, details);
      pickerRegion(region);
    },
    [rideRegion, pickerRegion],
  );
  const locateWhilePicking = currentLocation && target ? () => centreOn(currentLocation) : null;
  return { picker, holdsMap, onRegionChangeComplete, locateWhilePicking };
}
