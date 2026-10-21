/**
 * T-520 (BE-79): Account → Emergency contacts for both roles. The list is GET
 * /me/emergency-contacts with loading, error and an empty state that says why; Add is hidden at
 * the cap (3); Delete asks first and comes back if the server refuses. The form checks the name
 * (letters, 2-60) and a Pakistani mobile before any request, sends E.164, and shows the server's
 * 422 field errors and EMERGENCY_CONTACTS_LIMIT.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import EmergencyContactsScreen from '../../../src/features/safety/screens/EmergencyContactsScreen';
import EmergencyContactEditorScreen from '../../../src/features/safety/screens/EmergencyContactEditorScreen';
import type { EmergencyContactEditorParams } from '../../../src/features/safety/navigation';
import { formatPkPhone, toE164, validateContactName, validateContactPhone } from '../../../src/features/safety/rules';
import { dialog, dialogStore } from '../../../src/core/dialog';
import { toast } from '../../../src/core/toast';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockParams: EmergencyContactEditorParams | undefined;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ key: 'EmergencyContactEditor-1', name: 'EmergencyContactEditor', params: mockParams }),
}));

const ayesha = { id: 1, name: 'Ayesha Khan', phone: '+923001234567', created_at: 'x', updated_at: 'x' };
const bilal = { id: 2, name: 'Bilal', phone: '+923211234567', created_at: 'x', updated_at: 'x' };
const sana = { id: 3, name: 'Sana', phone: '+923331234567', created_at: 'x', updated_at: 'x' };
const listBody = (contacts: unknown[], max = 3) => ({ success: true, data: { contacts, max } });

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
};

const renderWith = async (ui: React.ReactElement) => {
  render(
    <Provider store={configureStore({ reducer: rootReducer })}>
      <ThemeProvider>{ui}</ThemeProvider>
    </Provider>,
  );
  await flush();
};

const answerDialogs = (yes: boolean) =>
  dialogStore.subscribe(() => {
    const current = dialogStore.getCurrent();
    if (current) dialog.answer(current.id, yes);
  });

let mock: MockAdapter;
let unsubscribe: (() => void) | null = null;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockParams = undefined;
  jest.spyOn(toast, 'success').mockImplementation(() => '');
  jest.spyOn(toast, 'error').mockImplementation(() => '');
});

afterEach(() => {
  unsubscribe?.();
  unsubscribe = null;
  dialog.dismissAll();
  mock.restore();
  jest.restoreAllMocks();
});

describe('Emergency contacts list', () => {
  it('empty: explains why and offers Add', async () => {
    mock.onGet('/me/emergency-contacts').reply(200, listBody([]));
    await renderWith(<EmergencyContactsScreen />);
    expect(screen.getByTestId('emergency-contacts-empty')).toHaveTextContent(/Safety button lets you alert them/);
    fireEvent.press(screen.getByTestId('emergency-contacts-empty-add'));
    expect(mockNavigate).toHaveBeenCalledWith('EmergencyContactEditor', { contactId: undefined });
  });

  it('lists the contacts with their numbers; at the cap there is no Add', async () => {
    mock.onGet('/me/emergency-contacts').reply(200, listBody([ayesha, bilal, sana]));
    await renderWith(<EmergencyContactsScreen />);
    expect(screen.getByTestId('emergency-contact-1')).toHaveTextContent(/Ayesha Khan/);
    expect(screen.getByTestId('emergency-contact-1')).toHaveTextContent(/\+92 300 1234567/);
    expect(screen.getByTestId('emergency-contacts-count')).toHaveTextContent('You have 3 contacts, the most you can add.');
    expect(screen.queryByTestId('emergency-contacts-add-button')).toBeNull();
    expect(screen.queryByTestId('emergency-contacts-add')).toBeNull();

    fireEvent.press(screen.getByTestId('emergency-contact-2'));
    // Only the id goes into the route (no name or phone in navigation state).
    expect(mockNavigate).toHaveBeenCalledWith('EmergencyContactEditor', { contactId: 2 });
  });

  it('a failed load shows the error with retry', async () => {
    mock.onGet('/me/emergency-contacts').replyOnce(500).onGet('/me/emergency-contacts').reply(200, listBody([ayesha]));
    await renderWith(<EmergencyContactsScreen />);
    screen.getByTestId('emergency-contacts-error');
    fireEvent.press(screen.getByText('Try again'));
    await flush();
    screen.getByTestId('emergency-contact-1');
  });

  it('delete asks first, removes the row, and puts it back when the server refuses', async () => {
    mock.onGet('/me/emergency-contacts').reply(200, listBody([ayesha, bilal]));
    mock.onDelete('/me/emergency-contacts/1').replyOnce(500);
    await renderWith(<EmergencyContactsScreen />);

    unsubscribe = answerDialogs(false);
    fireEvent.press(screen.getByTestId('emergency-contact-delete-1'));
    await flush();
    expect(mock.history.delete).toHaveLength(0);
    unsubscribe();

    unsubscribe = answerDialogs(true);
    fireEvent.press(screen.getByTestId('emergency-contact-delete-1'));
    await flush();
    expect(mock.history.delete.map((r) => r.url)).toEqual(['/me/emergency-contacts/1']);
    screen.getByTestId('emergency-contact-1');
    expect(toast.error).toHaveBeenCalled();

    mock.onDelete('/me/emergency-contacts/1').reply(200, { success: true, data: null });
    fireEvent.press(screen.getByTestId('emergency-contact-delete-1'));
    await flush();
    expect(screen.queryByTestId('emergency-contact-1')).toBeNull();
    expect(toast.success).toHaveBeenCalledWith('Contact deleted.');
  });
});

describe('Emergency contact form', () => {
  beforeEach(() => {
    mock.onGet('/me/emergency-contacts').reply(200, listBody([bilal]));
  });

  it('UI-R19 review: Save sits in the Form sticky footer (hairline), not inline after the fields', async () => {
    await renderWith(<EmergencyContactEditorScreen />);
    const footer = screen.getByTestId('emergency-contact-footer');
    expect(footer).toContainElement(screen.getByTestId('emergency-contact-save'));
    const style = StyleSheet.flatten(footer.props.style);
    expect(style.borderTopWidth).toBeGreaterThan(0);
    // Keyboard down: max(insets.bottom + 8, 16) (the test safe area has no inset).
    expect(style.paddingBottom).toBe(16);
  });

  it('checks the name and the PK mobile before any request', async () => {
    await renderWith(<EmergencyContactEditorScreen />);
    fireEvent.press(screen.getByTestId('emergency-contact-save'));
    await flush();
    expect(screen.getByTestId('emergency-contact-name-error')).toHaveTextContent('Enter a name.');
    expect(screen.getByTestId('emergency-contact-phone-error')).toHaveTextContent('Enter a mobile number.');

    fireEvent.changeText(screen.getByTestId('emergency-contact-name-input'), 'A1');
    fireEvent.changeText(screen.getByTestId('emergency-contact-phone-input'), '0421234567');
    fireEvent.press(screen.getByTestId('emergency-contact-save'));
    await flush();
    expect(screen.getByTestId('emergency-contact-name-error')).toHaveTextContent('Use letters only (up to 60).');
    expect(screen.getByTestId('emergency-contact-phone-error')).toHaveTextContent(/Pakistani mobile/);
    expect(mock.history.post).toHaveLength(0);
  });

  it('a valid contact is POSTed as E.164 and the form closes', async () => {
    mock.onPost('/me/emergency-contacts').reply(201, { success: true, data: { contact: ayesha } });
    await renderWith(<EmergencyContactEditorScreen />);
    fireEvent.changeText(screen.getByTestId('emergency-contact-name-input'), ' Ayesha Khan ');
    fireEvent.changeText(screen.getByTestId('emergency-contact-phone-input'), '0300 1234567');
    fireEvent.press(screen.getByTestId('emergency-contact-save'));
    await flush();
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ name: 'Ayesha Khan', phone: '+923001234567' });
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('an edit PUTs to the contact; server field errors and the cap show on the form', async () => {
    mockParams = { contactId: 2 };
    mock.onPut('/me/emergency-contacts/2').replyOnce(422, {
      success: false,
      message: 'The given data was invalid.',
      errors: { phone: ['This number is already one of your contacts.'] },
    });
    await renderWith(<EmergencyContactEditorScreen />);
    expect(screen.getByTestId('emergency-contact-phone-input').props.value).toBe('321 1234567');
    fireEvent.press(screen.getByTestId('emergency-contact-save'));
    await flush();
    expect(mock.history.put[0].url).toBe('/me/emergency-contacts/2');
    expect(screen.getByTestId('emergency-contact-phone-error')).toHaveTextContent('This number is already one of your contacts.');
    expect(mockGoBack).not.toHaveBeenCalled();

    mock.onPut('/me/emergency-contacts/2').replyOnce(422, { success: false, message: 'Limit', error: { code: 'EMERGENCY_CONTACTS_LIMIT' } });
    fireEvent.press(screen.getByTestId('emergency-contact-save'));
    await flush();
    expect(screen.getByTestId('emergency-contact-error')).toHaveTextContent('You can add up to 3 emergency contacts.');
  });

  it('an id that is not in the list says so, with retry', async () => {
    mockParams = { contactId: 99 };
    await renderWith(<EmergencyContactEditorScreen />);
    screen.getByTestId('emergency-contact-missing');
    expect(screen.queryByTestId('emergency-contact-save')).toBeNull();
  });
});

describe('contact rules', () => {
  it('validates names and PK mobiles and formats numbers', () => {
    expect(validateContactName('')).toBe('nameRequired');
    expect(validateContactName('A')).toBe('nameShort');
    expect(validateContactName('Ali 2')).toBe('nameLetters');
    expect(validateContactName("Sana O'Neil-Khan")).toBeNull();
    expect(validateContactName('عائشہ')).toBeNull();
    expect(validateContactName('x'.repeat(61))).toBe('nameLetters');
    expect(validateContactPhone('')).toBe('phoneRequired');
    expect(validateContactPhone('3001234567')).toBeNull();
    expect(validateContactPhone('4211234567')).toBe('phoneInvalid');
    expect(validateContactPhone('300123456')).toBe('phoneInvalid');
    expect(toE164('3001234567')).toBe('+923001234567');
    expect(formatPkPhone('+923001234567')).toBe('+92 300 1234567');
  });
});
