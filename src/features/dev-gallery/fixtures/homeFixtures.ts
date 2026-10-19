/**
 * Kit gallery only (Debug): API-shaped saved places (GET /saved-places, BE-14) and finished rides
 * (GET /rides, BE-01) run through the real mappers, for the UI-R9 Home sheet and place search
 * previews. Never imported by a product screen.
 */
import { toRide } from '../../ride-history/api';
import type { Ride } from '../../ride-history/types';
import type { SavedPlace } from '../../saved-places/types';

export const gallerySavedPlaces: SavedPlace[] = [
  {
    id: 1,
    label: 'home',
    name: null,
    address: 'House 12, Street 4, Block N, Gulberg III, Lahore',
    lat: 31.5104,
    lng: 74.3442,
    placeId: null,
    sortOrder: 0,
    updatedAt: '2026-10-12T10:00:00+05:00',
  },
  {
    id: 2,
    label: 'work',
    name: null,
    address: 'Arfa Software Technology Park, Ferozepur Road, Lahore',
    lat: 31.4757,
    lng: 74.3426,
    placeId: null,
    sortOrder: 1,
    updatedAt: '2026-10-12T10:00:00+05:00',
  },
];

const rawRide = (id: number, dropoff: string, lat: number, lng: number, fare: number, at: string) => ({
  id,
  ride_id: `RH-GALLERY${id}`,
  status: 'completed',
  driver_id: 7,
  passenger_id: 3,
  pickup_address: 'House 12, Street 4, Block N, Gulberg III, Lahore',
  dropoff_address: dropoff,
  pickup_latitude: 31.5104,
  pickup_longitude: 74.3442,
  dropoff_latitude: lat,
  dropoff_longitude: lng,
  vehicle_type: 'car',
  total_fare: fare,
  payment_method: 'cash',
  payment_status: 'paid',
  stops: [],
  created_at: at,
  updated_at: at,
  requested_at: at,
  completed_at: at,
});

/** Newest first, as GET /rides returns them. */
export const galleryRecentRides: Ride[] = [
  rawRide(9101, 'Emporium Mall, Abdul Haque Road, Johar Town, Lahore', 31.4675, 74.2655, 640, '2026-10-18T19:20:00+05:00'),
  rawRide(9102, 'Liberty Market, Gulberg III, Lahore', 31.5108, 74.3449, 310, '2026-10-17T13:05:00+05:00'),
  rawRide(9103, 'Allama Iqbal International Airport, Lahore', 31.5216, 74.4036, 980, '2026-10-15T06:40:00+05:00'),
]
  .map(raw => toRide(raw))
  .filter((ride): ride is Ride => ride !== null);
