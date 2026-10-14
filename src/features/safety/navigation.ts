/**
 * Account → Emergency contacts (T-520). Both role stacks register `EmergencyContacts` and
 * `EmergencyContactEditor` with these params, so the SOS sheet can open them from either side.
 */
export const EMERGENCY_CONTACTS_ROUTE = 'EmergencyContacts' as const;
export const EMERGENCY_CONTACT_EDITOR_ROUTE = 'EmergencyContactEditor' as const;

/**
 * Only the id travels in the route: a contact's name and phone (PII) never go into navigation
 * state (which can be logged or persisted); the form reads the contact from the API list.
 */
export type EmergencyContactEditorParams = {
  /** Editing this contact; absent for a new one. */
  contactId?: number;
};

export type SafetyRoutes = {
  EmergencyContacts: undefined;
  EmergencyContactEditor: EmergencyContactEditorParams | undefined;
};

export interface EmergencyContactsNavigator {
  navigate(name: typeof EMERGENCY_CONTACTS_ROUTE): void;
  navigate(name: typeof EMERGENCY_CONTACT_EDITOR_ROUTE, params: EmergencyContactEditorParams): void;
  goBack(): void;
}
