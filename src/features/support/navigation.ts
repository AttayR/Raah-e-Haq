import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { rideTime } from '../ride-history/format';
import type { Ride } from '../ride-history/types';

/** The trip a new request is about, as the opener already has it (no extra request). */
export interface SupportTripPrefill {
  id: number;
  pickupAddress: string;
  dropoffAddress: string;
  /** When it ended (or was booked); null when unknown. */
  at: string | null;
}

/**
 * Help & support routes (UI-R18 §H), registered in both role stacks. Entry points: Account →
 * Help & support, a ride's details → "Get help with this ride", and a support push or inbox row
 * (`type: support`, `ticket_id`) → SupportTicket.
 */
export type SupportRoutes = {
  Support: undefined;
  SupportRequests: undefined;
  SupportTicket: { id: number };
  SupportNewRequest: { trip?: SupportTripPrefill; category?: string } | undefined;
};

export interface SupportNavigator {
  navigate(name: 'Support' | 'SupportRequests'): void;
  navigate(name: 'SupportTicket', params: SupportRoutes['SupportTicket']): void;
  navigate(name: 'SupportNewRequest', params?: SupportRoutes['SupportNewRequest']): void;
  navigate(name: 'RideDetails', params: { rideId: number }): void;
  navigate(name: 'RideHistory'): void;
  navigate(name: 'PassengerTabs', params: { screen: 'Activity'; params: { segment: 'rides' } }): void;
  replace(name: 'SupportTicket', params: SupportRoutes['SupportTicket']): void;
  goBack(): void;
  setOptions(options: { gestureEnabled: boolean }): void;
  dispatch: NavigationProp<ParamListBase>['dispatch'];
}

/** The stacks' `getId` for `SupportTicket`: one screen per ticket. */
export const supportTicketScreenId = ({ params }: { params: SupportRoutes['SupportTicket'] }): string => String(params.id);

/** A ride as the trip of a new request (ride details, Help's last trip). */
export const tripPrefillOf = (ride: Ride): SupportTripPrefill => ({
  id: ride.id,
  pickupAddress: ride.pickupAddress,
  dropoffAddress: ride.dropoffAddress,
  at: rideTime(ride),
});
