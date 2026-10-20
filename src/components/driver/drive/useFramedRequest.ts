import { useMemo } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import type { LatLng } from '../../../features/driver-requests/api';
import type { DriverRequestsState } from '../../../features/driver-requests/slice';

type Root = { driverRequests: DriverRequestsState };

/** Primitive picture of one request's map points: equal across polls that change nothing. */
type Picked = {
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  /** "lat,lng;lat,lng" of the stops with coordinates, in route order. */
  stops: string;
};

const NONE: Picked = { pickupLat: null, pickupLng: null, dropoffLat: null, dropoffLng: null, stops: '' };

const pick = (state: Root, rideId: number | null): Picked => {
  if (rideId === null) return NONE;
  const request = state.driverRequests.items.find(item => item.id === rideId);
  if (!request) return NONE;
  return {
    pickupLat: request.pickup?.latitude ?? null,
    pickupLng: request.pickup?.longitude ?? null,
    dropoffLat: request.dropoff?.latitude ?? null,
    dropoffLng: request.dropoff?.longitude ?? null,
    stops: request.stops
      .map(stop => (stop.point ? `${stop.point.latitude},${stop.point.longitude}` : ''))
      .filter(Boolean)
      .join(';'),
  };
};

const point = (latitude: number | null, longitude: number | null): LatLng | null =>
  latitude !== null && longitude !== null ? { latitude, longitude } : null;

export type FramedRequest = { pickup: LatLng | null; dropoff: LatLng | null; stops: LatLng[] };

/**
 * UI-R11 R1: the pickup, numbered stops and drop-off of the request the host is showing
 * (`rideId` from the framing context; null while none or during the taken state). Selects only
 * primitives with `shallowEqual`, so a 5 s poll that lists the same ride re-renders nothing.
 */
export function useFramedRequest(rideId: number | null): FramedRequest {
  const picked = useSelector((state: Root) => pick(state, rideId), shallowEqual);
  return useMemo(
    () => ({
      pickup: point(picked.pickupLat, picked.pickupLng),
      dropoff: point(picked.dropoffLat, picked.dropoffLng),
      stops: picked.stops
        ? picked.stops.split(';').map(pair => {
            const [lat, lng] = pair.split(',').map(Number);
            return { latitude: lat, longitude: lng };
          })
        : [],
    }),
    [picked],
  );
}
