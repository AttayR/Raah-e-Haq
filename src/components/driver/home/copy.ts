/** Static copy for the driver Home tab (T-605). Data values come from the API session. */
export const DRIVER_HOME_COPY = {
  greetingMorning: 'Good morning',
  greetingAfternoon: 'Good afternoon',
  greetingEvening: 'Good evening',
  driverFallbackName: 'Driver',
  openProfile: 'Open your profile',
  pendingApproval: 'Your driver account is pending approval. You can go online once it is approved.',
  accountCardTitle: 'Driver account',
  approvedToDrive: 'Ready to drive',
  waitingForApproval: 'Waiting for approval',
  approved: 'Approved',
  pending: 'Pending',
  todayTitle: 'Today',
  statRides: 'Rides',
  statOnline: 'Online time',
  statRating: 'Rating',
  statsUnavailable: "Today's numbers aren't available yet.",
} as const;

/** Greeting for the device's local hour. */
export const greetingFor = (hour: number): string =>
  hour < 12
    ? DRIVER_HOME_COPY.greetingMorning
    : hour < 18
      ? DRIVER_HOME_COPY.greetingAfternoon
      : DRIVER_HOME_COPY.greetingEvening;
