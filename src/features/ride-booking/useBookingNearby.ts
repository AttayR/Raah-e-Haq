import { useMemo, useRef } from 'react';
import type { LatLng } from 'react-native-maps';
import { useIsOffline } from '../../components/ui/Banner';
import { useNearbyDrivers } from '../../hooks/useNearbyDrivers';
import type { NearbyDriver, RideResource } from '../../services/rideService';
import { useNearbyFreshness } from '../nearby-vehicles';
import { reachMarksFor, useRequestReach, type ReachMarks } from '../active-ride/reach';

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

const ID_SEP = '\n';
const splitIds = (key: string): string[] => (key === '' ? [] : key.split(ID_SEP));

/**
 * BE-119 marks for the drawn nearby answer, as one object per change of the ids (not per poll),
 * so the memoised map and markers skip polls that change nothing.
 *
 * The server names ids only when the passenger's nearby read was under 30 s before the ride read
 * (the nearby poll runs every 15 s, so most ride reads carry them). A ride read without matching
 * ids keeps the last matching set while the same nearby answer is drawn (no ring flicker between
 * polls); a new nearby answer, women mode (null counts), a new search round or the end of the
 * search drops it.
 */
const useReachMarks = (ride: RideResource | null, searching: boolean, fineEpoch: string | null | undefined): ReachMarks | null => {
  const reach = useRequestReach(ride, searching);
  const held = useRef<{ round: string; epoch: string; marks: ReachMarks } | null>(null);
  const round = ride ? `${ride.id}:${ride.requeue_count ?? 0}` : '';
  let marks = searching ? reachMarksFor(reach, fineEpoch) : null;
  if (marks && fineEpoch) held.current = { round, epoch: fineEpoch, marks };
  else if (!searching || !reach || reach.sent === null || !fineEpoch) held.current = null;
  else if (held.current && held.current.round === round && held.current.epoch === fineEpoch) marks = held.current.marks;
  const sentKey = marks ? [...marks.sent].sort().join(ID_SEP) : null;
  const viewingKey = marks ? [...marks.viewing].sort().join(ID_SEP) : null;
  return useMemo(
    () => (sentKey === null || viewingKey === null ? null : { sent: new Set(splitIds(sentKey)), viewing: new Set(splitIds(viewingKey)) }),
    [sentKey, viewingKey],
  );
};

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
 * - BE-119 (Phase 2): while searching, `reachMarks` names the drawn markers the request was sent
 *   to and those viewing it, only when the ride's `reach.epoch` is the drawn answer's
 *   `meta.fine_epoch`. Read from the ride and nearby polls already running (no request).
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
  // Phase 2 (passenger-finding-driver.md): only while searching, only on the answer the ids name.
  const reachMarks = useReachMarks(ride, searching, state.fineEpoch);
  return {
    state,
    freshness,
    tier,
    drivers,
    reachMarks,
    chipShown,
    // The chip renders nothing while idle or offline.
    chipVisible: chipShown && !offline && state.status !== 'idle',
  };
};
