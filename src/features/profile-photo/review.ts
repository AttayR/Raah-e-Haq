import { useCallback } from 'react';
import { useRemoteData } from '../../core/api/useRemoteData';
import { driverDocumentsApi } from '../driverDocuments/api';
import type { DriverDocumentsState } from '../driverDocuments/types';

/**
 * A driver's profile photo review (BE-66): POST /profile/avatar puts the `profile` item of
 * GET /driver/documents back to `pending`; an admin then approves or rejects it. Null when the
 * photo is approved, missing, or the review could not be read.
 */
export type PhotoReview = { status: 'pending' } | { status: 'rejected'; reason: string | null } | null;

export const toPhotoReview = (state: DriverDocumentsState): PhotoReview => {
  const item = state.documents.find((doc) => doc.type === 'profile');
  if (item?.status === 'pending') return { status: 'pending' };
  if (item?.status === 'rejected') return { status: 'rejected', reason: item.rejectionReason };
  return null;
};

const fetchPhotoReview = async (): Promise<PhotoReview> => toPhotoReview(await driverDocumentsApi.list());

/**
 * The driver's photo review, read while `enabled` (the Profile screen is focused). After an
 * upload, `markPending` shows the review at once and a quiet refresh confirms it.
 */
export function usePhotoReview(enabled: boolean) {
  const remote = useRemoteData<PhotoReview>({ fetch: fetchPhotoReview, fallbackError: '', enabled });
  const { setData, refresh } = remote;
  const markPending = useCallback(() => {
    setData({ status: 'pending' });
    refresh().catch(() => undefined);
  }, [refresh, setData]);
  return { review: remote.data ?? null, markPending };
}
