import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError, type ApiError } from '../../core/api/errors';
import { logApiFailure } from '../../core/api/logApiFailure';
import { toast } from '../../core/toast';
import { driverDocumentsApi } from './api';
import { DRIVER_DOCUMENTS_COPY } from './copy';
import { pickDocumentImage } from './upload';
import type { DriverDocument, DriverDocumentType, UploadFile } from './types';

export type UploadOutcome = 'uploaded' | 'refreshed' | 'failed' | 'cancelled';

/** The message a refused upload shows (409 NOT_REPLACEABLE is handled by the caller). */
export function uploadErrorMessage(error: ApiError): string {
  if (error.code === 'NO_VEHICLE') {
    return DRIVER_DOCUMENTS_COPY.noVehicle;
  }
  switch (error.kind) {
    case 'validation': {
      // 422: the server's rule for the `document` field (size, type), else its message.
      const fieldMessage = error.fieldErrors.document?.[0];
      return fieldMessage || error.message || DRIVER_DOCUMENTS_COPY.uploadFailed;
    }
    case 'rate_limited':
      return DRIVER_DOCUMENTS_COPY.rateLimited;
    case 'network':
    case 'timeout':
      return error.message;
    default:
      return DRIVER_DOCUMENTS_COPY.uploadFailed;
  }
}

/**
 * The signed-in driver's documents (GET /driver/documents, BE-66) and the upload of a missing
 * or rejected one (POST /driver/documents/{type}). The list lives in this hook's state only:
 * nothing is written to Redux or storage, and the signed URLs are never kept (types.ts).
 */
export function useDriverDocuments(enabled = true) {
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [allRequiredApproved, setAllRequiredApproved] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<DriverDocumentType | null>(null);
  const mounted = useRef(true);
  const requestId = useRef(0);
  /** Set before the picker opens, so a second tap never opens another picker or upload. */
  const busy = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const apply = useCallback((next: { documents: DriverDocument[]; allRequiredApproved: boolean }) => {
    setDocuments(next.documents);
    setAllRequiredApproved(next.allRequiredApproved);
  }, []);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const next = await driverDocumentsApi.list();
      if (mounted.current && id === requestId.current) {
        apply(next);
      }
    } catch (err) {
      logApiFailure('useDriverDocuments#reload failed', err);
      if (mounted.current && id === requestId.current) {
        setError(DRIVER_DOCUMENTS_COPY.loadFailed);
      }
    } finally {
      if (mounted.current && id === requestId.current) {
        setLoading(false);
      }
    }
  }, [apply]);

  useEffect(() => {
    if (enabled) {
      reload();
    }
  }, [enabled, reload]);

  /** Sends one picked file; the list follows the response, a 409 NOT_REPLACEABLE reloads it. */
  const send = useCallback(
    async (type: DriverDocumentType, file: UploadFile): Promise<UploadOutcome> => {
      setUploadingType(type);
      let outcome: UploadOutcome = 'failed';
      try {
        const next = await driverDocumentsApi.upload(type, file);
        outcome = 'uploaded';
        toast.success(DRIVER_DOCUMENTS_COPY.uploaded);
        if (mounted.current) {
          // The response is the newest list: a reload still in flight must not overwrite it.
          requestId.current += 1;
          apply(next);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        const apiError = toApiError(err);
        logApiFailure('useDriverDocuments#upload failed', apiError);
        if (apiError.status === 409 && apiError.code !== 'NO_VEHICLE') {
          // DOCUMENT_NOT_REPLACEABLE: the item is in review or approved now.
          outcome = 'refreshed';
          toast.info(DRIVER_DOCUMENTS_COPY.alreadyChanged);
        } else {
          toast.error(uploadErrorMessage(apiError));
        }
      }
      if (mounted.current) {
        setUploadingType(null);
        if (outcome === 'refreshed') {
          reload();
        }
      }
      return outcome;
    },
    [apply, reload],
  );

  /** Picks a photo and uploads it for `type`; one picker or upload at a time. */
  const upload = useCallback(
    async (type: DriverDocumentType): Promise<UploadOutcome> => {
      if (busy.current) {
        return 'cancelled';
      }
      busy.current = true;
      try {
        const picked = await pickDocumentImage();
        if (!picked) {
          return 'cancelled';
        }
        if ('problem' in picked) {
          toast.error(picked.problem);
          return 'failed';
        }
        return await send(type, picked.file);
      } finally {
        busy.current = false;
      }
    },
    [send],
  );

  return { documents, allRequiredApproved, loading, error, uploadingType, reload, upload };
}
