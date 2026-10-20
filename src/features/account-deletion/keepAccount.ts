import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import type { Dispatch, UnknownAction } from '@reduxjs/toolkit';
import { confirm } from '../../core/dialog';
import { logger } from '../../core/logging/logger';
import { toast } from '../../core/toast';
import { t } from '../../i18n';
import { accountDeletionCancelled } from '../../store/actions';
import { currentSessionEpoch } from '../../store/sessionEpoch';
import { authStorage } from '../../services/authStorage';
import { isDeletionScheduled } from '../../core/auth/normalizeUser';
import { accountDeletionApi, DELETION_CODES } from './api';

// Only plain actions are dispatched, so any of the app's dispatch types fits (no store import).
export type KeepAccountDispatch = Dispatch<UnknownAction>;

/** What the refused action was, for the question's body. */
export type ScheduledContext = 'booking' | 'online' | 'topUp';

const BODY = {
  booking: 'accountDeletion.scheduledBooking',
  online: 'accountDeletion.scheduledOnline',
  topUp: 'accountDeletion.scheduledTopUp',
} as const;

/** True for the 423 ACCOUNT_DELETION_SCHEDULED refusal (an ApiError or a thunk rejection). */
export const isDeletionScheduledRefusal = (error: { code?: string } | null | undefined): boolean =>
  error?.code === DELETION_CODES.scheduled;

/**
 * POST /account/deletion/cancel, then clears `deletion_scheduled_for` in the store so AuthFlow
 * routes to the tabs. Rejects with the request's error; the caller shows it.
 */
export const keepAccount = async (dispatch: KeepAccountDispatch): Promise<void> => {
  const epoch = currentSessionEpoch();
  await accountDeletionApi.cancel();
  dispatch(accountDeletionCancelled());
  // The cached user (cold start routing) must not keep the old date. Skipped if signed out meanwhile.
  try {
    const cached = await authStorage.getUser();
    if (cached && isDeletionScheduled(cached)) {
      await authStorage.saveUser({ ...cached, deletion_scheduled_for: null }, epoch);
    }
  } catch (error: unknown) {
    logger.debug('[account-deletion] could not update the cached user', { name: error instanceof Error ? error.name : typeof error });
  }
};

/**
 * A booking, going online or a top-up got 423 ACCOUNT_DELETION_SCHEDULED (the deletion was
 * scheduled after this screen loaded): asks "Keep my account?" and, on yes, cancels the
 * deletion (success Toast); "Not now" leaves things as they are (the next refused action asks
 * again, and the next profile read routes to AccountRestore). Resolves true when it was kept.
 */
export const offerKeepAccount = async (dispatch: KeepAccountDispatch, context: ScheduledContext): Promise<boolean> => {
  const keep = await confirm({
    title: t('accountDeletion.restoreTitle'),
    body: t(BODY[context]),
    confirmLabel: t('accountDeletion.restoreKeep'),
    cancelLabel: t('accountDeletion.notNow'),
  });
  if (!keep) return false;
  try {
    await keepAccount(dispatch);
    toast.success(t('accountDeletion.restored'));
    return true;
  } catch (error: unknown) {
    logger.debug('[account-deletion] keep failed', { name: error instanceof Error ? error.name : typeof error });
    toast.error(t('accountDeletion.restoreFailed'));
    return false;
  }
};

/**
 * "Keep my account" for AccountRestore and the already-scheduled Delete account screen (§D4):
 * POST /account/deletion/cancel; on success AuthFlow shows the tabs and a success Toast says so;
 * on failure `error` holds the inline Banner text ("Try again" calls `keep` again).
 */
export function useKeepAccount(): { keep: () => Promise<boolean>; keeping: boolean; error: string | null } {
  const dispatch = useDispatch<KeepAccountDispatch>();
  const [keeping, setKeeping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const keep = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setKeeping(true);
    setError(null);
    try {
      await keepAccount(dispatch);
      toast.success(t('accountDeletion.restored'));
      return true;
    } catch (cause: unknown) {
      logger.debug('[account-deletion] keep failed', { name: cause instanceof Error ? cause.name : typeof cause });
      if (mounted.current) setError(t('accountDeletion.restoreFailed'));
      return false;
    } finally {
      inFlight.current = false;
      if (mounted.current) setKeeping(false);
    }
  }, [dispatch]);
  return { keep, keeping, error };
}
