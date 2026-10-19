import { TabActions, type NavigationAction } from '@react-navigation/native';

type NestedState = { key?: string; routeNames?: string[] };

/** What Done needs from the passenger stack's navigation. */
export type DoneNavigator = {
  popTo: (name: 'PassengerTabs', params: { screen: 'Home' }) => void;
  getState: () => { routes: ReadonlyArray<{ name: string; state?: NestedState }> };
  dispatch: (action: NavigationAction) => void;
};

/**
 * Done (or Close) once a ride is over: back to Home. T-574: a parcel goes back to Home, where it
 * was sent from. T-582 (QA 2026-10-19): a ride does too, completed or cancelled, the same as
 * "Cancel request" (passenger-finding-driver.md "back to Home (peek)"), not the trip planner;
 * Home's "Where to?" starts the next one.
 *
 * T-588 (owner live session 2026-10-19): a ride opened from another tab (Inbox, Activity) could
 * leave that tab selected. `popTo`'s `{ screen: 'Home' }` only reaches the tabs when their
 * navigator re-reads its params on its next render, so Home is also selected directly on the tab
 * navigator (a no-op when it already is). Done, Close and the ended-panel swipe/back all use this.
 */
export const leaveFinishedRide = (navigation: DoneNavigator): void => {
  const tabs = navigation.getState().routes.find((route) => route.name === 'PassengerTabs')?.state;
  navigation.popTo('PassengerTabs', { screen: 'Home' });
  if (tabs?.key && tabs.routeNames?.includes('Home')) {
    navigation.dispatch({ ...TabActions.jumpTo('Home'), target: tabs.key });
  }
};

type BackState = {
  /** Finding a driver (POST /rides in flight, or `requested`). */
  searching: boolean;
  /** Finding a driver for a ride the server has created (it can be cancelled). */
  findingWithRide: boolean;
  /** The ride on screen ended cancelled (its outcome panel, or "No driver found"). */
  cancelled: boolean;
  /** "No driver found" → Try again: its POST /rides is in flight (the iOS swipe is held too). */
  retrying: boolean;
};

const ignore = (): void => undefined;

/**
 * The booking map's Back (UI-R10, T-584): no on-screen chevron while finding a driver or on a
 * cancelled ride's panel, whose Done / Close is the way out; Android back then asks to cancel the
 * request, or leaves the cancelled ride for Home, the same as Done; it does nothing while Try again
 * books the trip again.
 */
export const bookingBackHandlers = (
  state: BackState,
  actions: { back: () => void; cancel: () => void; finish: () => void },
): { onScreen: (() => void) | undefined; hardware: () => void } => ({
  onScreen: state.searching || state.cancelled ? undefined : actions.back,
  hardware: state.retrying ? ignore : state.findingWithRide ? actions.cancel : state.cancelled ? actions.finish : actions.back,
});
