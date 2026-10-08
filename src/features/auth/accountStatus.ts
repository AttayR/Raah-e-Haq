import type { User } from '../../services/api';
import {
  ACCOUNT_STATUS_VARIANTS,
  type AccountStatusVariant,
  type AccountStatusVariantCopy,
} from './copy/accountStatus';

/**
 * Which account-status variant to show (T-106). Reads only the normalised `status` and
 * `role` of apiAuth.user (never Firebase) and apiAuth.statusUnverified.
 */
export function resolveAccountStatusVariant(
  user: Pick<User, 'role' | 'status'>,
  statusUnverified: boolean,
): AccountStatusVariant {
  if (statusUnverified) {
    return 'unverified';
  }
  switch (user.status) {
    case 'pending':
      return user.role === 'driver' ? 'pendingDriver' : 'pendingPassenger';
    case 'suspended':
      return 'suspended';
    case 'rejected':
      return 'rejected';
    case 'inactive':
      return 'inactive';
    case 'active':
    default:
      // AuthFlow sends an active user here only without a role this app serves.
      return 'unsupportedRole';
  }
}

export interface AccountStatusView extends AccountStatusVariantCopy {
  variant: AccountStatusVariant;
  /** Shown under the message: the rejection_reason held in memory, when there is one. */
  reason: string | null;
  /** Pending drivers get the rejected-documents list (GET /profile/documents). */
  showRejectedDocuments: boolean;
}

export function accountStatusView(
  user: Pick<User, 'role' | 'status' | 'rejection_reason'>,
  statusUnverified: boolean,
): AccountStatusView {
  const variant = resolveAccountStatusVariant(user, statusUnverified);
  const copy = ACCOUNT_STATUS_VARIANTS[variant];
  const reason = user.rejection_reason?.trim() || null;
  return {
    ...copy,
    variant,
    // An active admin has nothing to wait for; an account without a role may be fixed.
    canCheckStatus: variant === 'unsupportedRole' ? user.role !== 'admin' : copy.canCheckStatus,
    reason: variant === 'rejected' || variant === 'suspended' ? reason : null,
    showRejectedDocuments: variant === 'pendingDriver',
  };
}
