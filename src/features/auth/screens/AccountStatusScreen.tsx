import React, { useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { User } from '../../../services/api';
import { useLogout } from '../../../hooks/useLogout';
import { accountStatusView } from '../accountStatus';
import { useCheckAccountStatus } from '../hooks/useCheckAccountStatus';
import { useDriverDocuments } from '../../driverDocuments/hooks';
import { DriverDocumentsList } from '../../driverDocuments/components/DriverDocumentsList';
import { AccountStatusLayout } from '../components/AccountStatusLayout';

type AccountStatusState = { apiAuth: { user: User | null; statusUnverified: boolean } };

/** If AuthFlow ever renders this without a user: treat it as "status unknown" (sign out works). */
const NO_USER: Pick<User, 'role' | 'status' | 'rejection_reason' | 'name'> = {
  role: null,
  status: 'inactive',
  rejection_reason: null,
  name: '',
};

/**
 * Account status (T-106, AUTH-01, DRV-12; UI-R8 docs/design/screens/auth-account-status.md):
 * AuthFlow shows it for any signed-in user who is not active, or active without a role this app
 * serves. It reads only apiAuth (never Firebase); copy per role and status comes from
 * features/auth/copy/accountStatus.
 * - Header: no back, "Sign out" text action: the single logout (T-102) with its confirm dialog,
 *   which clears the local session even when /auth/logout answers 403 for a blocked account.
 * - Illustration, title, message and (rejected / suspended) the server's reason.
 * - Pending drivers: their documents (GET /driver/documents) with status, reason and upload (T-203).
 * - Sticky bottom actions within thumb reach (layout: components/AccountStatusLayout): "Check status" (GET /auth/profile; AuthFlow routes
 *   home once the account is active; pull to refresh does the same) and "Contact support" (sheet).
 */
export default function AccountStatusScreen() {
  const user = useSelector((state: AccountStatusState) => state.apiAuth.user) ?? NO_USER;
  const statusUnverified = useSelector((state: AccountStatusState) => state.apiAuth.statusUnverified);
  const view = accountStatusView(user, statusUnverified || user === NO_USER);

  const { confirmLogout, isLoggingOut } = useLogout();
  const { check, checking, error } = useCheckAccountStatus(user);
  const documents = useDriverDocuments(view.showDocuments);

  const onCheckStatus = useCallback(async () => {
    const routable = await check();
    // Routable: AuthFlow is unmounting this screen, so the list is not reloaded.
    if (!routable && view.showDocuments) {
      documents.reload();
    }
  }, [check, view.showDocuments, documents]);

  return (
    <AccountStatusLayout
      view={view}
      name={user.name}
      checking={checking}
      error={error}
      isLoggingOut={isLoggingOut}
      onCheckStatus={onCheckStatus}
      onSignOut={confirmLogout}
      documents={
        view.showDocuments ? (
          <DriverDocumentsList
            documents={documents.documents}
            allRequiredApproved={documents.allRequiredApproved}
            loading={documents.loading}
            error={documents.error}
            uploadingType={documents.uploadingType}
            onRetry={documents.reload}
            onUpload={(type) => {
              documents.upload(type);
            }}
          />
        ) : null
      }
    />
  );
}
