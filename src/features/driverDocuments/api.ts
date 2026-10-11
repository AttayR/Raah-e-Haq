import { apiService, unwrap } from '../../services/api';
import {
  DRIVER_DOCUMENT_STATUSES,
  DRIVER_DOCUMENT_TYPES,
  type DriverDocument,
  type DriverDocumentType,
  type DriverDocumentsState,
  type UploadFile,
} from './types';

/**
 * Driver documents (BE-66):
 * - GET  /driver/documents          data: { documents[8], required_types, all_required_approved, expires_in }
 * - POST /driver/documents/{type}   multipart `document`; same body as the GET.
 *   409 DOCUMENT_NOT_REPLACEABLE (pending/approved: refresh), 409 NO_VEHICLE, 422 errors.document,
 *   429 (10/min), 404 unknown type.
 * Both answer `Cache-Control: private, no-store`; nothing here is persisted.
 */

type RawRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toType = (value: unknown): DriverDocumentType | null =>
  DRIVER_DOCUMENT_TYPES.find((known) => known === value) ?? null;

const toReason = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const toDocument = (raw: RawRecord): DriverDocument | null => {
  const type = toType(raw.type);
  if (!type) {
    return null;
  }
  // An unknown status reads as "in review", and only the server's can_upload offers an upload.
  const status = DRIVER_DOCUMENT_STATUSES.find((known) => known === raw.status) ?? 'pending';
  return {
    type,
    required: raw.required === true,
    status,
    rejectionReason: status === 'rejected' ? toReason(raw.rejection_reason) : null,
    canUpload: raw.can_upload === true,
  };
};

/** A GET/POST /driver/documents `data` payload, in the server's order; unknown types dropped. */
export function toDriverDocuments(data: unknown): DriverDocumentsState {
  if (!isRecord(data) || !Array.isArray(data.documents)) {
    return { documents: [], allRequiredApproved: false };
  }
  const documents = data.documents
    .filter(isRecord)
    .map(toDocument)
    .filter((doc): doc is DriverDocument => doc !== null);
  return { documents, allRequiredApproved: data.all_required_approved === true };
}

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

export const driverDocumentsApi = {
  async list(): Promise<DriverDocumentsState> {
    return toDriverDocuments(unwrap(await apiService.get<unknown>('/driver/documents')));
  },

  /** Uploads one missing or rejected item; resolves with the refreshed list from the response. */
  async upload(type: DriverDocumentType, file: UploadFile): Promise<DriverDocumentsState> {
    const form = new FormData();
    form.append('document', file);
    return toDriverDocuments(unwrap(await apiService.post<unknown>(`/driver/documents/${type}`, form, MULTIPART)));
  },
};
