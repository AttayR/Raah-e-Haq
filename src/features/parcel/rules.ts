import type { ThunkRejection } from '../../core/api/errors';
import { t, type TranslationKey } from '../../i18n';
import type { ParcelRequestBlock, RideRequest } from '../../services/rideService';
import type { BookingPlace } from '../ride-booking/buildRideRequest';
import { buildRideRequest } from '../ride-booking/buildRideRequest';
import { formatCountdown } from '../safety/pin';
import { formatMoney } from '../../utils/format';
import { PARCEL_CODES, PARCEL_LIMITS, PARCEL_TIER_KEY } from './api';
import type { ParcelDraft, ParcelField, ParcelFieldErrors, ParcelOptions, ParcelStatus, ParcelView } from './types';

/** Letters, marks, spaces, dots, apostrophes and hyphens (the server's receiver name rule). */
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*$/u;
/** National digits of a Pakistani mobile from the kit phone field: 3xx xxxxxxx. */
const NATIONAL_MOBILE = /^3\d{9}$/;

export const EMPTY_PARCEL_DRAFT: ParcelDraft = {
  receiverName: '',
  receiverPhone: '',
  itemCategory: null,
  sizeClass: null,
  declaredValue: '',
  itemDescription: '',
  declarationAccepted: false,
};

const squash = (text: string): string => text.trim().replace(/\s+/gu, ' ');

/** The declared value as whole rupees, or null when it is not a whole number. */
export const parseDeclaredValue = (text: string): number | null => {
  const digits = text.replace(/[,\s]/g, '');
  return /^\d{1,9}$/.test(digits) ? Number(digits) : null;
};

/** What the sender must fix before the form can be sent (the server checks again). */
export const validateParcelDraft = (draft: ParcelDraft, options: ParcelOptions): ParcelFieldErrors => {
  const errors: ParcelFieldErrors = {};
  const name = squash(draft.receiverName);
  if (name.length < PARCEL_LIMITS.receiverNameMin) errors.receiverName = t('parcel.receiverNameRequired');
  else if (name.length > PARCEL_LIMITS.receiverNameMax || !NAME_PATTERN.test(name)) errors.receiverName = t('parcel.receiverNameInvalid');
  if (!draft.receiverPhone) errors.receiverPhone = t('parcel.receiverPhoneRequired');
  else if (!NATIONAL_MOBILE.test(draft.receiverPhone)) errors.receiverPhone = t('parcel.receiverPhoneInvalid');
  if (!draft.itemCategory || !options.categories.some((c) => c.key === draft.itemCategory)) errors.itemCategory = t('parcel.categoryRequired');
  if (!draft.sizeClass || !options.sizes.some((s) => s.key === draft.sizeClass)) errors.sizeClass = t('parcel.sizeRequired');
  const value = parseDeclaredValue(draft.declaredValue);
  if (value === null) errors.declaredValue = t('parcel.valueRequired');
  else if (value > options.maxDeclaredValue) errors.declaredValue = t('parcel.valueTooHigh', { max: formatMoney(options.maxDeclaredValue, options.currency) });
  if (draft.itemDescription.trim().length > PARCEL_LIMITS.descriptionMax) errors.itemDescription = t('parcel.descriptionTooLong', { max: PARCEL_LIMITS.descriptionMax });
  if (!draft.declarationAccepted) errors.declaration = t('parcel.declarationRequired');
  return errors;
};

/** The POST /rides `parcel` block of a valid draft (validateParcelDraft returned no errors). */
export const buildParcelBlock = (draft: ParcelDraft, options: ParcelOptions): ParcelRequestBlock => {
  const description = squash(draft.itemDescription).slice(0, PARCEL_LIMITS.descriptionMax);
  return {
    receiver_name: squash(draft.receiverName),
    receiver_phone: `+92${draft.receiverPhone}`,
    item_category: draft.itemCategory ?? '',
    size_class: draft.sizeClass ?? '',
    declared_value: parseDeclaredValue(draft.declaredValue) ?? 0,
    declaration_accepted: true,
    ...(description ? { item_description: description } : {}),
    rules_version: options.rulesVersion,
  };
};

export type ParcelRequestResult = { ok: true; request: RideRequest } | { ok: false; errors: ParcelFieldErrors; message?: string };

/**
 * The POST /rides body of a parcel: the ride body (pickup, drop-off with their addresses) with
 * vehicle_type `parcel` and the `parcel` block. Never stops or a driver preference. T-559: the
 * sender's offer (BE-83 `offered_fare`, inside the parcel quote's band) only when it differs
 * from the server fare (see offeredFareFor).
 */
export const buildParcelRideRequest = (
  pickup: BookingPlace | null,
  dropoff: BookingPlace | null,
  draft: ParcelDraft,
  options: ParcelOptions,
  offeredFare: number | null = null,
): ParcelRequestResult => {
  const errors = validateParcelDraft(draft, options);
  if (!pickup) errors.pickup = t('parcel.pickupRequired');
  if (!dropoff) errors.dropoff = t('parcel.dropoffRequired');
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const built = buildRideRequest({ pickup, dropoff, vehicleType: options.vehicleType || PARCEL_TIER_KEY, offeredFare });
  if (!built.ok) return { ok: false, errors: {}, message: built.error };
  return { ok: true, request: { ...built.request, parcel: buildParcelBlock(draft, options) } };
};

const SERVER_FIELDS: Record<string, ParcelField> = {
  'parcel.receiver_name': 'receiverName',
  'parcel.receiver_phone': 'receiverPhone',
  'parcel.item_category': 'itemCategory',
  'parcel.size_class': 'sizeClass',
  'parcel.declared_value': 'declaredValue',
  'parcel.item_description': 'itemDescription',
  'parcel.declaration_accepted': 'declaration',
  'parcel.rules_version': 'declaration',
  pickup_address: 'pickup',
  pickup_latitude: 'pickup',
  pickup_longitude: 'pickup',
  dropoff_address: 'dropoff',
  dropoff_latitude: 'dropoff',
  dropoff_longitude: 'dropoff',
  dropoff: 'dropoff',
};

/**
 * A 422 from POST /rides on the parcel form: each `parcel.*` (and route) message under its
 * field; anything else (`vehicle_type` inactive, `parcel`, `stops`) as the form's message.
 * `rulesChanged`: the rules were bumped, so the options must be read again.
 */
export const parcelFieldErrorsOf = (
  rejection: Pick<ThunkRejection, 'fieldErrors'> | undefined,
): { fields: ParcelFieldErrors; other: string | null; rulesChanged: boolean } => {
  const fields: ParcelFieldErrors = {};
  let other: string | null = null;
  Object.entries(rejection?.fieldErrors ?? {}).forEach(([key, messages]) => {
    const message = messages.find((m) => typeof m === 'string' && m.trim());
    if (!message) return;
    const field = SERVER_FIELDS[key];
    if (field) {
      if (!fields[field]) fields[field] = message;
    } else if (!other) {
      other = message;
    }
  });
  return { fields, other, rulesChanged: !!rejection?.fieldErrors?.['parcel.rules_version'] };
};

/** One row of the sender's status timeline. */
export interface ParcelTimelineStep {
  key: ParcelStatus;
  label: string;
  state: 'done' | 'current' | 'upcoming';
}

const FORWARD: ParcelStatus[] = ['requested', 'accepted', 'arrived', 'picked_up', 'delivered'];
const RETURN: ParcelStatus[] = ['requested', 'accepted', 'arrived', 'picked_up', 'returning', 'returned'];

const STEP_LABEL: Record<ParcelStatus, TranslationKey> = {
  requested: 'parcel.statusRequested',
  accepted: 'parcel.statusAccepted',
  arrived: 'parcel.statusArrived',
  picked_up: 'parcel.statusPickedUp',
  returning: 'parcel.statusReturning',
  delivered: 'parcel.statusDelivered',
  returned: 'parcel.statusReturned',
  cancelled: 'parcel.statusCancelled',
};

export const parcelStatusText = (status: ParcelStatus): string => t(STEP_LABEL[status]);

/**
 * The timeline: requested → accepted → arrived → picked up → delivered, or with a return
 * … → picked up → returning → returned. A cancelled parcel shows the steps it reached and then
 * "Cancelled": T-563, a parcel refused at the pickup (BE-88 refuses only once the rider has
 * arrived) keeps accepted and arrived. The last reached step is `current` until the parcel is done.
 */
export const parcelTimeline = (
  parcel: Pick<ParcelView, 'status' | 'pickedUpAt' | 'returnStartedAt'> & Partial<Pick<ParcelView, 'refusalReason'>>,
): ParcelTimelineStep[] => {
  const { status } = parcel;
  if (status === 'cancelled') {
    const reached: ParcelStatus[] = parcel.pickedUpAt
      ? ['requested', 'accepted', 'arrived', 'picked_up']
      : parcel.refusalReason
        ? ['requested', 'accepted', 'arrived']
        : ['requested'];
    return [
      ...reached.map((key) => ({ key, label: parcelStatusText(key), state: 'done' as const })),
      { key: 'cancelled', label: parcelStatusText('cancelled'), state: 'current' },
    ];
  }
  const path = status === 'returning' || status === 'returned' || parcel.returnStartedAt ? RETURN : FORWARD;
  const at = Math.max(0, path.indexOf(status));
  const finished = status === 'delivered' || status === 'returned';
  return path.map((key, index) => ({
    key,
    label: parcelStatusText(key),
    state: index < at || (finished && index === at) ? 'done' : index === at ? 'current' : 'upcoming',
  }));
};

/**
 * T-563: a cancelled parcel was never paid (the sender pays the rider at the pickup), so there is
 * nothing the rider could have overcharged: no "asked for more?" button. A report already made
 * keeps its status.
 */
export const parcelOverchargeState = <S extends { canReport: boolean }>(
  state: S | null,
  parcel: Pick<ParcelView, 'status'> | null,
): S | null => (state && state.canReport && parcel?.status === 'cancelled' ? { ...state, canReport: false } : state);

/** Seconds until `iso` (0 when it has passed or is missing). */
export const secondsUntil = (iso: string | null, now: number): number => {
  if (!iso) return 0;
  const at = Date.parse(iso);
  return Number.isFinite(at) ? Math.max(0, Math.ceil((at - now) / 1000)) : 0;
};

/** Whether "Send the code again" can be pressed now, and how long to wait otherwise. */
export const resendState = (parcel: ParcelView | null, now: number): { visible: boolean; waitSeconds: number } => {
  const code = parcel?.code;
  if (!parcel || !code || parcel.status !== 'picked_up' || code.purpose !== 'delivery') return { visible: false, waitSeconds: 0 };
  return { visible: code.canResend, waitSeconds: secondsUntil(code.resendAvailableAt, now) };
};

/** The text for a refused resend (POST /rides/{id}/parcel/resend-code). */
export const resendRefusalText = (rejection: Pick<ThunkRejection, 'code' | 'retryAfter' | 'extra' | 'kind' | 'message'>): string => {
  switch (rejection.code) {
    case PARCEL_CODES.sendCooldown: {
      const wait = rejection.extra?.retry_after ?? rejection.retryAfter;
      return typeof wait === 'number' && wait > 0 ? t('parcel.resendWait', { time: formatCountdown(wait) }) : t('parcel.resendCooldown');
    }
    case PARCEL_CODES.sendLimit:
      return t('parcel.resendLimit');
    case PARCEL_CODES.smsFailed:
      return t('parcel.resendSmsFailed');
    case PARCEL_CODES.codeBlocked:
      return t('parcel.codeBlocked');
    case PARCEL_CODES.codeNotSent:
    case PARCEL_CODES.wrongStep:
      return t('parcel.resendNotNow');
    default:
      return rejection.kind === 'rate_limited' ? rejection.message : t('parcel.resendFailed');
  }
};

/** What a refused delivery / return code means for the code sheet. */
export type CodeRefusal =
  | { kind: 'invalid'; message: string }
  | { kind: 'locked'; seconds: number }
  | { kind: 'blocked'; message: string }
  | { kind: 'other'; message: string; refresh: boolean };

/** Default lock when the answer carries no wait (BE-88 locks for 5 minutes). */
export const DEFAULT_CODE_LOCK_SECONDS = 300;

export const codeRefusalOf = (rejection: ThunkRejection | undefined): CodeRefusal => {
  if (!rejection) return { kind: 'other', message: t('parcel.stepFailed'), refresh: false };
  switch (rejection.code) {
    case PARCEL_CODES.codeInvalid: {
      const left = rejection.extra?.attempts_left;
      return {
        kind: 'invalid',
        message: typeof left === 'number' && left >= 0 ? t('parcel.codeWrongLeft', { n: Math.floor(left) }) : t('parcel.codeWrong'),
      };
    }
    case PARCEL_CODES.codeRequired:
      return { kind: 'invalid', message: t('parcel.codeRequired') };
    case PARCEL_CODES.codeLocked: {
      const wait = rejection.extra?.retry_after ?? rejection.retryAfter;
      return { kind: 'locked', seconds: typeof wait === 'number' && wait > 0 ? Math.ceil(wait) : DEFAULT_CODE_LOCK_SECONDS };
    }
    case PARCEL_CODES.codeBlocked:
      return { kind: 'blocked', message: t('parcel.codeBlocked') };
    case PARCEL_CODES.codeNotSent:
      return { kind: 'other', message: t('parcel.codeNotSent'), refresh: true };
    case PARCEL_CODES.wrongStep:
      return { kind: 'other', message: t('parcel.wrongStep'), refresh: true };
    default:
      break;
  }
  if (rejection.kind === 'validation') {
    const field = rejection.fieldErrors?.code?.find((m) => m.trim());
    return { kind: 'invalid', message: field ?? rejection.message };
  }
  if (rejection.kind === 'rate_limited') return { kind: 'other', message: rejection.message, refresh: false };
  const known = rejection.kind !== 'unknown' && rejection.kind !== 'server';
  return { kind: 'other', message: known ? rejection.message : t('parcel.stepFailed'), refresh: rejection.kind === 'conflict' };
};

/** A code the sheet may send: exactly `digits` digits. */
export const isValidParcelCode = (code: string, digits: number): boolean => new RegExp(`^\\d{${digits}}$`).test(code);
