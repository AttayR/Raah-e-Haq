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
import type { IllustrationBadgeTone } from '../../../components/ui/Illustration';
import { localizedCopy } from '../../../i18n/localizedCopy';

export interface AccountStatusVariantCopy {
  /** Main glyph of the duotone illustration (UI-R8, MaterialCommunityIcons). */
  icon: IconName;
  /** Small badge on the illustration (clock, cross, pause), or none. */
  badge: { icon: IconName; tone: IllustrationBadgeTone } | null;
  /** `h1` title. */
  title: string;
  /** One short paragraph under the title. Pending accounts get "Hi {name}." in front. */
  message: string;
  /**
   * Whether Check Status is offered. For unsupportedRole it is offered only when the account
   * has no role at all (that may be fixed on the server), never to an active admin.
   */
  canCheckStatus: boolean;
}

export type AccountStatusVariant =
  | 'pendingDriver'
  | 'pendingPassenger'
  | 'suspended'
  | 'rejected'
  | 'inactive'
  | 'unverified'
  | 'unsupportedRole';

/**
 * UI-R8 (auth-account-status): spec titles; no hardcoded review time and no promise of a
 * notification (the server sends none on approval).
 */
export const ACCOUNT_STATUS_VARIANTS: Record<AccountStatusVariant, AccountStatusVariantCopy> = localizedCopy({
  pendingDriver: {
    icon: 'applicationReview',
    badge: { icon: 'clock', tone: 'accent' },
    title: "We're reviewing your application",
    message: 'Our team checks your documents and vehicle before you can start driving.',
    canCheckStatus: true,
  },
  pendingPassenger: {
    icon: 'applicationReview',
    badge: { icon: 'clock', tone: 'accent' },
    title: "We're reviewing your account",
    message: 'You can book rides as soon as it is approved.',
    canCheckStatus: true,
  },
  suspended: {
    icon: 'shieldOff',
    badge: { icon: 'paused', tone: 'danger' },
    title: 'Your account is on hold',
    message: 'Contact support to find out why and what to do next.',
    canCheckStatus: true,
  },
  rejected: {
    icon: 'document',
    badge: { icon: 'failed', tone: 'danger' },
    title: "Your application wasn't approved",
    message: 'Contact support to find out why and what to do next.',
    canCheckStatus: true,
  },
  inactive: {
    icon: 'accountOff',
    badge: null,
    title: 'Your account is deactivated',
    message: 'Contact support to turn your account back on.',
    canCheckStatus: true,
  },
  unverified: {
    icon: 'help',
    badge: null,
    title: "We couldn't confirm your account",
    message: 'The server sent an unexpected answer, so we could not check your status. This is usually temporary.',
    canCheckStatus: true,
  },
  unsupportedRole: {
    icon: 'admin',
    badge: null,
    title: 'This app is for passengers and drivers',
    message:
      'Your account has no passenger or driver role. Admins use the web dashboard. Sign out and sign in with a passenger or driver account.',
    canCheckStatus: false,
  },
});

export const ACCOUNT_STATUS_COPY = localizedCopy({
  checkStatus: 'Check status',
  checkStatusHint: 'Checks whether your account has been approved',
  signOut: 'Sign out',
  signingOut: 'Signing out…',
  /** Pending accounts: in front of the message when the profile has a name. */
  greeting: (name: string) => `Hi ${name}.`,
  /** Pending driver, status unchanged after Check Status. */
  stillPending: 'Still in review. Please check again later.',
  /** Pending passenger (or any non-driver), status unchanged after Check Status. */
  stillPendingPassenger: 'Your account is not approved yet. Please check again later.',
  stillBlocked: 'Your account status has not changed.',
  approved: "You're approved. Welcome to Raah-e-Haq!",
  checkFailed: "Couldn't check right now. Try again.",
  reasonLabel: 'Reason',
  /** Rejected / suspended: the message when the server's reason is shown under it. */
  reasonFollowUp: 'Contact support if you have questions.',
  contactSupport: 'Contact support',
  supportSheetTitle: 'Contact support',
  emailSupportHint: 'Opens your email app',
  emailFailed: (email: string) => `Couldn't open your email app. Write to ${email}.`,
} as const);
