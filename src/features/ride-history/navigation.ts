import type { Ride } from './types';

/**
 * Ride history routes (T-501), registered in both role stacks so the screens (and the
 * Earnings and Wallet screens) navigate by these names in either stack.
 */
export type RideHistoryRoutes = {
  RideHistory: undefined;
  /** `ride` is the list row, shown while GET /rides/{id} loads. */
  RideDetails: { rideId: number; ride?: Ride };
};

export const RIDE_DETAILS_ROUTE = 'RideDetails' as const;

/** Anything that can navigate to `RideDetails`: a screen's `navigation` inside a role stack. */
export interface RideDetailsNavigator {
  navigate(name: typeof RIDE_DETAILS_ROUTE, params: RideHistoryRoutes['RideDetails']): void;
}

export const openRideDetails = (navigation: RideDetailsNavigator, rideId: number, ride?: Ride): void => {
  navigation.navigate(RIDE_DETAILS_ROUTE, ride ? { rideId, ride } : { rideId });
};

/** The stacks' `getId` for `RideDetails`: one screen per ride. */
export const rideDetailsScreenId = ({ params }: { params: RideHistoryRoutes['RideDetails'] }): string =>
  String(params.rideId);
