import { launchCamera, type ImagePickerResponse } from 'react-native-image-picker';
import type { MultipartFile } from '../../services/api';
import type { PickProblem } from '../profile-photo/picker';

/**
 * The pickup photo of a parcel (BE-88: JPEG, PNG or WebP, at most 5120 KB; the server re-encodes
 * it and keeps it private). The camera only (a photo taken at the pickup, never one from the
 * library), the back lens, scaled to 1600 px at 0.7 like the document uploads (T-537), which also
 * drops the camera's EXIF block (GPS) on iOS. Same picker as the profile photo; no new native code.
 */
export const PARCEL_PHOTO_MAX_PX = 1600;
export const PARCEL_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PARCEL_PHOTO_TYPES: readonly string[] = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export const PARCEL_CAMERA_OPTIONS = {
  mediaType: 'photo',
  maxWidth: PARCEL_PHOTO_MAX_PX,
  maxHeight: PARCEL_PHOTO_MAX_PX,
  quality: 0.7,
  includeBase64: false,
  includeExtra: false,
  cameraType: 'back',
  saveToPhotos: false,
} as const;

export type ParcelPhotoPick = { file: MultipartFile } | { problem: PickProblem } | null;

const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/webp': 'webp' };

export const toParcelPhotoPick = (result: ImagePickerResponse): ParcelPhotoPick => {
  if (result.didCancel) return null;
  if (result.errorCode === 'permission') return { problem: 'permission' };
  if (result.errorCode === 'camera_unavailable') return { problem: 'unavailable' };
  const asset = result.assets?.[0];
  if (result.errorCode || !asset?.uri) return { problem: 'failed' };
  const type = asset.type?.toLowerCase();
  if (!type || !PARCEL_PHOTO_TYPES.includes(type)) return { problem: 'wrongType' };
  if (typeof asset.fileSize === 'number' && asset.fileSize > PARCEL_PHOTO_MAX_BYTES) return { problem: 'tooLarge' };
  const mime = type === 'image/jpg' ? 'image/jpeg' : type;
  return { file: { uri: asset.uri, name: `parcel.${EXTENSIONS[mime] ?? 'jpg'}`, type: mime } };
};

/** Opens the camera for the parcel photo. Null: the driver cancelled. */
export async function takeParcelPhoto(): Promise<ParcelPhotoPick> {
  try {
    return toParcelPhotoPick(await launchCamera(PARCEL_CAMERA_OPTIONS));
  } catch {
    return { problem: 'failed' };
  }
}
