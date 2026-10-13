import type { AccountStatus } from '../../../services/api';

/** Static copy for the passenger Account tab and Profile view (T-618; the tab title is `nav.account`, UI-R4). */
export const PASSENGER_SETTINGS_COPY = {
  passengerFallbackName: 'Rider',
  roleLabel: 'Rider',
  openProfileHint: 'Opens your profile',
  accountGroup: 'Your account',
  savedPlaces: 'Saved places',
  savedPlacesSubtitle: 'Home, work and favourites',
  notificationsGroup: 'Notifications',
  notifications: 'Notifications',
  notificationsSubtitle: 'Choose which alerts you get',
  phoneNotifications: 'Phone notification settings',
  phoneNotificationsSubtitle: 'Allow or block alerts for Raah-e-Haq',
  appGroup: 'App',
  signOut: 'Sign out',
  signingOut: 'Signing out…',
  // Profile view
  profileTitle: 'Profile',
  back: 'Back',
  memberSince: 'Member since',
  personalInfo: 'Personal info',
  phone: 'Phone',
  email: 'Email',
  gender: 'Gender',
  dateOfBirth: 'Date of birth',
  verified: 'Verified',
  noDetails: 'No personal details yet',
} as const;

/**
 * The one word for an account status, shared by the Settings card and the Profile view so the
 * two never disagree. Active accounts show no badge. `inactive` is also the placeholder status
 * before the server confirms the session (normalizeUser UNKNOWN_STATUS), so it shows nothing;
 * suspended and rejected accounts never reach these screens (account-status screen).
 */
export const accountStatusBadge = (
  status: AccountStatus | undefined | null,
): { label: string; tone: 'warning' } | null =>
  status === 'pending' ? { label: 'Pending approval', tone: 'warning' } : null;
