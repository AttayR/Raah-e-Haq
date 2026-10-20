import type { BadgeTone, IconName } from '../../components/ui';
import { strings } from '../../i18n';
import type { DriverVehicle } from '../driver-profile/types';
import { DRIVER_DOCUMENTS_COPY as COPY } from './copy';
import type { DriverDocument, DriverDocumentStatus, DriverDocumentType } from './types';

/**
 * Vehicle & documents (UI-R17, driver-vehicle-documents.md §2): the summary case, the groups,
 * each document row's wording, the masked licence number and the expiry warning. Pure, and only
 * from the server's statuses and the profile's licence fields.
 */

export const IDENTITY_TYPES: ReadonlyArray<DriverDocumentType> = ['profile', 'cnic_front', 'cnic_back'];
export const VEHICLE_PHOTO_TYPES: ReadonlyArray<DriverDocumentType> = ['vehicle_front', 'vehicle_back', 'vehicle_left', 'vehicle_right'];

/** The documents of `types`, in the server's order (no re-sorting, §2.5). */
export const documentsOf = (documents: ReadonlyArray<DriverDocument>, types: ReadonlyArray<DriverDocumentType>): DriverDocument[] =>
  documents.filter((doc) => types.includes(doc.type));

export const DOCUMENT_ICON: Record<DriverDocumentType, IconName> = {
  profile: 'account',
  cnic_front: 'idCard',
  cnic_back: 'idCard',
  license: 'idCard',
  vehicle_front: 'camera',
  vehicle_back: 'camera',
  vehicle_left: 'camera',
  vehicle_right: 'camera',
};

export const DOCUMENT_TONE: Record<DriverDocumentStatus, BadgeTone> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
  missing: 'neutral',
};

export type SummaryCase = { kind: 'action'; count: number } | { kind: 'review'; count: number } | { kind: 'approved' } | null;

/** §2.1, first match wins: something to fix, then something in review, then all approved. */
export const summaryCase = (
  documents: ReadonlyArray<DriverDocument>,
  vehicles: ReadonlyArray<DriverVehicle> | null,
  allRequiredApproved: boolean,
): SummaryCase => {
  const cars = vehicles ?? [];
  const action =
    documents.filter((doc) => doc.status === 'rejected' || (doc.status === 'missing' && doc.required)).length +
    cars.filter((vehicle) => vehicle.status === 'rejected').length;
  if (action > 0) return { kind: 'action', count: action };
  const review = documents.filter((doc) => doc.status === 'pending').length + cars.filter((vehicle) => vehicle.status === 'pending').length;
  if (review > 0) return { kind: 'review', count: review };
  if (allRequiredApproved && documents.length > 0) return { kind: 'approved' };
  return null;
};

/** "12 Mar 2028": a plain date as a calendar date, a timestamp in the device's local day. */
export const shortDate = (value: string | null): string | null => {
  if (!value) return null;
  const f = strings().format;
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (plain) {
    const month = f.monthsShort[Number(plain[2]) - 1];
    return month ? `${Number(plain[3])} ${month} ${plain[1]}` : null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getDate()} ${f.monthsShort[date.getMonth()]} ${date.getFullYear()}`;
};

/** The line under a document's name, and its colour (§2.4). */
export const documentSubtitle = (doc: DriverDocument): { text: string; tone: 'textSecondary' | 'danger' } => {
  const date = shortDate(doc.updatedAt);
  switch (doc.status) {
    case 'approved':
      return { text: date ? COPY.approvedOn(date) : COPY.status.approved, tone: 'textSecondary' };
    case 'pending':
      return { text: date ? COPY.sentInReview(date) : COPY.inReview, tone: 'textSecondary' };
    case 'rejected':
      return { text: `${COPY.reasonLabel} ${doc.rejectionReason ?? COPY.noReason}`, tone: 'danger' };
    case 'missing':
      return { text: `${COPY.notUploaded}${doc.required ? '' : COPY.optionalSuffix}`, tone: 'textSecondary' };
  }
};

const MASK = '••••';

/**
 * "•••• 6789": never the full number on screen (privacy, screenshots). At most the last 4
 * characters and never more than length − 2; 4 characters or fewer show bullets only.
 */
export const maskLicence = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const shown = trimmed.length <= 4 ? 0 : Math.min(4, trimmed.length - 2);
  return shown > 0 ? `${MASK} ${trimmed.slice(-shown)}` : MASK;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const deviceToday = (now: Date): number => Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

/**
 * §2.3: the licence expires within 30 days (`expiring`) or has expired (`expired`), by calendar
 * dates against the device's date; null otherwise or when the date is unknown.
 */
export const licenceExpiry = (expiry: string | null | undefined, now: Date = new Date()): 'expiring' | 'expired' | null => {
  const match = expiry ? /^(\d{4})-(\d{2})-(\d{2})/.exec(expiry) : null;
  if (!match) return null;
  const days = Math.round((Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) - deviceToday(now)) / DAY_MS);
  if (days < 0) return 'expired';
  return days <= 30 ? 'expiring' : null;
};
