import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { useAppDispatch } from '../../store';
import { isStaleSessionRejection, uploadProfilePhoto } from '../../store/thunks/apiThunks';
import { firstFieldMessages, rejectionMessage } from '../../core/api/errors';
import { confirm } from '../../core/dialog';
import { toast } from '../../core/toast';
import { t } from '../../i18n';
import type { MultipartFile, User } from '../../services/api';
import { pickProfilePhoto, type PhotoSource, type PickProblem } from './picker';

export type ProfilePhotoPhase = 'idle' | 'uploading' | 'failed';

export interface ProfilePhotoState {
  phase: ProfilePhotoPhase;
  /** 0 to 1 while uploading. */
  progress: number;
  /** The picked local photo, shown in place of the current one while it uploads. */
  previewUri: string | null;
  /** Why the last upload failed (phase `failed`). */
  error: string | null;
}

const IDLE: ProfilePhotoState = { phase: 'idle', progress: 0, previewUri: null, error: null };

const PROBLEM_COPY: Record<Exclude<PickProblem, 'permission'>, string> = {
  unavailable: t('profilePhoto.cameraUnavailable'),
  wrongType: t('profilePhoto.wrongType'),
  tooLarge: t('profilePhoto.tooLarge'),
  failed: t('profilePhoto.pickFailed'),
};

/** Camera or photos access is off: explain why it is needed and offer the app's Settings page. */
const askForAccess = async (source: PhotoSource): Promise<void> => {
  const camera = source === 'camera';
  const open = await confirm({
    title: camera ? t('profilePhoto.cameraOffTitle') : t('profilePhoto.photosOffTitle'),
    body: camera ? t('profilePhoto.cameraOffBody') : t('profilePhoto.photosOffBody'),
    confirmLabel: t('profilePhoto.openSettings'),
    cancelLabel: t('profilePhoto.notNow'),
  });
  if (open) {
    Linking.openSettings().catch(() => undefined);
  }
};

/**
 * Change the profile photo (T-504), the same for passengers and drivers: pick (camera or
 * library, resized and compressed by the picker), show the local photo at once, upload it to
 * POST /profile/avatar with progress and a Cancel, and on success the store holds the server's
 * profile (new `profile_image_url`), so every avatar of the signed-in user follows. A failure or
 * a cancel rolls the avatar back to the current photo; a failed upload can be retried.
 */
export function useProfilePhoto({ onUploaded }: { onUploaded?: (user: User) => void } = {}) {
  const dispatch = useAppDispatch();
  const [state, setState] = useState<ProfilePhotoState>(IDLE);
  const lastFile = useRef<MultipartFile | null>(null);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const update = useCallback((next: ProfilePhotoState | ((prev: ProfilePhotoState) => ProfilePhotoState)) => {
    if (mounted.current) setState(next);
  }, []);

  const upload = useCallback(
    async (file: MultipartFile) => {
      if (controller.current) return;
      const abort = new AbortController();
      controller.current = abort;
      lastFile.current = file;
      update({ phase: 'uploading', progress: 0, previewUri: file.uri, error: null });
      const result = await dispatch(
        uploadProfilePhoto({
          file,
          signal: abort.signal,
          onProgress: (progress) => update((prev) => (prev.phase === 'uploading' ? { ...prev, progress } : prev)),
        }),
      );
      controller.current = null;
      if (uploadProfilePhoto.fulfilled.match(result)) {
        lastFile.current = null;
        update(IDLE);
        toast.success(t('profilePhoto.saved'));
        onUploadedRef.current?.(result.payload);
        return;
      }
      const payload = result.payload;
      // Cancelled by the user, or the session ended: back to the current photo, no message.
      if (abort.signal.aborted || payload?.kind === 'cancelled' || isStaleSessionRejection(payload)) {
        update(IDLE);
        return;
      }
      const message =
        firstFieldMessages(payload?.fieldErrors).avatar ?? rejectionMessage(payload, t('profilePhoto.failedTitle'));
      update({ phase: 'failed', progress: 0, previewUri: null, error: message });
    },
    [dispatch, update],
  );

  const choose = useCallback(
    async (source: PhotoSource) => {
      if (controller.current) return;
      const picked = await pickProfilePhoto(source);
      if (!picked) return;
      if ('problem' in picked) {
        if (picked.problem === 'permission') {
          await askForAccess(source);
        } else {
          toast.error(PROBLEM_COPY[picked.problem]);
        }
        return;
      }
      await upload(picked.file);
    },
    [upload],
  );

  const cancel = useCallback(() => controller.current?.abort(), []);

  const retry = useCallback(() => {
    if (lastFile.current) upload(lastFile.current);
  }, [upload]);

  const dismissError = useCallback(() => {
    lastFile.current = null;
    update(IDLE);
  }, [update]);

  return { state, choose, cancel, retry, dismissError };
}
