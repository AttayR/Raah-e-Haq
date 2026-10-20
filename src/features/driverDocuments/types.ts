/**
 * The driver's registration items under per-item review (BE-66, docs/api/CONTRACT_NOTES.md):
 * one entry per type, always all eight, in the server's order.
 */
export const DRIVER_DOCUMENT_TYPES = [
  'profile',
  'cnic_front',
  'cnic_back',
  'license',
  'vehicle_front',
  'vehicle_back',
  'vehicle_left',
  'vehicle_right',
] as const;

export type DriverDocumentType = (typeof DRIVER_DOCUMENT_TYPES)[number];

export const DRIVER_DOCUMENT_STATUSES = ['pending', 'approved', 'rejected', 'missing'] as const;

export type DriverDocumentStatus = (typeof DRIVER_DOCUMENT_STATUSES)[number];

/**
 * One item. The signed `url` of the payload is deliberately not kept: the list never shows
 * the files, so a short-lived link never outlives the request (no caching, no storage).
 */
export interface DriverDocument {
  type: DriverDocumentType;
  required: boolean;
  status: DriverDocumentStatus;
  /** Set only when `status` is `rejected`. */
  rejectionReason: string | null;
  canUpload: boolean;
  /** When the item last changed (upload or review), as sent; null when absent. */
  updatedAt: string | null;
}

export interface DriverDocumentsState {
  documents: DriverDocument[];
  allRequiredApproved: boolean;
}

/** A picked image, ready for multipart. */
export interface UploadFile {
  uri: string;
  name: string;
  type: string;
}
