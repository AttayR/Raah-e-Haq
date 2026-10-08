import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { getUserProfile, isStaleSessionRejection } from '../../../store/thunks/apiThunks';
import { refusedAccountStatus, routesHome } from '../../../core/auth/normalizeUser';
import { toast } from '../../../core/toast';
import type { User } from '../../../services/api';
import type { ThunkRejection } from '../../../core/api/errors';
import { ACCOUNT_STATUS_COPY } from '../copy/accountStatus';

// Typed locally (not useAppDispatch) so this hook does not import the store singleton.
type AppThunkDispatch = ThunkDispatch<{ apiAuth: { user: User | null } }, unknown, UnknownAction>;

/** Kinds whose ApiError message is our own user-facing copy (offline, slow, throttled). */
const SHOW_MESSAGE_KINDS: ReadonlySet<ThunkRejection['kind']> = new Set(['network', 'timeout', 'rate_limited', 'server']);

/** Status unchanged after Check Status: driver and passenger wording differ for pending. */
const stillMessage = (user: Pick<User, 'status' | 'role'>): string => {
  if (user.status !== 'pending') {
    return ACCOUNT_STATUS_COPY.stillBlocked;
  }
  return user.role === 'driver' ? ACCOUNT_STATUS_COPY.stillPending : ACCOUNT_STATUS_COPY.stillPendingPassenger;
};


/**
 * "Check Status" on the account-status screen (T-106): GET /auth/profile through
 * getUserProfile. AuthFlow routes on apiAuth.user, so an approved / reactivated account goes
 * home by itself once the profile says active. A 403 ACCOUNT_* merges the refused status (the
 * screen switches variant); a 401 is the normal sign-out (T-104). Anything else shows an
 * inline error. `check` resolves true when the account is now routable (AuthFlow is leaving
 * this screen).
 */
export function useCheckAccountStatus(current: Pick<User, 'status'>) {
  const dispatch = useDispatch<AppThunkDispatch>();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const statusBefore = useRef(current.status);
  statusBefore.current = current.status;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const check = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) {
      return false;
    }
    inFlight.current = true;
    const before = statusBefore.current;
    setChecking(true);
    setError(null);
    try {
      const result = await dispatch(getUserProfile());
      if (getUserProfile.fulfilled.match(result)) {
        const user = result.payload;
        if (routesHome(user)) {
          toast.success(ACCOUNT_STATUS_COPY.approved);
          return true;
        }
        if (user.status === before) {
          toast.info(stillMessage(user));
        }
        return false;
      }
      const rejection = result.payload;
      if (!rejection || isStaleSessionRejection(rejection) || rejection.status === 401) {
        // Signed out meanwhile, or the token is dead and T-104 is signing out.
        return false;
      }
      const refused = refusedAccountStatus(rejection);
      if (refused) {
        if (refused === before) {
          toast.info(ACCOUNT_STATUS_COPY.stillBlocked);
        }
        return false;
      }
      if (mounted.current) {
        setError(SHOW_MESSAGE_KINDS.has(rejection.kind) && rejection.message ? rejection.message : ACCOUNT_STATUS_COPY.checkFailed);
      }
      return false;
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setChecking(false);
      }
    }
  }, [dispatch]);

  return { check, checking, error };
}
