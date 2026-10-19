/**
 * The chat thread route (T-510). Both role stacks (PassengerStack, DriverStack) register
 * `RideChat` with these params, so any screen inside either stack (tabs included) opens a
 * ride's thread the same way. A `chat_message` notification (T-502) routes here with
 * `data.ride_id`.
 */
export const RIDE_CHAT_ROUTE = 'RideChat' as const;

export type RideChatParams = {
  rideId: number;
  /** T-580: the other person's first name when the opener knows it (composer placeholder while loading). */
  name?: string;
};

/** Anything that can navigate to `RideChat`: a screen's `navigation` inside a role stack. */
export interface RideChatNavigator {
  navigate(name: typeof RIDE_CHAT_ROUTE, params: RideChatParams): void;
}

/**
 * The stacks' `getId` for `RideChat`: one screen per ride, so opening another ride's thread
 * pushes a fresh screen instead of reusing this one's messages and cursors.
 */
export const rideChatScreenId = ({ params }: { params: RideChatParams }): string => String(params.rideId);

export const openRideChat = (navigation: RideChatNavigator, rideId: number, name?: string | null): void => {
  const firstName = name?.trim();
  navigation.navigate(RIDE_CHAT_ROUTE, firstName ? { rideId, name: firstName } : { rideId });
};
