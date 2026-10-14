/**
 * Safety configuration (T-520). The emergency numbers are the national ones (Police 15, Rescue
 * 1122). They live here, not only on the server, because the SOS sheet must dial them even when
 * the phone is offline or POST /rides/{id}/sos fails; the server's `emergency_numbers` replace
 * them once an SOS answer arrives (BE-79).
 */
export interface EmergencyNumber {
  key: string;
  label: string;
  number: string;
}

export const FALLBACK_EMERGENCY_NUMBERS: ReadonlyArray<EmergencyNumber> = [
  { key: 'police', label: 'Police', number: '15' },
  { key: 'rescue', label: 'Rescue', number: '1122' },
];

/** SOS and contact stay open this long after a ride ends (BE-78/BE-79 window). */
export const SAFETY_WINDOW_MINUTES = 30;

/** The server's cap on emergency contacts (BE-79); `max` from GET wins when present. */
export const MAX_EMERGENCY_CONTACTS = 3;

/** The ride PIN length (BE-81). */
export const RIDE_PIN_LENGTH = 4;
