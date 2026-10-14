import { useCallback, useRef } from 'react';
import { firstFieldMessages, isApiError } from '../../core/api/errors';
import { useRemoteData, type RemoteData } from '../../core/api/useRemoteData';
import { t } from '../../i18n';
import { SAFETY_CODES, safetyApi } from './api';
import type { EmergencyContact, EmergencyContactInput, EmergencyContactsList } from './types';

export interface EmergencyContactsState extends RemoteData<EmergencyContactsList> {
  contacts: EmergencyContact[];
  max: number | null;
  /**
   * Optimistic delete: the row leaves at once and comes back where it was if DELETE fails (the
   * promise then rejects for the caller's toast). A 404 (already gone) counts as deleted.
   */
  remove: (contact: EmergencyContact) => Promise<void>;
}

/**
 * GET /me/emergency-contacts for the Account screen (T-520, BE-79): loading / refreshing /
 * failed with the last good list kept, refetched quietly when `enabled` turns true again (screen
 * focus), so a contact saved on the form shows when the list comes back.
 */
export function useEmergencyContacts(enabled: boolean): EmergencyContactsState {
  const fetch = useCallback(() => safetyApi.listContacts(), []);
  const remote = useRemoteData<EmergencyContactsList>({ fetch, fallbackError: t('safety.contactsLoadFailed'), enabled });
  const { data, setData } = remote;
  const dataRef = useRef(data);
  dataRef.current = data;

  const remove = useCallback(
    async (contact: EmergencyContact) => {
      const before = dataRef.current;
      if (!before) return;
      const index = before.contacts.findIndex((c) => c.id === contact.id);
      if (index < 0) return;
      setData({ ...before, contacts: before.contacts.filter((c) => c.id !== contact.id) });
      try {
        await safetyApi.removeContact(contact.id);
      } catch (cause: unknown) {
        if (isApiError(cause) && cause.kind === 'not_found') return;
        const now = dataRef.current ?? before;
        if (!now.contacts.some((c) => c.id === contact.id)) {
          const contacts = [...now.contacts];
          contacts.splice(Math.min(index, contacts.length), 0, contact);
          setData({ ...now, contacts });
        }
        throw cause;
      }
    },
    [setData],
  );

  return { ...remote, contacts: data?.contacts ?? [], max: data?.max ?? null, remove };
}

/** POST for a new contact, PUT for an edit. */
export const saveEmergencyContact = (input: EmergencyContactInput, editing: EmergencyContact | null): Promise<EmergencyContact> =>
  editing ? safetyApi.updateContact(editing.id, input) : safetyApi.createContact(input);

export interface ContactSaveErrors {
  name: string | null;
  phone: string | null;
  form: string | null;
}

/** A refused save as field errors (422 `errors.name` / `errors.phone`) or one form line. */
export const contactSaveErrorsOf = (cause: unknown, max: number): ContactSaveErrors => {
  if (isApiError(cause)) {
    if (cause.code === SAFETY_CODES.contactsLimit) return { name: null, phone: null, form: t('safety.contactLimit', { max }) };
    const fields = firstFieldMessages(cause.fieldErrors);
    if (fields.name || fields.phone) return { name: fields.name ?? null, phone: fields.phone ?? null, form: null };
    if (cause.kind !== 'server' && cause.kind !== 'unknown' && cause.message) {
      return { name: null, phone: null, form: cause.message };
    }
  }
  return { name: null, phone: null, form: t('safety.contactSaveFailed') };
};
