import { apiService, unwrap } from '../../services/api';
import { isRecord, readId, readNumberOrNull, readText } from '../../core/api/read';
import { FALLBACK_EMERGENCY_NUMBERS, MAX_EMERGENCY_CONTACTS, type EmergencyNumber } from '../../config/safety';
import type {
  CallSession,
  EmergencyContact,
  EmergencyContactInput,
  EmergencyContactsList,
  ShareLink,
  SosPosition,
  SosResult,
} from './types';

/**
 * Safety endpoints (T-520; docs/api/CONTRACT_NOTES.md BE-78..BE-81), all through the shared axios
 * client:
 * - POST   /rides/{id}/call   -> { mode: proxy, number, expires_at, contact_closes_at } | { mode: chat_only }
 * - POST   /rides/{id}/sos    -> { created, incident, emergency_numbers, emergency_contacts, share_url, share_message }
 *   (BE-87 `category: women_safety` fast-tracks it; a repeat within 2 min upgrades the same alert)
 * - POST   /rides/{id}/share  -> { url, token, expires_at };  DELETE /rides/{id}/share -> { revoked }
 * - GET/POST/PUT/DELETE /me/emergency-contacts
 * Refusals arrive as ApiErrors with these codes. Masked numbers, contact phones, share URLs and
 * tokens are never logged.
 */
export const SAFETY_CODES = {
  notParticipant: 'NOT_RIDE_PARTICIPANT',
  notPassenger: 'NOT_RIDE_PASSENGER',
  contactNotOpen: 'CONTACT_NOT_OPEN',
  contactClosed: 'CONTACT_CLOSED',
  sosWindowClosed: 'SOS_WINDOW_CLOSED',
  rideNotActive: 'RIDE_NOT_ACTIVE',
  contactsLimit: 'EMERGENCY_CONTACTS_LIMIT',
} as const;

/** A dialable number: digits with an optional leading +, so tel: never carries dial codes. */
export const toDialable = (value: unknown): string | null => {
  const text = readText(value);
  if (!text) return null;
  const compact = text.replace(/[\s-]/g, '');
  return /^\+?[0-9]{2,15}$/.test(compact) ? compact : null;
};

export const toCallSession = (raw: unknown): CallSession => {
  const data = isRecord(raw) ? raw : {};
  const contactClosesAt = readText(data.contact_closes_at);
  const number = data.mode === 'proxy' ? toDialable(data.number) : null;
  // A proxy answer without a usable number is treated as chat only (never a broken tel:).
  if (number) return { mode: 'proxy', number, expiresAt: readText(data.expires_at), contactClosesAt };
  return { mode: 'chat_only', contactClosesAt };
};

export const toEmergencyContact = (raw: unknown): EmergencyContact | null => {
  if (!isRecord(raw)) return null;
  const id = readId(raw.id);
  const name = readText(raw.name);
  const phone = toDialable(raw.phone);
  if (id === null || name === null || phone === null) return null;
  return { id, name, phone };
};

const toContacts = (raw: unknown): EmergencyContact[] =>
  Array.isArray(raw) ? raw.map(toEmergencyContact).filter((c): c is EmergencyContact => c !== null) : [];

export const toEmergencyContactsList = (raw: unknown): EmergencyContactsList => {
  const data = isRecord(raw) ? raw : {};
  return { contacts: toContacts(data.contacts), max: readId(data.max) ?? MAX_EMERGENCY_CONTACTS };
};

const toEmergencyNumbers = (raw: unknown): EmergencyNumber[] => {
  const numbers = (Array.isArray(raw) ? raw : [])
    .map((item): EmergencyNumber | null => {
      if (!isRecord(item)) return null;
      const number = toDialable(item.number);
      const key = readText(item.key);
      if (!number || !key) return null;
      return { key, label: readText(item.label) ?? key, number };
    })
    .filter((n): n is EmergencyNumber => n !== null);
  return numbers.length > 0 ? numbers : [...FALLBACK_EMERGENCY_NUMBERS];
};

export const toSosResult = (raw: unknown): SosResult => {
  const data = isRecord(raw) ? raw : {};
  const incident = isRecord(data.incident) ? data.incident : {};
  return {
    created: data.created === true,
    incidentId: readId(incident.id),
    incidentStatus: readText(incident.status),
    incidentCategory: readText(incident.category),
    emergencyNumbers: toEmergencyNumbers(data.emergency_numbers),
    emergencyContacts: toContacts(data.emergency_contacts),
    shareUrl: toShareableUrl(data.share_url),
    shareMessage: readText(data.share_message) ?? '',
  };
};

/** Dev-only hosts of the local backend (simulator, Android emulator). */
const DEV_HTTP_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '10.0.2.2']);

/**
 * The trip link we may share, or null: https anywhere; plain http only to the local backend
 * (localhost / 127.0.0.1 / 10.0.2.2) and only in a Debug build (`dev`), so local QA can share
 * the trip. A release build shares https only, and never another scheme from a response.
 */
export const toShareableUrl = (value: unknown, dev: boolean = __DEV__): string | null => {
  const text = readText(value)?.trim();
  if (!text || /\s/.test(text)) return null;
  if (/^https:\/\/[^/?#\s]+/i.test(text)) return text;
  if (!dev) return null;
  const host = /^http:\/\/([^/?#:@]+)(?::\d+)?(?:[/?#]|$)/i.exec(text)?.[1]?.toLowerCase();
  return host !== undefined && DEV_HTTP_HOSTS.has(host) ? text : null;
};

export const toShareLink = (raw: unknown): ShareLink => {
  const data = isRecord(raw) ? raw : {};
  const url = toShareableUrl(data.url);
  if (!url) throw new Error('Invalid share link response');
  return { url, expiresAt: readText(data.expires_at) };
};

/** BE-87: an SOS about women's safety is fast-tracked (high priority) to the safety team. */
export type SosCategory = 'general' | 'women_safety';

/** The SOS body: the phone's position when it has one (BE-79), nothing invented. */
export const toSosBody = (position: SosPosition | null | undefined): Record<string, number> => {
  if (!position) return {};
  const latitude = readNumberOrNull(position.latitude);
  const longitude = readNumberOrNull(position.longitude);
  if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return {};
  const accuracy = readNumberOrNull(position.accuracy);
  return { latitude, longitude, ...(accuracy !== null && accuracy >= 0 ? { accuracy } : {}) };
};

export const safetyApi = {
  async requestCall(rideId: number): Promise<CallSession> {
    return toCallSession(unwrap(await apiService.post<unknown>(`/rides/${rideId}/call`)));
  },

  async sendSos(rideId: number, position: SosPosition | null, category: SosCategory = 'general'): Promise<SosResult> {
    const body = { ...toSosBody(position), ...(category === 'women_safety' ? { category } : {}) };
    return toSosResult(unwrap(await apiService.post<unknown>(`/rides/${rideId}/sos`, body)));
  },

  async startShare(rideId: number): Promise<ShareLink> {
    return toShareLink(unwrap(await apiService.post<unknown>(`/rides/${rideId}/share`)));
  },

  /** `timeoutMs` for logout, which must not wait on a dead network. */
  async stopShare(rideId: number, timeoutMs?: number): Promise<void> {
    await apiService.delete<unknown>(`/rides/${rideId}/share`, timeoutMs ? { timeout: timeoutMs } : undefined);
  },

  async listContacts(): Promise<EmergencyContactsList> {
    return toEmergencyContactsList(unwrap(await apiService.get<unknown>('/me/emergency-contacts')));
  },

  async createContact(input: EmergencyContactInput): Promise<EmergencyContact> {
    return contactFrom(unwrap(await apiService.post<unknown>('/me/emergency-contacts', input)));
  },

  async updateContact(id: number, input: EmergencyContactInput): Promise<EmergencyContact> {
    return contactFrom(unwrap(await apiService.put<unknown>(`/me/emergency-contacts/${id}`, input)));
  },

  async removeContact(id: number): Promise<void> {
    await apiService.delete<unknown>(`/me/emergency-contacts/${id}`);
  },
};

const contactFrom = (data: unknown): EmergencyContact => {
  const contact = isRecord(data) ? toEmergencyContact(data.contact) : null;
  if (!contact) throw new Error('Invalid emergency contact response');
  return contact;
};
