import { launchCamera, launchImageLibrary, type Asset, type ImagePickerResponse } from 'react-native-image-picker';
import type { MultipartFile } from '../../services/api';

/** Where the new photo comes from (the action sheet's two rows). */
export type PhotoSource = 'camera' | 'library';

/**
 * POST /profile/avatar takes a JPEG, PNG or WebP of at most 2048 KB (BE-94; the server re-encodes
 * it to JPEG and strips its metadata). The
 * picker scales the photo so its longest side is at most 1024 px and re-encodes it as JPEG at
 * 0.8, which also drops the camera's EXIF block (GPS) on iOS and keeps only the orientation on
 * Android. A 1024 px JPEG at 0.8 is far below the limit; the size check below is a safety net.
 */
export const PROFILE_PHOTO_MAX_PX = 1024;
export const PROFILE_PHOTO_MAX_BYTES = 2048 * 1024;
export const PROFILE_PHOTO_TYPES: readonly string[] = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const COMMON = {
  mediaType: 'photo',
  maxWidth: PROFILE_PHOTO_MAX_PX,
  maxHeight: PROFILE_PHOTO_MAX_PX,
  quality: 0.8,
  includeBase64: false,
  includeExtra: false,
} as const;

export const PROFILE_LIBRARY_OPTIONS = { ...COMMON, selectionLimit: 1 } as const;
export const PROFILE_CAMERA_OPTIONS = { ...COMMON, cameraType: 'front', saveToPhotos: false } as const;

/** Why a pick produced no file. `permission`: camera or photos access is off for the app. */
export type PickProblem = 'permission' | 'unavailable' | 'wrongType' | 'tooLarge' | 'failed';

export type ProfilePhotoPick = { file: MultipartFile } | { problem: PickProblem } | null;

const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/webp': 'webp' };

/** Checks a picked asset against the server's rule; null when it can be sent. */
export function profilePhotoProblem(asset: Pick<Asset, 'type' | 'fileSize'>): PickProblem | null {
  if (!asset.type || !PROFILE_PHOTO_TYPES.includes(asset.type.toLowerCase())) {
    return 'wrongType';
  }
  if (typeof asset.fileSize === 'number' && asset.fileSize > PROFILE_PHOTO_MAX_BYTES) {
    return 'tooLarge';
  }
  return null;
}

const toPick = (result: ImagePickerResponse): ProfilePhotoPick => {
  if (result.didCancel) {
    return null;
  }
  if (result.errorCode === 'permission') {
    return { problem: 'permission' };
  }
  if (result.errorCode === 'camera_unavailable') {
    return { problem: 'unavailable' };
  }
  const asset = result.assets?.[0];
  if (result.errorCode || !asset?.uri) {
    return { problem: 'failed' };
  }
  const problem = profilePhotoProblem(asset);
  if (problem || !asset.type) {
    return { problem: problem ?? 'wrongType' };
  }
  const type = asset.type.toLowerCase() === 'image/jpg' ? 'image/jpeg' : asset.type.toLowerCase();
  const extension = EXTENSIONS[type] ?? 'jpg';
  return { file: { uri: asset.uri, name: asset.fileName || `avatar.${extension}`, type } };
};

/**
 * Opens the camera (front lens) or the photo library and returns one resized, compressed photo.
 * The system asks for camera access the first time (NSCameraUsageDescription); the library
 * uses the system photo picker, which needs no access prompt. Null: the user cancelled.
 */
export async function pickProfilePhoto(source: PhotoSource): Promise<ProfilePhotoPick> {
  try {
    const result =
      source === 'camera' ? await launchCamera(PROFILE_CAMERA_OPTIONS) : await launchImageLibrary(PROFILE_LIBRARY_OPTIONS);
    return toPick(result);
  } catch {
    return { problem: 'failed' };
  }
}
