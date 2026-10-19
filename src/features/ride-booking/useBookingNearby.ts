import type { LatLng } from 'react-native-maps';
import { useIsOffline } from '../../components/ui/Banner';
import { useNearbyDrivers } from '../../hooks/useNearbyDrivers';
import type { NearbyDriver, RideResource } from '../../services/rideService';
import { useNearbyFreshness } from '../nearby-vehicles';

type Options = {
  /** The pickup, else the passenger. */
  center: LatLng | null | undefined;
  /** The booking screen is focused (no reads under another screen). */
  focused: boolean;
  /** The ride in Redux (booked here or restored), else null. */
  ride: RideResource | null;
  /** The sheet shows the ride (or the request being sent), not a booking step. */
  requesting: boolean;
  /** The ride has ended (completed / cancelled): read again at once for the next booking. */
  rideEnded: boolean;
  /** A driver is being searched for (passenger-finding-driver.md). */
  searching: boolean;
  /** Choose ride is shown. */
  choosing: boolean;
  /** Choose ride's selected tier. */
  selectedTier: string | null;
  /** The chip may show (no ride, no focused search field). */
  chipShown: boolean;
};

export type BookingNearby = ReturnType<typeof useBookingNearby>;

/**
 * Nearby vehicles on the booking map (T-586, split out of PassengerMapScreen in the design
 * review): the BE-20 read for the tier on screen, its freshness, what the map draws and whether
 * the count chip shows (the route fit then keeps the drop-off pin above it). The zoom-based
 * overlap spread lives in the map (useOverlapSpread), so zooming does not re-render the screen.
 *
 * - Choose ride: the selected tier's vehicles (map-vehicles.md §3).
 * - Finding a driver (T-586 part 2, passenger-finding-driver.md § Request reach): the requested
 *   tier's vehicles stay under the pickup pulse, at the nearby poll pace (no extra request); the
 *   chip is hidden (the reach strip carries the numbers).
 * - A driver on the way and later: no nearby vehicles (only the assigned one).
 */
export const useBookingNearby = ({ center, focused, ride, requesting, rideEnded, searching, choosing, selectedTier, chipShown }: Options) => {
  const tier = choosing ? selectedTier : searching ? (ride?.vehicle_type ?? selectedTier) : null;
  const state = useNearbyDrivers(center, {
    enabled: focused && (!requesting || rideEnded || searching),
    refreshKey: ride ? `${ride.id}:${rideEnded ? 'ended' : 'active'}` : 'none',
    tier,
  });
  const freshness = useNearbyFreshness(state);
  const offline = useIsOffline();
  const drivers: NearbyDriver[] | null = !ride || searching ? state.drivers : null;
  return {
    state,
    freshness,
    tier,
    drivers,
    chipShown,
    // The chip renders nothing while idle or offline.
    chipVisible: chipShown && !offline && state.status !== 'idle',
  };
};
