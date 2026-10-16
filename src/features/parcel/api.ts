import { apiService, unwrap, AVATAR_UPLOAD_TIMEOUT_MS, type MultipartFile } from '../../services/api';
import type { RideResource } from '../../services/rideService';
import { isRecord, readNumberOrNull, readOneOf, readText } from '../../core/api/read';
import { toCallSession } from '../safety/api';
import type { CallSession } from '../safety/types';
import type {
  ParcelChoice,
  ParcelCodeState,
  ParcelOptIn,
  ParcelOptions,
  ParcelSize,
  ParcelStatus,
  ParcelView,
} from './types';

/**
 * Parcel delivery by bike (T-522, BE-88), all through the shared axios client:
 * - GET  /parcels/options                        the form's lists and limits
 * - POST /rides {vehicle_type: parcel, parcel: {...}} books it (no stops, no cash on delivery)
 * - POST /rides/{id}/parcel/pickup   multipart {photo, pin?}  arrived -> picked_up
 * - POST /rides/{id}/parcel/deliver  {code}                   picked_up -> delivered
 * - POST /rides/{id}/parcel/return   {reason, note?}          picked_up -> returning
 * - POST /rides/{id}/parcel/returned {code}                   returning -> returned
 * - POST /rides/{id}/parcel/refuse   {reason, note?}          at the pickup -> cancelled
 * - POST /rides/{id}/parcel/call-receiver   {mode: proxy, number} | {mode: chat_only}
 * - POST /rides/{id}/parcel/resend-code     sender or driver; the ride
 * - GET|POST /driver/parcels/opt-in {enabled, accept_rules}  (409 NO_APPROVED_BIKE)
 * The steps answer with the ride. Codes are never logged or kept beyond the ride object.
 */

export const PARCEL_TIER_KEY = 'parcel';

export const PARCEL_CODES = {
  codeRequired: 'PARCEL_CODE_REQUIRED',
  codeInvalid: 'PARCEL_CODE_INVALID',
  codeLocked: 'PARCEL_CODE_LOCKED',
  codeBlocked: 'PARCEL_CODE_BLOCKED',
  codeNotSent: 'PARCEL_CODE_NOT_SENT',
  sendLimit: 'PARCEL_CODE_SEND_LIMIT',
  sendCooldown: 'PARCEL_CODE_COOLDOWN',
  smsFailed: 'PARCEL_CODE_SMS_FAILED',
  wrongStep: 'PARCEL_WRONG_STEP',
  noApprovedBike: 'NO_APPROVED_BIKE',
  stepRequired: 'PARCEL_STEP_REQUIRED',
  noStops: 'PARCEL_NO_STOPS',
} as const;

/** Server bounds (ParcelDelivery::bookingRules, the return / refuse notes). */
export const PARCEL_LIMITS = {
  receiverNameMin: 2,
  receiverNameMax: 60,
  descriptionMax: 200,
  noteMax: 200,
} as const;

/** The pickup photo can take a while on mobile data (5 MB at most), like the avatar upload. */
export const PARCEL_PHOTO_TIMEOUT_MS = AVATAR_UPLOAD_TIMEOUT_MS;

const STATUSES: ReadonlyArray<ParcelStatus> = [
  'requested',
  'accepted',
  'arrived',
  'picked_up',
  'returning',
  'delivered',
  'returned',
  'cancelled',
];

const whole = (value: unknown): number | null => {
  const n = readNumberOrNull(value);
  return n === null ? null : Math.round(n);
};

/** A parcel ride: the server's `is_parcel`, else the parcel tier key. */
export const isParcelRide = (ride: { is_parcel?: unknown; vehicle_type?: unknown } | null | undefined): boolean =>
  !!ride && (ride.is_parcel === true || ride.vehicle_type === PARCEL_TIER_KEY);

/** A catalogue or estimate entry for the parcel tier (BE-88 `parcel: true`, else its key). */
export const isParcelType = (item: { parcel?: unknown; key?: unknown; vehicle_type?: unknown }): boolean =>
  item.parcel === true || item.key === PARCEL_TIER_KEY || item.vehicle_type === PARCEL_TIER_KEY;

const toChoices = (raw: unknown): ParcelChoice[] =>
  (Array.isArray(raw) ? raw : []).flatMap((item): ParcelChoice[] => {
    if (!isRecord(item)) return [];
    const key = readText(item.key);
    const label = readText(item.label);
    return key && label ? [{ key, label }] : [];
  });

const toSizes = (raw: unknown): ParcelSize[] =>
  (Array.isArray(raw) ? raw : []).flatMap((item): ParcelSize[] => {
    if (!isRecord(item)) return [];
    const key = readText(item.key);
    const label = readText(item.label);
    return key && label ? [{ key, label, maxWeightKg: readNumberOrNull(item.max_weight_kg) }] : [];
  });

const toTexts = (raw: unknown): string[] =>
  (Array.isArray(raw) ? raw : []).flatMap((item) => {
    const text = readText(item);
    return text ? [text] : [];
  });

const clampDigits = (value: unknown): number => Math.min(6, Math.max(4, whole(value) ?? 6));

export const toParcelOptions = (raw: unknown): ParcelOptions => {
  const data = isRecord(raw) ? raw : {};
  return {
    tierActive: data.tier_active === true,
    vehicleType: readText(data.vehicle_type) ?? PARCEL_TIER_KEY,
    currency: readText(data.currency) ?? 'PKR',
    maxDeclaredValue: Math.max(0, whole(data.max_declared_value) ?? 0),
    categories: toChoices(data.categories),
    sizes: toSizes(data.sizes),
    prohibitedItems: toTexts(data.prohibited_items),
    declaration: readText(data.declaration) ?? '',
    rulesVersion: readText(data.rules_version) ?? '',
    codeDigits: clampDigits(data.code_digits),
    returnReasons: toChoices(data.return_reasons),
    refusalReasons: toChoices(data.refusal_reasons),
  };
};

const toCodeState = (raw: unknown): ParcelCodeState | null => {
  if (!isRecord(raw)) return null;
  const purpose = raw.purpose === 'delivery' || raw.purpose === 'return' ? raw.purpose : null;
  const attempts = whole(raw.attempts_left);
  return {
    digits: clampDigits(raw.digits),
    purpose,
    sent: raw.sent === true,
    sendsLeft: Math.max(0, whole(raw.sends_left) ?? 0),
    smsFailed: raw.sms_failed === true,
    canResend: raw.can_resend === true,
    resendAvailableAt: readText(raw.resend_available_at),
    attemptsLeft: attempts === null ? null : Math.max(0, attempts),
    lockedUntil: readText(raw.locked_until),
    blocked: raw.blocked === true,
    deliveryBlocked: raw.delivery_blocked === true,
  };
};

/** Only a code of the configured length (digits) is ever shown. */
const toReturnCode = (value: unknown): string | null => {
  const text = readText(value);
  return text && /^\d{4,6}$/.test(text) ? text : null;
};

/** The ride's `parcel` block; null when absent (not a parcel, or an older server). */
export const toParcelView = (raw: unknown): ParcelView | null => {
  if (!isRecord(raw)) return null;
  const receiver = isRecord(raw.receiver) ? raw.receiver : null;
  return {
    status: readOneOf(raw.status, STATUSES, 'requested'),
    itemCategoryLabel: readText(raw.item_category_label) ?? readText(raw.item_category),
    sizeLabel: readText(raw.size_label) ?? readText(raw.size_class),
    maxWeightKg: readNumberOrNull(raw.max_weight_kg),
    itemDescription: readText(raw.item_description),
    declaredValue: whole(raw.declared_value),
    // The full phone is the sender's own entry; the app shows the masked one only.
    receiver: receiver ? { name: readText(receiver.name), phoneMasked: readText(receiver.phone_masked) } : null,
    pickupPhotoUrl: readText(raw.pickup_photo_url),
    pickedUpAt: readText(raw.picked_up_at),
    deliveredAt: readText(raw.delivered_at),
    returnStartedAt: readText(raw.return_started_at),
    returnReason: readText(raw.return_reason),
    returnedAt: readText(raw.returned_at),
    refusalReason: readText(raw.refusal_reason),
    code: toCodeState(raw.code),
    canCallReceiver: raw.can_call_receiver === true,
    returnCode: raw.status === 'returning' ? toReturnCode(raw.return_code) : null,
  };
};

/** The ride's parcel for the viewer, or null for a ride that is not a parcel. */
export const parcelOf = (ride: Pick<RideResource, 'is_parcel' | 'vehicle_type' | 'parcel'> | null | undefined): ParcelView | null =>
  ride && isParcelRide(ride) ? toParcelView(ride.parcel) : null;

export const toParcelOptIn = (raw: unknown): ParcelOptIn => {
  const data = isRecord(raw) ? raw : {};
  return {
    optedIn: data.parcel_opt_in === true,
    optedInAt: readText(data.opted_in_at),
    hasApprovedBike: data.has_approved_bike === true,
    tierActive: data.tier_active === true,
    getsParcelRequests: data.gets_parcel_requests === true,
    prohibitedItems: toTexts(data.prohibited_items),
    rulesVersion: readText(data.rules_version),
  };
};

/** What the driver's request card shows of a parcel: what they would carry, nothing else. */
export interface ParcelRequestSummary {
  categoryLabel: string | null;
  sizeLabel: string | null;
  maxWeightKg: number | null;
}

export const toParcelRequestSummary = (raw: { is_parcel?: unknown; vehicle_type?: unknown; parcel?: unknown }): ParcelRequestSummary | null => {
  if (!isParcelRide(raw)) return null;
  const parcel = isRecord(raw.parcel) ? raw.parcel : {};
  return {
    categoryLabel: readText(parcel.item_category_label) ?? readText(parcel.item_category),
    sizeLabel: readText(parcel.size_label) ?? readText(parcel.size_class),
    maxWeightKg: readNumberOrNull(parcel.max_weight_kg),
  };
};

/** A driver's step on a parcel ride. */
export type ParcelDriverStep =
  | { step: 'pickup'; photo: MultipartFile; pin?: string }
  | { step: 'deliver' | 'returned'; code: string }
  | { step: 'return' | 'refuse'; reason: string; note?: string };

/** The reason and, when written, the note (cut to the server's limit). */
export const buildReasonBody = (reason: string, note: string | undefined): { reason: string; note?: string } => {
  const text = note?.trim();
  return text ? { reason, note: text.slice(0, PARCEL_LIMITS.noteMax) } : { reason };
};

const ride = async (url: string, body?: unknown, config?: Parameters<typeof apiService.post>[2]): Promise<RideResource> =>
  unwrap(await apiService.post<RideResource>(url, body, config));

export const parcelApi = {
  async options(): Promise<ParcelOptions> {
    return toParcelOptions(unwrap(await apiService.get<unknown>('/parcels/options')));
  },

  /** One endpoint per step; each answers with the ride. */
  driverStep(rideId: number, arg: ParcelDriverStep): Promise<RideResource> {
    const base = `/rides/${rideId}/parcel`;
    switch (arg.step) {
      case 'pickup': {
        const form = new FormData();
        form.append('photo', arg.photo);
        if (arg.pin !== undefined) form.append('pin', String(arg.pin));
        return ride(`${base}/pickup`, form, {
          timeout: PARCEL_PHOTO_TIMEOUT_MS,
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      case 'deliver':
      case 'returned':
        return ride(`${base}/${arg.step}`, { code: arg.code });
      case 'return':
      case 'refuse':
        return ride(`${base}/${arg.step}`, buildReasonBody(arg.reason, arg.note));
      default:
        throw new Error('Unknown parcel step');
    }
  },

  async callReceiver(rideId: number): Promise<CallSession> {
    return toCallSession(unwrap(await apiService.post<unknown>(`/rides/${rideId}/parcel/call-receiver`)));
  },

  resendCode(rideId: number): Promise<RideResource> {
    return ride(`/rides/${rideId}/parcel/resend-code`);
  },

  async getOptIn(signal?: AbortSignal): Promise<ParcelOptIn> {
    return toParcelOptIn(unwrap(await apiService.get<unknown>('/driver/parcels/opt-in', { signal })));
  },

  async setOptIn(enabled: boolean): Promise<ParcelOptIn> {
    const body = enabled ? { enabled: true, accept_rules: true } : { enabled: false };
    return toParcelOptIn(unwrap(await apiService.post<unknown>('/driver/parcels/opt-in', body)));
  },
};
