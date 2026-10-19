/**
 * Kit gallery only (Debug): API-shaped ride bodies (RideResource, POST /rides/estimate,
 * GET /public/vehicle-types, GET /rides/pending) run through the real mappers, so the UI-R5 ride
 * component previews show exactly what the screens render for such a response. Never imported by
 * a product screen.
 */
import { normalizeFareEstimates, normalizeVehicleTypes } from '../../ride-booking/api';
import { toVehicleOptions } from '../../ride-booking/vehicleOptions';
import { toRide } from '../../ride-history/api';
import { toPendingRideRequest } from '../../driver-requests/api';
import type { Ride } from '../../ride-history/types';
import type { NearbyDriver } from '../../../services/rideService';
import { cumulativeMeters, pointAlong } from '../../../components/ui/ride/vehicleMotion';

/** Lahore: Liberty Market → Model Town → Emporium Mall (a plausible city route). */
export const galleryRoute = [
  { latitude: 31.5104, longitude: 74.3442 },
  { latitude: 31.5052, longitude: 74.3389 },
  { latitude: 31.4987, longitude: 74.3301 },
  { latitude: 31.4921, longitude: 74.3215 },
  { latitude: 31.4846, longitude: 74.3168 },
  { latitude: 31.4774, longitude: 74.3061 },
  { latitude: 31.4712, longitude: 74.2952 },
  { latitude: 31.4675, longitude: 74.2655 },
];
export const galleryStop = galleryRoute[3];
export const galleryRegion = { latitude: 31.4928, longitude: 74.3084, latitudeDelta: 0.1, longitudeDelta: 0.11 };
/** The assigned driver where the traveled part ends, and two nearby (unassigned) cars. */
export const galleryAssignedCar = { coordinate: galleryRoute[2] };
/** Gallery-only nearby vehicles (NearbyDriver shape, T-586): a car and an AC car. */
export const galleryNearbyCars: NearbyDriver[] = [
  { id: 'n1', rating: 0, vehicle_type: 'car', distance_km: 1, estimated_arrival_min: 3, location: { latitude: 31.5245, longitude: 74.3205 }, heading: 45 },
  { id: 'n2', rating: 0, vehicle_type: 'car_ac', distance_km: 2, estimated_arrival_min: 5, location: { latitude: 31.4971, longitude: 74.3512 }, heading: 300 },
];

const rawRide = {
  id: 9041,
  ride_id: 'RH-GALLERY1',
  status: 'completed',
  driver_id: 7,
  passenger_id: 3,
  pickup_address: 'Liberty Market, Gulberg III, Lahore',
  dropoff_address: 'Emporium Mall, Johar Town, Lahore',
  stops: [{ id: 1, address: 'Model Town Park, Lahore', stop_order: 1, status: 'completed' }],
  vehicle_type: 'car',
  total_fare: 1250,
  fare_breakdown: { base: 150, distance: 820, time: 200, stops: 80, min_fare_adjustment: 0, total: 1250 },
  driver_earnings: 1063,
  platform_commission: 187,
  distance_km: 11.6,
  duration_minutes: 34,
  payment_method: 'cash',
  payment_status: 'paid',
  passenger: { id: 3, name: 'Ayesha Khan', rating: '0.00' },
  driver: { id: 7, name: 'Bilal Ahmed', rating: '4.86' },
  vehicle: { make: 'Toyota', model: 'Corolla', color: 'White', license_plate: 'LEA-1234' },
  requested_at: '2026-10-13T14:02:00+05:00',
  accepted_at: '2026-10-13T14:03:00+05:00',
  arrived_at: '2026-10-13T14:09:00+05:00',
  started_at: '2026-10-13T14:11:00+05:00',
  completed_at: '2026-10-13T14:45:00+05:00',
};

export const galleryRide: Ride = toRide(rawRide) as Ride;

const vehicleTypes = normalizeVehicleTypes([
  { key: 'car', label: 'Car', capacity: 4 },
  { key: 'bike', label: 'Bike', capacity: 1 },
  { key: 'rickshaw', label: 'Rickshaw', capacity: 3 },
  { key: 'van', label: 'Van', capacity: 7 },
]);

export const galleryEstimates = normalizeFareEstimates({
  distance_km: 11.6,
  duration_min: 34,
  estimates: [
    { vehicle_type: 'car', fare: 1250, currency: 'PKR', breakdown: { base: 150, distance: 820, time: 200, stops: 80, min_fare_adjustment: 0 } },
    { vehicle_type: 'bike', fare: 420, currency: 'PKR', breakdown: { base: 50, distance: 290, time: 60, stops: 20, min_fare_adjustment: 0 } },
    { vehicle_type: 'rickshaw', fare: 640, currency: 'PKR', breakdown: { base: 80, distance: 430, time: 100, stops: 30, min_fare_adjustment: 0 } },
  ],
});

/** The vehicle list as the booking sheet builds it (van has no quote: unavailable). */
export const galleryVehicleOptions = toVehicleOptions(vehicleTypes, galleryEstimates);

export const galleryRequest = toPendingRideRequest(
  {
    id: 5012,
    pickup_address: 'Liberty Market, Gulberg III, Lahore',
    dropoff_address: 'Emporium Mall, Johar Town, Lahore',
    passenger: { first_name: 'Ayesha', rating: '4.70' },
    estimated_distance: 1.8,
    estimated_pickup_min: 5,
    estimated_fare: 640,
    payment_method: 'cash',
    vehicle_type: 'rickshaw',
  },
  null,
);

// ---------- T-517 live vehicle motion (gallery only) ----------

/** A Gulberg block (Lahore) driven clockwise: four right-angle turns, ~2.3 km round. */
export const galleryBlockLoop = [
  { latitude: 31.512, longitude: 74.34 },
  { latitude: 31.512, longitude: 74.346 },
  { latitude: 31.507, longitude: 74.346 },
  { latitude: 31.507, longitude: 74.34 },
  { latitude: 31.512, longitude: 74.34 },
];
export const galleryLiveRegion = { latitude: 31.5095, longitude: 74.343, latitudeDelta: 0.0085, longitudeDelta: 0.0085 };
/** Simulated update interval of the gallery (faster than the real ~4 s, so the demo moves). */
export const GALLERY_LIVE_INTERVAL_MS = 2_000;
const GALLERY_LIVE_STEP_M = 40;
/** GPS-like noise across the road (metres): inside the 30 m snap, so the vehicles stay on it. */
const GALLERY_LIVE_NOISE_M = 6;

/**
 * Positions every GALLERY_LIVE_STEP_M metres around the loop, each pushed a few metres off the
 * road (deterministic, like GPS noise), as a driver's successive location updates.
 */
export const galleryLivePositions = (() => {
  const path = galleryBlockLoop;
  const cumulative = cumulativeMeters(path);
  const total = cumulative[cumulative.length - 1];
  const count = Math.floor(total / GALLERY_LIVE_STEP_M);
  return Array.from({ length: count }, (_, i) => {
    const { point, bearing } = pointAlong(path, cumulative, (i * GALLERY_LIVE_STEP_M) / total);
    const side = Math.sin(i * 1.7) * GALLERY_LIVE_NOISE_M;
    const across = (((bearing ?? 0) + 90) * Math.PI) / 180;
    const metresPerDegLat = 111_320;
    return {
      latitude: point.latitude + (Math.cos(across) * side) / metresPerDegLat,
      longitude: point.longitude + (Math.sin(across) * side) / (metresPerDegLat * Math.cos((point.latitude * Math.PI) / 180)),
    };
  });
})();

/** The three vehicle kinds, a third of the loop apart. */
export const galleryLiveVehicles = [
  { id: 'bike', vehicleType: 'bike', offset: 0 },
  { id: 'rickshaw', vehicleType: 'rickshaw', offset: Math.round(galleryLivePositions.length / 3) },
  { id: 'car', vehicleType: 'car', offset: Math.round((2 * galleryLivePositions.length) / 3) },
] as const;
