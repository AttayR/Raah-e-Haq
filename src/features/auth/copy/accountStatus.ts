/**
 * User-facing copy of the account-status screen (T-106, AUTH-01, DRV-12).
 *
 * This is the app's static copy file for the screen: every string the screen, its
 * components and hooks show lives here (no inline literals), so it can move into the i18n
 * catalogue (Urdu) as one unit. Dynamic text (the server's refusal message, a
 * rejection_reason) is never written here; it comes from the API.
 *
 * Variants (features/auth/accountStatus.ts resolveAccountStatusVariant):
 * - pendingDriver      driver awaiting admin approval (status pending)
 * - pendingPassenger   any other account awaiting approval (status pending)
 * - suspended          status suspended
 * - rejected           status rejected (the reason is shown when it is in memory)
 * - inactive           status inactive (deactivated)
 * - unverified         GET /auth/profile answered 2xx without a profile: status unknown
 * - unsupportedRole    active, but admin or no role this app serves
 */

import type { IconName } from '../../../components/ui/icons';
import { localizedCopy } from '../../../i18n/localizedCopy';

export type AccountStatusTone = 'pending' | 'danger' | 'info';

export interface AccountStatusVariantCopy {
  /** Kit icon name (MaterialCommunityIcons, T-533). */
  icon: IconName;
  tone: AccountStatusTone;
  /** Header line above the card. */
  heading: string;
  title: string;
  message: string;
  /** Short lines under the message (what to expect / what to do). */
  notes: string[];
  /**
   * Whether Check Status is offered. For unsupportedRole it is offered only when the account
   * has no role at all (that may be fixed on the server), never to an active admin.
   */
  canCheckStatus: boolean;
  /** Whether the support contact line is shown. */
  showSupport: boolean;
}

export type AccountStatusVariant =
  | 'pendingDriver'
  | 'pendingPassenger'
  | 'suspended'
  | 'rejected'
  | 'inactive'
  | 'unverified'
  | 'unsupportedRole';

export const ACCOUNT_STATUS_VARIANTS: Record<AccountStatusVariant, AccountStatusVariantCopy> = localizedCopy({
  pendingDriver: {
    icon: 'waiting',
    tone: 'pending',
    heading: 'Driver application',
    title: 'Application under review',
    message:
      'Our team is reviewing your documents and vehicle details. You can start driving as soon as your account is approved.',
    notes: [
      'Reviews usually take 24 to 48 hours.',
      'Your documents and their review status are listed below. Upload any that are missing or rejected.',
      'Tap Check Status to see whether you have been approved.',
    ],
    canCheckStatus: true,
    showSupport: false,
  },
  pendingPassenger: {
    icon: 'waiting',
    tone: 'pending',
    heading: 'Your account',
    title: 'Account awaiting approval',
    message: 'Your account is waiting for approval. You can book rides as soon as it is approved.',
    notes: ['Tap Check Status to see whether your account is ready.'],
    canCheckStatus: true,
    showSupport: false,
  },
  suspended: {
    icon: 'paused',
    tone: 'danger',
    heading: 'Your account',
    title: 'Account suspended',
    message: 'Your account has been suspended, so you cannot use the app right now.',
    notes: ['Contact support to find out why and how to restore your account.'],
    canCheckStatus: true,
    showSupport: true,
  },
  rejected: {
    icon: 'failed',
    tone: 'danger',
    heading: 'Your account',
    title: 'Application not approved',
    message: 'Your account application was not approved.',
    notes: ['Contact support if you think this is a mistake.'],
    canCheckStatus: true,
    showSupport: true,
  },
  inactive: {
    icon: 'blocked',
    tone: 'danger',
    heading: 'Your account',
    title: 'Account deactivated',
    message: 'Your account has been deactivated, so you cannot use the app right now.',
    notes: ['Contact support to reactivate your account.'],
    canCheckStatus: true,
    showSupport: true,
  },
  unverified: {
    icon: 'help',
    tone: 'info',
    heading: 'Your account',
    title: "We couldn't confirm your account",
    message:
      'The server sent an unexpected answer, so we could not check your account status. This is usually temporary.',
    notes: ['Tap Check Status to try again.'],
    canCheckStatus: true,
    showSupport: true,
  },
  unsupportedRole: {
    icon: 'admin',
    tone: 'info',
    heading: 'Your account',
    title: 'This app is for passengers and drivers',
    message:
      'Your account does not have a passenger or driver role, so there is nothing to show in this app. Admins use the web dashboard.',
    notes: ['Sign out and sign in with a passenger or driver account.'],
    canCheckStatus: false,
    showSupport: true,
  },
});

export const ACCOUNT_STATUS_COPY = localizedCopy({
  checkStatus: 'Check Status',
  checking: 'Checking…',
  signOut: 'Sign Out',
  signingOut: 'Signing out…',
  /** Pending driver, status unchanged after Check Status. */
  stillPending: 'Not approved yet. We will keep your application in review.',
  /** Pending passenger (or any non-driver), status unchanged after Check Status. */
  stillPendingPassenger: 'Your account is not approved yet. Please check again later.',
  stillBlocked: 'Your account status has not changed.',
  approved: 'Your account is approved. Welcome!',
  checkFailed: 'Could not check your status. Please try again.',
  reasonLabel: 'Reason',
  supportPrefix: 'Support:',
  /** Fallback name in the header when the profile has none. */
  fallbackName: 'Welcome',
} as const);
