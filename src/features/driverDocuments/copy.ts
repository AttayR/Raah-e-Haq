import type { DriverDocumentStatus, DriverDocumentType } from './types';
import { localizedCopy } from '../../i18n/localizedCopy';

/**
 * Static copy of the driver documents list (T-203): the pending-driver account-status screen
 * and Settings → Vehicle & documents. Server text (a rejection_reason, a 422 rule) is never
 * written here.
 */
export const DRIVER_DOCUMENTS_COPY = localizedCopy({
  title: 'Documents',
  screenTitle: 'Vehicle & documents',
  back: 'Back',
  intro: 'Each photo is reviewed by our team. Upload any item that is missing or was rejected.',
  allApproved: 'All required documents are approved.',
  loading: 'Loading your documents…',
  loadFailed: "Couldn't load your documents.",
  retry: 'Try again',
  empty: 'No documents to show yet.',
  required: 'Required',
  optional: 'Optional',
  upload: 'Upload',
  reupload: 'Re-upload',
  uploading: 'Uploading…',
  uploaded: 'Uploaded. It will be reviewed again.',
  uploadFailed: 'Upload failed. Please try again.',
  /** 409 DOCUMENT_NOT_REPLACEABLE: the item is in review or approved now. */
  alreadyChanged: 'This item was already updated. The list has been refreshed.',
  /** 409 NO_VEHICLE. */
  noVehicle: 'Add your vehicle before uploading vehicle photos.',
  rateLimited: 'Too many uploads. Please wait a minute and try again.',
  tooLarge: 'The photo is larger than 5 MB. Choose a smaller one.',
  wrongType: 'Choose a JPEG, PNG or GIF photo.',
  pickFailed: 'Could not open your photos.',
  noReason: 'No reason given.',
  reasonLabel: 'Reason:',
  // UI-R17 Vehicle & documents (driver-vehicle-documents.md §2, §3).
  summaryAction: (n: number) => (n === 1 ? '1 item needs your action' : `${n} items need your action`),
  summaryActionBody: 'Upload them again below. Our team checks each photo.',
  summaryReview: (n: number) => (n === 1 ? '1 item in review' : `${n} items in review`),
  summaryReviewBody: "Our team is checking them. You don't need to do anything.",
  summaryApproved: 'All documents approved',
  summaryApprovedBody: 'Nothing to do here.',
  groupIdentity: 'Identity',
  groupVehiclePhotos: 'Vehicle photos',
  approvedOn: (date: string) => `Approved · ${date}`,
  sentInReview: (date: string) => `Sent ${date} · in review`,
  inReview: 'In review',
  notUploaded: 'Not uploaded yet',
  optionalSuffix: ' · Optional',
  refreshFailed: "Couldn't refresh. Showing the last saved status.",
  footer: 'To change your vehicle or licence details, contact support.',
  status: {
    pending: 'In review',
    approved: 'Approved',
    rejected: 'Rejected',
    missing: 'Not uploaded',
  } satisfies Record<DriverDocumentStatus, string>,
  types: {
    profile: 'Profile photo',
    cnic_front: 'CNIC (front)',
    cnic_back: 'CNIC (back)',
    license: 'Driving licence',
    vehicle_front: 'Vehicle (front)',
    vehicle_back: 'Vehicle (back)',
    vehicle_left: 'Vehicle (left side)',
    vehicle_right: 'Vehicle (right side)',
  } satisfies Record<DriverDocumentType, string>,
} as const);
