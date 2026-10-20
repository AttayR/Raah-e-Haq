import { localizedCopy } from '../../i18n/localizedCopy';

/** Static copy for stats and driver earnings (T-506, T-507). Figures come from BE-08. */
export const STATS_COPY = localizedCopy({
  // Passenger Home stat tiles.
  ridesLabel: 'Total rides',
  ratingLabel: 'Your rating',
  distanceLabel: 'Distance',
  spentLabel: 'Spent on rides',
  ratingNew: 'New',
  statsFailed: "Couldn't load your ride stats. Pull down to try again.",
  // Driver Home.
  todayEarnings: 'Earned today',
  todayTrips: 'Trips',
  todayOnline: 'Online time',
  acceptance: 'Acceptance',
  driverStatsFailed: "Couldn't load today's numbers. Pull down to try again.",
  // Earnings screen.
  periodLabel: 'Period',
  periodDay: 'Today',
  periodWeek: 'This week',
  periodMonth: 'This month',
  loadFailed: "Couldn't load earnings",
  retry: 'Try again',
} as const);
