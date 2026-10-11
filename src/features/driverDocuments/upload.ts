import { launchImageLibrary } from 'react-native-image-picker';
import { DRIVER_DOCUMENTS_COPY } from './copy';
import type { UploadFile } from './types';

/**
 * The server's image rule for registration and document uploads (BE-66/BE-68):
 * jpeg/png/jpg/gif, at most 5120 KB. Checked here first so a large photo gets a clear message
 * instead of a failed upload; the server checks again.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES: readonly string[] = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

/**
 * Picker options shared by registration and re-upload: the picker scales the photo down to
 * 2000 px and re-encodes it at 0.8, which keeps a phone photo well under 5 MB.
 */
export const DOCUMENT_PICKER_OPTIONS = {
  mediaType: 'photo',
  selectionLimit: 1,
  quality: 0.8,
  maxWidth: 2000,
  maxHeight: 2000,
  includeBase64: false,
} as const;

/** Why a picked image cannot be sent, or null when it can. */
export function uploadProblem(file: { type?: string; fileSize?: number }): string | null {
  if (!file.type || !ALLOWED_UPLOAD_TYPES.includes(file.type.toLowerCase())) {
    return DRIVER_DOCUMENTS_COPY.wrongType;
  }
  if (typeof file.fileSize === 'number' && file.fileSize > MAX_UPLOAD_BYTES) {
    return DRIVER_DOCUMENTS_COPY.tooLarge;
  }
  return null;
}

export type PickResult = { file: UploadFile } | { problem: string } | null;

const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/gif': 'gif' };

/** Picks one photo from the library and checks it against the server's rule (null: cancelled). */
export async function pickDocumentImage(): Promise<PickResult> {
  try {
    const result = await launchImageLibrary(DOCUMENT_PICKER_OPTIONS);
    if (result.didCancel) {
      return null;
    }
    const asset = result.assets?.[0];
    if (result.errorCode || !asset?.uri) {
      return { problem: DRIVER_DOCUMENTS_COPY.pickFailed };
    }
    const problem = uploadProblem(asset);
    if (problem || !asset.type) {
      return { problem: problem ?? DRIVER_DOCUMENTS_COPY.wrongType };
    }
    const extension = EXTENSIONS[asset.type.toLowerCase()] ?? 'jpg';
    return { file: { uri: asset.uri, name: asset.fileName || `upload.${extension}`, type: asset.type } };
  } catch {
    return { problem: DRIVER_DOCUMENTS_COPY.pickFailed };
  }
}
