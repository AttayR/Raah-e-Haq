import type { EmergencyNumber } from '../../config/safety';

/**
 * Safety models (T-520; docs/api/CONTRACT_NOTES.md BE-78..BE-81). `api.ts` maps the snake_case
 * wire shapes into these.
 */

/** BE-78 `contact` on a ride, for its passenger and assigned driver. */
export interface RideContact {
  canChat: boolean;
  /** Show a Call button (a telephony provider is configured: `call_mode` proxy). */
  canCall: boolean;
  callMode: 'proxy' | 'chat_only';
  /** When contact closes for the caller; null while the ride is active. */
  closesAt: string | null;
}

/** POST /rides/{id}/call. `proxy` carries the masked number to dial; `chat_only` opens the chat. */
export type CallSession =
  | { mode: 'proxy'; number: string; expiresAt: string | null; contactClosesAt: string | null }
  | { mode: 'chat_only'; contactClosesAt: string | null };

/** One of the user's emergency contacts (E.164 phone). */
export interface EmergencyContact {
  id: number;
  name: string;
  phone: string;
}

export interface EmergencyContactsList {
  contacts: EmergencyContact[];
  max: number;
}

export interface EmergencyContactInput {
  name: string;
  /** Any common PK mobile form; the server stores E.164. */
  phone: string;
}

/** POST /rides/{id}/sos answer. */
export interface SosResult {
  created: boolean;
  incidentId: number | null;
  incidentStatus: string | null;
  /** `general` | `women_safety` (BE-87); a 200 created:false women_safety answer upgraded the open one (BE-105). */
  incidentCategory: string | null;
  emergencyNumbers: EmergencyNumber[];
  emergencyContacts: EmergencyContact[];
  shareUrl: string | null;
  shareMessage: string;
}

/** POST /rides/{id}/share answer. */
export interface ShareLink {
  url: string;
  expiresAt: string | null;
}

export interface SosPosition {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}
