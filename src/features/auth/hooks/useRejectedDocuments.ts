import { useCallback, useEffect, useRef, useState } from 'react';
import { launchImageLibrary } from 'react-native-image-picker';
import { toApiError } from '../../../core/api/errors';
import { logApiFailure } from '../../../core/api/logApiFailure';
import { toast } from '../../../core/toast';
import { REJECTED_DOCUMENTS_COPY } from '../copy/accountStatus';
import {
  documentsApi,
  uploadProblem,
  type RejectedItem,
  type UploadFile,
  type VehicleUploadField,
} from '../documentsApi';

/** Kinds whose message is safe to show as is (422 field rules, offline, throttled). */
const USER_FACING_UPLOAD_KINDS: ReadonlySet<string> = new Set(['validation', 'network', 'timeout', 'rate_limited']);

export type PickResult = { file: UploadFile } | { problem: string } | null;

/** Picks one photo from the library and checks it against the server's rules (null: cancelled). */
export async function pickUploadImage(): Promise<PickResult> {
  try {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.8,
      maxWidth: 2000,
      maxHeight: 2000,
    });
    if (result.didCancel) {
      return null;
    }
    const asset = result.assets?.[0];
    if (result.errorCode || !asset?.uri) {
      return { problem: REJECTED_DOCUMENTS_COPY.pickFailed };
    }
    const problem = uploadProblem(asset);
    if (problem || !asset.type) {
      return { problem: problem ?? REJECTED_DOCUMENTS_COPY.wrongType };
    }
    const extension = asset.type.toLowerCase() === 'image/png' ? 'png' : 'jpg';
    return { file: { uri: asset.uri, name: asset.fileName || `upload.${extension}`, type: asset.type } };
  } catch {
    return { problem: REJECTED_DOCUMENTS_COPY.pickFailed };
  }
}

/**
 * A pending driver's rejected documents and vehicles (GET /profile/documents) and their
 * re-upload (BE-32). A 409 means the item is no longer rejected: the list is refreshed.
 */
export function useRejectedDocuments(enabled: boolean) {
  const [items, setItems] = useState<RejectedItem[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const mounted = useRef(true);
  const requestId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const next = await documentsApi.rejectedItems();
      if (mounted.current && id === requestId.current) {
        setItems(next);
      }
    } catch (err) {
      logApiFailure('useRejectedDocuments#reload failed', err);
      if (mounted.current && id === requestId.current) {
        setError(REJECTED_DOCUMENTS_COPY.loadFailed);
      }
    } finally {
      if (mounted.current && id === requestId.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      reload();
    }
  }, [enabled, reload]);

  /** Runs one upload; true when the server accepted it. */
  const send = useCallback(
    async (item: RejectedItem, upload: () => Promise<void>): Promise<boolean> => {
      setUploadingKey(item.key);
      let accepted = false;
      let stale = false;
      try {
        await upload();
        accepted = true;
        stale = true;
        toast.success(REJECTED_DOCUMENTS_COPY.uploaded);
      } catch (err) {
        const apiError = toApiError(err);
        logApiFailure('useRejectedDocuments#upload failed', apiError);
        if (apiError.status === 409) {
          stale = true;
          toast.info(REJECTED_DOCUMENTS_COPY.alreadyChanged);
        } else if (USER_FACING_UPLOAD_KINDS.has(apiError.kind) && apiError.message) {
          toast.error(apiError.message);
        } else {
          toast.error(REJECTED_DOCUMENTS_COPY.uploadFailed);
        }
      }
      if (mounted.current) {
        setUploadingKey(null);
        // Back in review, or changed meanwhile (409): either way the list is out of date.
        if (stale) {
          reload();
        }
      }
      return accepted;
    },
    [reload],
  );

  const reuploadDocument = useCallback(
    async (item: RejectedItem): Promise<boolean> => {
      const picked = await pickUploadImage();
      if (!picked) {
        return false;
      }
      if ('problem' in picked) {
        toast.error(picked.problem);
        return false;
      }
      return send(item, () => documentsApi.reuploadDocument(item.id, picked.file));
    },
    [send],
  );

  const reuploadVehicle = useCallback(
    (item: RejectedItem, files: Partial<Record<VehicleUploadField, UploadFile>>): Promise<boolean> =>
      send(item, () => documentsApi.reuploadVehicle(item.id, files)),
    [send],
  );

  return { items, loading, error, uploadingKey, reload, reuploadDocument, reuploadVehicle };
}
