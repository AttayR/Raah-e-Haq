/** The one navigation call Done needs (the passenger stack's `popTo`). */
export type DoneNavigator = { popTo: (name: 'PassengerTabs', params: { screen: 'Home' }) => void };

/**
 * Done (or Close) once a ride is over: back to Home. T-574: a parcel goes back to Home, where it
 * was sent from. T-582 (QA 2026-10-19): a ride does too, completed or cancelled, the same as
 * "Cancel request" (passenger-finding-driver.md "back to Home (peek)"), not the trip planner;
 * Home's "Where to?" starts the next one.
 */
export const leaveFinishedRide = (navigation: DoneNavigator): void => {
  navigation.popTo('PassengerTabs', { screen: 'Home' });
};
