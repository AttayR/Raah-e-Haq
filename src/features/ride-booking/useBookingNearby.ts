import type { LatLng } from 'react-native-maps';
import { useIsOffline } from '../../components/ui/Banner';
import { useNearbyDrivers } from '../../hooks/useNearbyDrivers';
import { useNearbyFreshness } from '../nearby-vehicles';

type Options = {
  /** The pickup, else the passenger. */
  center: LatLng | null | undefined;
  enabled: boolean;
  refreshKey: string;
  /** Choose ride's selected tier; null on the other steps (every vehicle). */
  tier: string | null;
  /** The chip shows (no ride, no focused search field). */
  chipShown: boolean;
};

/**
 * Nearby vehicles on the booking map (T-586, split out of PassengerMapScreen in the design
 * review): the BE-20 read for the selected tier, its freshness, and whether the count chip shows
 * (the route fit then keeps the drop-off pin above it). The zoom-based overlap spread lives in
 * the map (useOverlapSpread), so zooming does not re-render the screen.
 */
export const useBookingNearby = ({ center, enabled, refreshKey, tier, chipShown }: Options) => {
  const state = useNearbyDrivers(center, { enabled, refreshKey, tier });
  const freshness = useNearbyFreshness(state);
  const offline = useIsOffline();
  return {
    state,
    freshness,
    tier,
    // The chip renders nothing while idle or offline.
    chipVisible: chipShown && !offline && state.status !== 'idle',
  };
};
