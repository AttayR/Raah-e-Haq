import { apiService, unwrap } from '../../services/api';
import { fillCopy, REJECTED_DOCUMENTS_COPY } from './copy/accountStatus';

/**
 * The driver's own documents and their review state (BE-32):
 * - GET  /profile/documents                        documents[] and vehicles[] with
 *                                                  verification_status + rejection_reason
 * - POST /profile/documents/{id}                   multipart `document` (a rejected document)
 * - POST /profile/vehicles/{id}/documents          multipart vehicle fields (a rejected vehicle)
 * Images only (JPEG/PNG, at most 5 MB). A 409 DOCUMENT_NOT_REJECTED means the item is no
 * longer rejected (changed meanwhile): refresh the list.
 * The response also carries signed file URLs; they are never kept here.
 */

export const VEHICLE_UPLOAD_FIELDS = [
  'front_image',
  'back_image',
  'left_image',
  'right_image',
  'insurance_document',
  'registration_document',
] as const;

export type VehicleUploadField = (typeof VEHICLE_UPLOAD_FIELDS)[number];

/** Server-side rule (DocumentsController IMAGE_RULES): jpeg/png/jpg, max 5120 KB. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES: readonly string[] = ['image/jpeg', 'image/jpg', 'image/png'];

export interface RejectedItem {
  /** Stable list key: `document-3`, `vehicle-7`. */
  key: string;
  kind: 'document' | 'vehicle';
  id: number;
  label: string;
  reason: string | null;
}

/** A picked image, ready for multipart. */
export interface UploadFile {
  uri: string;
  name: string;
  type: string;
}

type RawRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toId = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;

const toReason = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const humanise = (type: string): string => {
  const words = type.replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : REJECTED_DOCUMENTS_COPY.documentFallback;
};

const documentLabel = (type: unknown): string => {
  if (typeof type !== 'string' || type.trim() === '') {
    return REJECTED_DOCUMENTS_COPY.documentFallback;
  }
  return REJECTED_DOCUMENTS_COPY.documentTypes[type] ?? humanise(type);
};

const recordsOf = (list: unknown): RawRecord[] => (Array.isArray(list) ? list.filter(isRecord) : []);

const isRejected = (item: RawRecord): boolean => item.verification_status === 'rejected';

/** The rejected documents and vehicles in a GET /profile/documents `data` payload. */
export function toRejectedItems(data: unknown): RejectedItem[] {
  if (!isRecord(data)) {
    return [];
  }
  const items: RejectedItem[] = [];
  recordsOf(data.documents).filter(isRejected).forEach(doc => {
    const id = toId(doc.id);
    if (id !== null) {
      items.push({ key: `document-${id}`, kind: 'document', id, label: documentLabel(doc.document_type), reason: toReason(doc.rejection_reason) });
    }
  });
  // GET /profile/documents has no make/model/plate per vehicle (BE follow-up), so a vehicle is
  // named by its position in the driver's whole vehicle list: "Vehicle #2".
  recordsOf(data.vehicles).forEach((vehicle, index) => {
    const id = toId(vehicle.id);
    if (id !== null && isRejected(vehicle)) {
      const label = fillCopy(REJECTED_DOCUMENTS_COPY.vehicleNumbered, { n: index + 1 });
      items.push({ key: `vehicle-${id}`, kind: 'vehicle', id, label, reason: toReason(vehicle.rejection_reason) });
    }
  });
  return items;
}

/** Why a picked image cannot be sent, or null when it can (checked again by the server). */
export function uploadProblem(file: { type?: string; fileSize?: number }): string | null {
  if (!file.type || !ALLOWED_UPLOAD_TYPES.includes(file.type.toLowerCase())) {
    return REJECTED_DOCUMENTS_COPY.wrongType;
  }
  if (typeof file.fileSize === 'number' && file.fileSize > MAX_UPLOAD_BYTES) {
    return REJECTED_DOCUMENTS_COPY.tooLarge;
  }
  return null;
}

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

export const documentsApi = {
  async rejectedItems(): Promise<RejectedItem[]> {
    return toRejectedItems(unwrap(await apiService.get<unknown>('/profile/documents')));
  },

  async reuploadDocument(documentId: number, file: UploadFile): Promise<void> {
    const form = new FormData();
    form.append('document', file);
    unwrap(await apiService.post<unknown>(`/profile/documents/${documentId}`, form, MULTIPART));
  },

  async reuploadVehicle(vehicleId: number, files: Partial<Record<VehicleUploadField, UploadFile>>): Promise<void> {
    const form = new FormData();
    VEHICLE_UPLOAD_FIELDS.forEach(field => {
      const file = files[field];
      if (file) {
        form.append(field, file);
      }
    });
    unwrap(await apiService.post<unknown>(`/profile/vehicles/${vehicleId}/documents`, form, MULTIPART));
  },
};
