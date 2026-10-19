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
  chartLabel: 'Earnings per day',
  chartDay: (date: string, earnings: string, trips: number) =>
    `${date}: ${earnings} · ${trips} ${trips === 1 ? 'trip' : 'trips'}`,
  ridesTitle: 'Trips',
  emptyTitle: {
    day: 'No trips today',
    week: 'No trips this week',
    month: 'No trips this month',
  },
  emptyBody: 'Go online to start earning.',
  loadFailed: "Couldn't load earnings",
  retry: 'Try again',
  rideFare: (fare: string, commission: string) => `Fare ${fare} · commission ${commission}`,
  openRideHint: 'Opens the ride details',
  tripFallback: 'Trip',
} as const);
