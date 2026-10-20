import type { BookingPlace } from '../ride-booking/buildRideRequest';
import type { Ride } from '../ride-history/types';
import type { SavedPlace } from '../saved-places/types';

/**
 * UI-R9 (passenger-home block 4, passenger-destination-search "Recent"): where the passenger
 * went lately, read from their own finished rides (GET /rides, newest first). Nothing is invented:
 * no rides, no recents.
 */
export interface RecentDestination {
  /** Stable key (the normalised address). */
  key: string;
  /** First part of the address (before the first comma). */
  title: string;
  /** The rest of the address; empty when the address has no comma. */
  subtitle: string;
  place: BookingPlace;
}

/**
 * Home chips: up to 3 recents (§8.3 chip row). The search lists up to 4: it shares Home's
 * 4-ride read (GET /rides?per_page=4, cached), so more could never be filled.
 */
export const HOME_RECENT_DESTINATIONS = 3;
export const SEARCH_RECENT_DESTINATIONS = 4;

/** About 75 m: a recent this close to a saved place is that place, not a second shortcut. */
const SAME_PLACE_DEGREES = 0.0007;

const NONE_HIDDEN: ReadonlySet<string> = new Set();

const normalise = (address: string): string => address.trim().replace(/\s+/g, ' ').toLowerCase();

/** "Liberty Market, Gulberg III, Lahore" → title "Liberty Market", subtitle "Gulberg III, Lahore". */
export const splitAddress = (address: string): { title: string; subtitle: string } => {
  const trimmed = address.trim();
  const comma = trimmed.indexOf(',');
  if (comma <= 0) return { title: trimmed, subtitle: '' };
  return { title: trimmed.slice(0, comma).trim(), subtitle: trimmed.slice(comma + 1).trim() };
};

const near = (a: { latitude: number; longitude: number }, lat: number, lng: number): boolean =>
  Math.abs(a.latitude - lat) < SAME_PLACE_DEGREES && Math.abs(a.longitude - lng) < SAME_PLACE_DEGREES;

/**
 * The drop-offs of completed rides, newest first, one per address, without the ones that are a
 * saved place already (same address or within ~75 m) or were removed from recents, capped at `max`.
 */
export const recentDestinations = (
  rides: ReadonlyArray<Ride>,
  savedPlaces: ReadonlyArray<SavedPlace>,
  max: number,
  /** UI-R9b: keys the passenger removed from recents on this phone. */
  hidden: ReadonlySet<string> = NONE_HIDDEN,
): RecentDestination[] => {
  const seen = new Set(savedPlaces.map(place => normalise(place.address)));
  const out: RecentDestination[] = [];
  for (const ride of rides) {
    if (out.length >= max) break;
    const point = ride.dropoffLocation;
    const address = ride.dropoffAddress?.trim();
    if (ride.status !== 'completed' || !point || !address) continue;
    const key = normalise(address);
    if (seen.has(key) || hidden.has(key) || savedPlaces.some(place => near(point, place.lat, place.lng))) continue;
    seen.add(key);
    out.push({
      key,
      ...splitAddress(address),
      place: { latitude: point.latitude, longitude: point.longitude, address },
    });
  }
  return out;
};
