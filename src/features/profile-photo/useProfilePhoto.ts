import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { useAppDispatch } from '../../store';
import {
  isStaleSessionRejection,
  removeProfilePhoto,
  uploadProfilePhoto,
  type ProfilePhotoResult,
} from '../../store/thunks/apiThunks';
import { firstFieldMessages, rejectionMessage, type ThunkRejection } from '../../core/api/errors';
import { confirm } from '../../core/dialog';
import { toast } from '../../core/toast';
import { componentTokens, space } from '../../theme';
import { perLocale, t } from '../../i18n';
import type { MultipartFile, User } from '../../services/api';
import { pickProfilePhoto, type PhotoSource, type PickProblem } from './picker';

export type ProfilePhotoPhase = 'idle' | 'uploading' | 'removing' | 'failed';

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

const PROBLEM_COPY = perLocale((): Record<Exclude<PickProblem, 'permission'>, string> => ({
  unavailable: t('profilePhoto.cameraUnavailable'),
  wrongType: t('profilePhoto.wrongType'),
  tooLarge: t('profilePhoto.tooLarge'),
  failed: t('profilePhoto.pickFailed'),
}));

/** The Profile avatar (ProfilePhotoEditor) is this tall. */
export const PROFILE_PHOTO_SIZE = 96;

/**
 * Photo toasts sit below the Profile avatar, not over it (T-543 QA F2): the header bar, the
 * identity block's top padding, the avatar, then a small gap.
 */
export const PHOTO_TOAST_OFFSET = componentTokens.header.barHeight + space[4] + PROFILE_PHOTO_SIZE + space[2];
const TOAST_PLACEMENT = { topOffset: PHOTO_TOAST_OFFSET } as const;

/** BE-94: a driver can never remove their photo (DELETE /profile/avatar 422). */
export const PROFILE_PHOTO_REQUIRED = 'PROFILE_PHOTO_REQUIRED';

/**
 * The text for a refused photo change: 429 `rate_limited` names the wait (`retry_after`
 * seconds, 10 changes an hour shared by upload and remove), a 422 its field message, a driver's
 * PROFILE_PHOTO_REQUIRED the server's own sentence, anything else the API layer's message.
 */
export const photoRefusalMessage = (payload: ThunkRejection | undefined, fallback: string): string => {
  if (payload?.kind === 'rate_limited' || payload?.status === 429) {
    const seconds = payload.retryAfter;
    return seconds && seconds > 0
      ? t('profilePhoto.rateLimited', { minutes: Math.max(1, Math.ceil(seconds / 60)) })
      : t('profilePhoto.rateLimitedNoTime');
  }
  return firstFieldMessages(payload?.fieldErrors).avatar ?? rejectionMessage(payload, fallback);
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

type Options = {
  onUploaded?: (user: User) => void;
  /**
   * After a successful upload, show the server's `message` instead of "Profile photo updated."
   * (drivers, BE-94: "Photo submitted for review. Your current photo stays until it is approved.").
   */
  useServerMessage?: boolean;
};

const savedMessage = (result: ProfilePhotoResult, useServerMessage: boolean): string =>
  (useServerMessage ? result.message : null) ?? t('profilePhoto.saved');

/**
 * Change the profile photo (T-504), the same for passengers and drivers: pick (camera or
 * library, resized and compressed by the picker), show the local photo at once, upload it to
 * POST /profile/avatar with progress and a Cancel, and on success the store holds the server's
 * profile (new `profile_image_url`, or a driver's `pending_profile_image_url`, BE-94), so every
 * avatar of the signed-in user follows. A failure or a cancel rolls the avatar back to the
 * current photo; a failed upload can be retried. `remove` (passengers only) asks first, then
 * DELETE /profile/avatar.
 */
export function useProfilePhoto({ onUploaded, useServerMessage = false }: Options = {}) {
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
        toast.success(savedMessage(result.payload, useServerMessage), undefined, TOAST_PLACEMENT);
        onUploadedRef.current?.(result.payload.user);
        return;
      }
      const payload = result.payload;
      // Cancelled by the user, or the session ended: back to the current photo, no message.
      if (abort.signal.aborted || payload?.kind === 'cancelled' || isStaleSessionRejection(payload)) {
        update(IDLE);
        return;
      }
      const message = photoRefusalMessage(payload, t('profilePhoto.failedTitle'));
      update({ phase: 'failed', progress: 0, previewUri: null, error: message });
    },
    [dispatch, update, useServerMessage],
  );

  const remove = useCallback(async () => {
    if (controller.current) return;
    const ok = await confirm({
      title: t('profilePhoto.removeConfirmTitle'),
      body: t('profilePhoto.removeConfirmBody'),
      confirmLabel: t('profilePhoto.removeConfirm'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    lastFile.current = null;
    update({ ...IDLE, phase: 'removing' });
    const result = await dispatch(removeProfilePhoto());
    update(IDLE);
    if (removeProfilePhoto.fulfilled.match(result)) {
      toast.success(t('profilePhoto.removed'), undefined, TOAST_PLACEMENT);
      return;
    }
    const payload = result.payload;
    if (isStaleSessionRejection(payload)) return;
    // A driver (PROFILE_PHOTO_REQUIRED) gets the server's own sentence: upload a new one instead.
    toast.error(
      payload?.code === PROFILE_PHOTO_REQUIRED
        ? rejectionMessage(payload, t('profilePhoto.removeFailed'))
        : photoRefusalMessage(payload, t('profilePhoto.removeFailed')),
      undefined,
      TOAST_PLACEMENT,
    );
  }, [dispatch, update]);

  const choose = useCallback(
    async (source: PhotoSource) => {
      if (controller.current) return;
      const picked = await pickProfilePhoto(source);
      if (!picked) return;
      if ('problem' in picked) {
        if (picked.problem === 'permission') {
          await askForAccess(source);
        } else {
          toast.error(PROBLEM_COPY()[picked.problem], undefined, TOAST_PLACEMENT);
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

  return { state, choose, cancel, retry, dismissError, remove };
}
