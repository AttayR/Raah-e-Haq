/**
 * App models of parcel delivery (T-522, BE-88; docs/api/CONTRACT_NOTES.md "BE-88"). Raw server
 * shapes are mapped in api.ts; screens only see these. No code is ever held here except the
 * sender's own return code, and only while the server sends it (the parcel is coming back).
 */

/** `parcel.status`, derived by the server from the ride status and the parcel's steps. */
export type ParcelStatus =
  | 'requested'
  | 'accepted'
  | 'arrived'
  | 'picked_up'
  | 'returning'
  | 'delivered'
  | 'returned'
  | 'cancelled';

/** One choice of a server list (category, size, reason), shown by its label. */
export interface ParcelChoice {
  key: string;
  label: string;
}

export interface ParcelSize extends ParcelChoice {
  /** What the sender confirms the parcel weighs at most; null when the server gave none. */
  maxWeightKg: number | null;
}

/** GET /parcels/options: everything the parcel form and the driver's sheets show. */
export interface ParcelOptions {
  /** The admin has the parcel tier on (it can be booked). */
  tierActive: boolean;
  vehicleType: string;
  currency: string;
  /** Whole rupees; a higher declared value is refused at booking. */
  maxDeclaredValue: number;
  categories: ParcelChoice[];
  sizes: ParcelSize[];
  prohibitedItems: string[];
  declaration: string;
  /** Sent back with the booking so a changed rule set is caught (422 parcel.rules_version). */
  rulesVersion: string;
  /** Digits of the delivery and return codes (4-6). */
  codeDigits: number;
  returnReasons: ParcelChoice[];
  refusalReasons: ParcelChoice[];
}

/** `parcel.code`: the state of the open code. Never the code itself. */
export interface ParcelCodeState {
  digits: number;
  purpose: 'delivery' | 'return' | null;
  sent: boolean;
  sendsLeft: number;
  /** The last SMS to the receiver did not go through. */
  smsFailed: boolean;
  canResend: boolean;
  /** ISO time the next resend is allowed from; null when there is no wait. */
  resendAvailableAt: string | null;
  attemptsLeft: number | null;
  /** ISO time a wrong-code lock ends; null when not locked. */
  lockedUntil: string | null;
  blocked: boolean;
  /** The delivery code was blocked (kept visible after a return started). */
  deliveryBlocked: boolean;
}

/** The ride's `parcel` block for the viewer (the sender or the assigned driver). */
export interface ParcelView {
  status: ParcelStatus;
  itemCategoryLabel: string | null;
  sizeLabel: string | null;
  maxWeightKg: number | null;
  /** Sender and assigned driver only. */
  itemDescription: string | null;
  declaredValue: number | null;
  /** The receiver's name and masked phone (sender and assigned driver only). */
  receiver: { name: string | null; phoneMasked: string | null } | null;
  /** A short-lived signed URL of the pickup photo; null before pickup or after retention. */
  pickupPhotoUrl: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  returnStartedAt: string | null;
  returnReason: string | null;
  returnedAt: string | null;
  refusalReason: string | null;
  code: ParcelCodeState | null;
  /** The driver may ask for a masked number to call the receiver. */
  canCallReceiver: boolean;
  /** The sender's return code, only while the parcel comes back (sender only). */
  returnCode: string | null;
}

/** GET/POST /driver/parcels/opt-in `data`. */
export interface ParcelOptIn {
  optedIn: boolean;
  optedInAt: string | null;
  hasApprovedBike: boolean;
  tierActive: boolean;
  /** Opted in, with an approved bike, and the tier is on. */
  getsParcelRequests: boolean;
  prohibitedItems: string[];
  rulesVersion: string | null;
}

/** What the sender fills in on the parcel form (before it becomes the POST /rides `parcel` block). */
export interface ParcelDraft {
  receiverName: string;
  /** National digits from the kit phone field ("3001234567"). */
  receiverPhone: string;
  itemCategory: string | null;
  sizeClass: string | null;
  /** As typed (whole rupees). */
  declaredValue: string;
  itemDescription: string;
  declarationAccepted: boolean;
}

/** The form fields a 422 can point at. */
export type ParcelField =
  | 'receiverName'
  | 'receiverPhone'
  | 'itemCategory'
  | 'sizeClass'
  | 'declaredValue'
  | 'itemDescription'
  | 'declaration'
  | 'pickup'
  | 'dropoff';

export type ParcelFieldErrors = Partial<Record<ParcelField, string>>;
