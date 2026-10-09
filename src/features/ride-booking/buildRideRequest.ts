import { isVehicleTypeKey, type RideRequest } from '../../services/rideService';

/** A point the passenger picked: coordinates and the address text they saw. */
export interface BookingPlace {
  latitude: number;
  longitude: number;
  address?: string | null;
}

export interface RideRequestInput {
  pickup: BookingPlace | null;
  dropoff: BookingPlace | null;
  /** In the order the passenger added them; stop_order follows this order. */
  stops?: ReadonlyArray<BookingPlace>;
  /** The selected catalogue key (GET /public/vehicle-types). */
  vehicleType: string | null | undefined;
  passengerCount?: number;
  specialInstructions?: string;
}

export type BuildRideRequestResult =
  | { ok: true; request: RideRequest }
  | { ok: false; error: string };

/** Limits of POST /rides validation (RidesController@store). */
export const MAX_STOPS = 5;
const MAX_ADDRESS = 255;
const MAX_INSTRUCTIONS = 500;
const MAX_PASSENGERS = 8;

export const BUILD_ERRORS = {
  route: 'Please select both pickup and destination.',
  address: 'We could not read the address of a selected place. Please pick it again.',
  vehicle: 'Please choose a vehicle type.',
  stops: `You can add up to ${MAX_STOPS} stops.`,
  passengers: `Passengers must be between 1 and ${MAX_PASSENGERS}.`,
} as const;

const validCoords = (p: BookingPlace): boolean =>
  Number.isFinite(p.latitude) && Number.isFinite(p.longitude) &&
  Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;

const addressOf = (p: BookingPlace): string | null => {
  const text = typeof p.address === 'string' ? p.address.trim() : '';
  return text ? text.slice(0, MAX_ADDRESS) : null;
};

/**
 * The one way to build a POST /rides body (T-302, PAX-02/04/15/23). No passenger_id (the
 * server takes the passenger from the token, BE-01) and no service_level; vehicle_type is a
 * catalogue key as-is; every point carries its real address; stops keep their order.
 * Returns an error message instead of a body the server would refuse.
 */
export const buildRideRequest = (input: RideRequestInput): BuildRideRequestResult => {
  const { pickup, dropoff } = input;
  if (!pickup || !dropoff || !validCoords(pickup) || !validCoords(dropoff)) {
    return { ok: false, error: BUILD_ERRORS.route };
  }
  const vehicleType = input.vehicleType;
  if (!isVehicleTypeKey(vehicleType)) {
    return { ok: false, error: BUILD_ERRORS.vehicle };
  }
  const stops = input.stops ?? [];
  if (stops.length > MAX_STOPS) {
    return { ok: false, error: BUILD_ERRORS.stops };
  }
  if (!stops.every(validCoords)) {
    return { ok: false, error: BUILD_ERRORS.route };
  }
  const pickupAddress = addressOf(pickup);
  const dropoffAddress = addressOf(dropoff);
  const stopAddresses = stops.map(addressOf);
  if (!pickupAddress || !dropoffAddress || stopAddresses.some((a) => a === null)) {
    return { ok: false, error: BUILD_ERRORS.address };
  }
  const count = input.passengerCount;
  if (count !== undefined && (!Number.isInteger(count) || count < 1 || count > MAX_PASSENGERS)) {
    return { ok: false, error: BUILD_ERRORS.passengers };
  }
  const instructions = input.specialInstructions?.trim().slice(0, MAX_INSTRUCTIONS);

  const request: RideRequest = {
    pickup_address: pickupAddress,
    dropoff_address: dropoffAddress,
    pickup_latitude: pickup.latitude,
    pickup_longitude: pickup.longitude,
    dropoff_latitude: dropoff.latitude,
    dropoff_longitude: dropoff.longitude,
    vehicle_type: vehicleType,
    ...(count !== undefined ? { passenger_count: count } : {}),
    ...(instructions ? { special_instructions: instructions } : {}),
    ...(stops.length > 0
      ? {
          stops: stops.map((stop, index) => ({
            address: stopAddresses[index] as string,
            latitude: stop.latitude,
            longitude: stop.longitude,
            stop_order: index + 1,
          })),
        }
      : {}),
  };
  return { ok: true, request };
};

/** "31.52040, 74.35870": the address of a map-tapped point that geocoding could not name. */
export const coordinateLabel = (p: BookingPlace): string =>
  `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`;

/**
 * Fills in the address of any point that has none (a map tap) by reverse geocoding, and
 * falls back to its coordinates, so a request never carries a placeholder text.
 */
export const withAddresses = async <P extends BookingPlace>(
  places: ReadonlyArray<P | null>,
  reverseGeocode: (lat: number, lng: number) => Promise<string | null>,
): Promise<Array<P | null>> =>
  Promise.all(
    places.map(async (place) => {
      if (!place || addressOf(place)) return place;
      let address: string | null = null;
      try {
        address = await reverseGeocode(place.latitude, place.longitude);
      } catch {
        address = null;
      }
      return { ...place, address: address?.trim() || coordinateLabel(place) };
    }),
  );
