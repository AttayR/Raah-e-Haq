import { localizedCopy } from '../../../i18n/localizedCopy';

/** Static copy for the driver Drive sheet (T-605; UI-R4 Drive tab). Data values come from the API session. */
export const DRIVER_HOME_COPY = localizedCopy({
  openProfile: 'Open your profile',
  pendingApproval: 'Your driver account is pending approval. You can go online once it is approved.',
  accountCardTitle: 'Driver account',
  approvedToDrive: 'Ready to drive',
  waitingForApproval: 'Waiting for approval',
  approved: 'Approved',
  pending: 'Pending',
  statsUnavailable: "Couldn't load today's numbers right now.",
} as const);
