import type { RideResource } from '../../services/rideService';
import { RIDE_PIN_LENGTH, SAFETY_WINDOW_MINUTES } from '../../config/safety';
import { toNationalDigits } from '../../components/ui/phoneInput';
import type { RideContact } from './types';

/**
 * Pure safety rules (T-520): what a ride lets its passenger and driver do, from the server's
 * RideResource only (BE-78 `contact`, BE-81 `pin*`), plus the emergency-contact form rules.
 */

const ACTIVE: ReadonlyArray<RideResource['status']> = ['accepted', 'arrived', 'started', 'ongoing'];

/**
 * BE-78 `contact` for the caller, or null when the ride carries none (no driver yet, a viewer
 * who is not a party). A missing flag is false: nothing is offered the server did not allow.
 */
export const rideContactOf = (ride: Pick<RideResource, 'contact'> | null | undefined): RideContact | null => {
  const raw = ride?.contact;
  if (!raw || typeof raw !== 'object') return null;
  const callMode = raw.call_mode === 'proxy' ? 'proxy' : 'chat_only';
  return {
    canChat: raw.can_chat === true,
    canCall: raw.can_call === true && callMode === 'proxy',
    callMode,
    closesAt: typeof raw.closes_at === 'string' && raw.closes_at ? raw.closes_at : null,
  };
};

/** Show the Call button: only when the server says so (masked proxy), never from a phone. */
export const canCallOn = (ride: Pick<RideResource, 'contact'> | null | undefined): boolean =>
  rideContactOf(ride)?.canCall === true;

const timeOf = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
};

/** When the ride ended (completed or cancelled), or null while it is not over. */
const endedAt = (ride: Pick<RideResource, 'status' | 'completed_at' | 'cancelled_at' | 'updated_at'>): number | null => {
  if (ride.status === 'completed') return timeOf(ride.completed_at) ?? timeOf(ride.updated_at);
  if (ride.status === 'cancelled') return timeOf(ride.cancelled_at) ?? timeOf(ride.updated_at);
  return null;
};

/**
 * The SOS button shows while the ride is accepted → started and for 30 min after it ended
 * (BE-79 window). A ride without a driver (requested) has no SOS: nobody to report.
 */
export const isSosAvailable = (
  ride: Pick<RideResource, 'status' | 'driver_id' | 'completed_at' | 'cancelled_at' | 'updated_at'> | null | undefined,
  now: number = Date.now(),
): boolean => {
  if (!ride) return false;
  if (ACTIVE.includes(ride.status)) return true;
  if (ride.status !== 'completed' && !(ride.status === 'cancelled' && typeof ride.driver_id === 'number')) return false;
  const ended = endedAt(ride);
  return ended !== null && now - ended < SAFETY_WINDOW_MINUTES * 60_000;
};

/** "Share live trip" is the passenger's, while the ride is not over (BE-80). */
export const canShareTrip = (ride: Pick<RideResource, 'status' | 'driver_id'> | null | undefined): boolean =>
  !!ride && ACTIVE.includes(ride.status) && typeof ride.driver_id === 'number';

/** The passenger's PIN to show, only a 4-digit string the server sent (BE-81). */
export const ridePinOf = (ride: Pick<RideResource, 'pin' | 'status'> | null | undefined): string | null => {
  const pin = ride?.pin;
  if (typeof pin !== 'string' || !new RegExp(`^\\d{${RIDE_PIN_LENGTH}}$`).test(pin)) return null;
  return ride?.status === 'accepted' || ride?.status === 'arrived' ? pin : null;
};

export const isValidPin = (pin: string): boolean => new RegExp(`^\\d{${RIDE_PIN_LENGTH}}$`).test(pin);

// Emergency contacts form (BE-79: letters only, 2-60; a Pakistani mobile).

export const CONTACT_NAME_MIN = 2;
export const CONTACT_NAME_MAX = 60;

export type ContactFieldError = 'nameRequired' | 'nameShort' | 'nameLetters' | 'phoneRequired' | 'phoneInvalid';

/** Latin or Urdu letters, spaces, dots, apostrophes and hyphens, starting with a letter. */
const NAME_PATTERN = /^[A-Za-z\u00C0-\u024F\u0600-\u06FF][A-Za-z\u00C0-\u024F\u0600-\u06FF .'-]*$/;

export const validateContactName = (name: string): ContactFieldError | null => {
  const trimmed = name.trim();
  if (!trimmed) return 'nameRequired';
  if (trimmed.length < CONTACT_NAME_MIN) return 'nameShort';
  if (trimmed.length > CONTACT_NAME_MAX || !NAME_PATTERN.test(trimmed)) return 'nameLetters';
  return null;
};

/** National digits (`3001234567`) of a PK mobile: 10 digits starting with 3. */
export const validateContactPhone = (nationalDigits: string): ContactFieldError | null => {
  if (!nationalDigits) return 'phoneRequired';
  return /^3\d{9}$/.test(nationalDigits) ? null : 'phoneInvalid';
};

/** The E.164 number the API gets: `+92` + the national digits. */
export const toE164 = (nationalDigits: string): string => `+92${nationalDigits}`;

/** A stored E.164 number back to the field's national digits ("+923001234567" → "3001234567"). */
export const toFieldDigits = (phone: string): string => toNationalDigits(phone);

/** "+92 300 1234567" for display. */
export const formatPkPhone = (phone: string): string => {
  const digits = toNationalDigits(phone);
  return digits.length === 10 ? `+92 ${digits.slice(0, 3)} ${digits.slice(3)}` : phone;
};

/**
 * An SMS composer link to every contact with the message (iOS `sms:/open?addresses=`, Android
 * `sms:a,b?body=`). Numbers are digits with an optional + only (validated by the API mapper).
 */
export const smsUrl = (numbers: ReadonlyArray<string>, body: string, os: string): string => {
  const to = numbers.filter((n) => /^\+?\d{2,15}$/.test(n)).join(',');
  const text = encodeURIComponent(body);
  return os === 'ios' ? `sms:/open?addresses=${to}&body=${text}` : `sms:${to}?body=${text}`;
};
