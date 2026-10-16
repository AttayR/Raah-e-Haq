/**
 * T-504b screens: Edit profile (PUT /profile with only the changed fields, driver 18+, email
 * change with the current password, field errors from the server, discard guard), Change number
 * (POST /profile/phone → code → /verify; wrong code and the daily cap shown inline, never a
 * sign-out; Cancel change → DELETE pending) and the account banners (verify your number, email
 * waiting for its link, confirm your email after a warning).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient, type User } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import ProfileEditScreen from '../../../src/features/profile-edit/screens/ProfileEditScreen';
import ChangePhoneScreen from '../../../src/features/profile-edit/screens/ChangePhoneScreen';
import { AccountChecks } from '../../../src/features/profile-edit';
import { ProfileInfoList, profileInfoRows } from '../../../src/components/passenger/settings/ProfileInfoList';
import { dialog, dialogStore } from '../../../src/core/dialog';
import { toast } from '../../../src/core/toast';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockDispatch = jest.fn();
let mockPreventRemove: { enabled: boolean; onPrevent: (event: { data: { action: unknown } }) => void } | null = null;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, dispatch: mockDispatch }),
  usePreventRemove: (enabled: boolean, onPrevent: (event: { data: { action: unknown } }) => void) => {
    mockPreventRemove = { enabled, onPrevent };
  },
}));

const rider: User = {
  id: 7,
  name: 'Test Rider',
  email: 'rider@example.test',
  email_verified: true,
  phone: '+923000000007',
  pending_phone: null,
  pending_email: null,
  status: 'active',
  role: 'passenger',
  roles: ['passenger'],
  gender: 'female',
  date_of_birth: '1995-10-08',
  address: 'House 1, Street 2, Lahore',
};

const driver: User = { ...rider, id: 8, role: 'driver', roles: ['driver'] };

const serverProfile = (user: User, extra: Record<string, unknown> = {}) => ({ ...user, ...extra });

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
};

const renderWith = async (ui: React.ReactElement, user: User) => {
  const initial = rootReducer(undefined, { type: '@@init' });
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: { ...initial, apiAuth: { ...initial.apiAuth, user, isAuthenticated: true } },
  });
  render(
    <Provider store={store}>
      <ThemeProvider>{ui}</ThemeProvider>
    </Provider>,
  );
  await flush();
  return store;
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
  mockDispatch.mockClear();
  mockPreventRemove = null;
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

const press = async (testID: string) => {
  fireEvent.press(screen.getByTestId(testID));
  await flush();
};

describe('Edit profile', () => {
  it('starts from the profile; Save sends only the changed name, then goes back', async () => {
    let sent: unknown = null;
    mock.onPut('/profile').reply((config) => {
      sent = JSON.parse(config.data);
      return [200, { success: true, message: 'Profile updated', data: serverProfile(rider, { name: 'New Name' }) }];
    });
    const store = await renderWith(<ProfileEditScreen />, rider);

    expect(screen.getByTestId('profile-edit-name-input').props.value).toBe('Test Rider');
    expect(screen.getByTestId('profile-edit-save')).toBeDisabled();
    expect(mockPreventRemove?.enabled).toBe(false);

    fireEvent.changeText(screen.getByTestId('profile-edit-name-input'), 'New Name');
    await flush();
    expect(mockPreventRemove?.enabled).toBe(true);
    await press('profile-edit-save');

    expect(sent).toEqual({ name: 'New Name' });
    expect(toast.success).toHaveBeenCalledWith('Profile updated.');
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(store.getState().apiAuth.user?.name).toBe('New Name');
  });

  it('BE-89: a rank/staff name refused by the server shows under the name field; the profile keeps the old name', async () => {
    const staffMessage = 'Please use your own name. Names that look like Raah-e-Haq staff or support are not allowed.';
    mock.onPut('/profile').reply(422, {
      success: false,
      message: staffMessage,
      errors: { name: [staffMessage] },
    });
    const store = await renderWith(<ProfileEditScreen />, rider);

    fireEvent.changeText(screen.getByTestId('profile-edit-name-input'), 'Raah-e-Haq Support');
    await flush();
    await press('profile-edit-save');

    expect(JSON.parse(mock.history.put[0].data)).toEqual({ name: 'Raah-e-Haq Support' });
    expect(screen.getByTestId('profile-edit-name-error')).toHaveTextContent(staffMessage);
    expect(store.getState().apiAuth.user?.name).toBe('Test Rider');
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('a driver under 18 sees the rule under the field and nothing is sent', async () => {
    await renderWith(<ProfileEditScreen />, driver);
    fireEvent.changeText(screen.getByTestId('profile-edit-dob-input'), '2020-01-01');
    await flush();
    await press('profile-edit-save');
    expect(screen.getByTestId('profile-edit-dob-error')).toHaveTextContent('Drivers must be at least 18 years old.');
    expect(mock.history.put).toHaveLength(0);
  });

  it('T-545: the form scrolls the focused field above the keyboard; number pad and bio get the iOS Done bar', async () => {
    await renderWith(<ProfileEditScreen />, driver);
    const scroll = screen.getByTestId('profile-edit-scroll');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    // T-548: the number pad (date of birth) and the multiline bio each get their own Done bar
    // (Fabric attaches a shared one to the first input only); Address gets none.
    const dobId = screen.getByTestId('profile-edit-dob-input').props.inputAccessoryViewID;
    const bioId = screen.getByTestId('profile-edit-bio-input').props.inputAccessoryViewID;
    expect(dobId).toBeTruthy();
    expect(bioId).toBeTruthy();
    expect(bioId).not.toBe(dobId);
    expect(screen.getByTestId('profile-edit-address-input').props.inputAccessoryViewID).toBeUndefined();
    expect(screen.getByTestId('profile-edit-dob-done')).toBeTruthy();
    expect(screen.getByTestId('profile-edit-bio-done')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Done' })).toHaveLength(2);
    // The sticky Save bar stays outside the scroll view.
    expect(screen.getByTestId('profile-edit-scroll')).not.toContainElement(screen.getByTestId('profile-edit-save'));
  });

  it('T-550: clearing a saved address sends address null (BE-101) and the profile drops it', async () => {
    let sent: unknown = null;
    mock.onPut('/profile').reply((config) => {
      sent = JSON.parse(config.data);
      return [200, { success: true, message: 'Profile updated', data: serverProfile(rider, { address: null }) }];
    });
    const store = await renderWith(<ProfileEditScreen />, rider);
    fireEvent.changeText(screen.getByTestId('profile-edit-address-input'), '   ');
    await flush();
    await press('profile-edit-save');
    expect(screen.queryByTestId('profile-edit-address-error')).toBeNull();
    expect(sent).toEqual({ address: null });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(store.getState().apiAuth.user?.address).toBeUndefined();
  });

  it('T-545: the phone helper sits under the row at full width (not cut next to "Change number")', async () => {
    await renderWith(<ProfileEditScreen />, rider);
    expect(screen.getByTestId('profile-edit-phone-helper')).toHaveTextContent(
      'Your number changes only after you enter the code we text to the new one.',
    );
    expect(screen.getByTestId('profile-edit-phone')).not.toContainElement(screen.getByTestId('profile-edit-phone-helper'));
    expect(screen.getByTestId('profile-edit-change-phone').props.accessibilityHint).toMatch(/code we text/);
  });

  it('a new email asks for the current password; a refused password shows under it and keeps the session', async () => {
    mock.onPut('/profile').reply(422, {
      success: false,
      message: 'The current password is incorrect.',
      errors: { current_password: ['The current password is incorrect.'] },
    });
    const store = await renderWith(<ProfileEditScreen />, rider);
    expect(screen.queryByTestId('profile-edit-password')).toBeNull();

    fireEvent.changeText(screen.getByTestId('profile-edit-email-input'), 'new@example.test');
    await flush();
    await press('profile-edit-save');
    expect(screen.getByTestId('profile-edit-password-error')).toHaveTextContent(/current password/);
    expect(mock.history.put).toHaveLength(0);

    fireEvent.changeText(screen.getByTestId('profile-edit-password-input'), 'wrong-pass');
    await flush();
    await press('profile-edit-save');
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ email: 'new@example.test', current_password: 'wrong-pass' });
    expect(screen.getByTestId('profile-edit-password-error')).toHaveTextContent('The current password is incorrect.');
    expect(store.getState().apiAuth).toMatchObject({ isAuthenticated: true, user: { email: 'rider@example.test' } });
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('an accepted email change shows the server message', async () => {
    mock.onPut('/profile').reply(200, {
      success: true,
      message: 'Profile updated. To change your email, open the link we sent to the new address.',
      data: serverProfile(rider, { pending_email: 'new@example.test' }),
    });
    await renderWith(<ProfileEditScreen />, rider);
    fireEvent.changeText(screen.getByTestId('profile-edit-email-input'), 'new@example.test');
    fireEvent.changeText(screen.getByTestId('profile-edit-password-input'), 'right-pass');
    await flush();
    await press('profile-edit-save');
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/open the link/));
  });

  it('the phone is read-only here and opens Change number; leaving dirty asks first', async () => {
    unsubscribe = answerDialogs(true);
    await renderWith(<ProfileEditScreen />, rider);
    await press('profile-edit-change-phone');
    expect(mockNavigate).toHaveBeenCalledWith('ChangePhone');

    fireEvent.changeText(screen.getByTestId('profile-edit-address-input'), 'Somewhere else in Lahore');
    await flush();
    await act(async () => mockPreventRemove?.onPrevent({ data: { action: { type: 'GO_BACK' } } }));
    await flush();
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
  });
});

describe('Change number', () => {
  it('sends a code to the new number, a wrong code stays inline, the right one verifies', async () => {
    mock.onPost('/profile/phone').reply(200, {
      success: true,
      message: 'A verification code has been sent to your new number.',
      phone_verification: { phone: '+923001112222', code_sent: true, expires_in: 300 },
      data: serverProfile(rider, { pending_phone: '+923001112222' }),
    });
    mock.onPost('/profile/phone/verify').replyOnce(422, {
      success: false,
      message: 'Invalid or expired code.',
      code: 'invalid_code',
      errors: { otp_code: ['Invalid or expired code.'] },
    });
    mock.onPost('/profile/phone/verify').replyOnce(200, {
      success: true,
      message: 'Phone number verified.',
      data: serverProfile(rider, { phone: '+923001112222', pending_phone: null }),
    });
    const store = await renderWith(<ChangePhoneScreen />, rider);

    fireEvent.changeText(screen.getByTestId('change-phone-number-input'), '3001112222');
    await press('change-phone-send');
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ phone: '+923001112222' });
    expect(screen.getByTestId('change-phone-sent-to')).toHaveTextContent(/\+92 300 1112222/);

    fireEvent.changeText(screen.getByTestId('change-phone-code-input'), '000000');
    await flush();
    expect(screen.getByText('Invalid or expired code.')).toBeTruthy();
    expect(store.getState().apiAuth.isAuthenticated).toBe(true);
    expect(mockGoBack).not.toHaveBeenCalled();
    // T-545: the wrong code is cleared (the message stays), so the next code starts from empty boxes.
    expect(screen.getByTestId('change-phone-code-input').props.value).toBe('');
    expect(screen.getByTestId('change-phone-verify')).toBeDisabled();

    // The next full code submits on its own (OtpInput completion).
    fireEvent.changeText(screen.getByTestId('change-phone-code-input'), '123456');
    await flush();
    expect(JSON.parse(mock.history.post[2].data)).toEqual({ otp_code: '123456' });
    expect(toast.success).toHaveBeenCalledWith('Your number is verified.');
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(store.getState().apiAuth.user).toMatchObject({ phone: '+923001112222', pending_phone: null });
  });

  it('the daily cap (429 otp_send_limit) is shown and holds Send', async () => {
    mock.onPost('/profile/phone').reply(429, {
      success: false,
      message: 'You have reached the limit of codes for today.',
      code: 'otp_send_limit',
      retry_after: 3600,
    });
    const store = await renderWith(<ChangePhoneScreen />, rider);
    fireEvent.changeText(screen.getByTestId('change-phone-number-input'), '3001112222');
    await press('change-phone-send');
    expect(screen.getByTestId('change-phone-error')).toHaveTextContent('You have reached the limit of codes for today.');
    expect(screen.getByTestId('change-phone-send')).toBeDisabled();
    expect(store.getState().apiAuth.isAuthenticated).toBe(true);
  });

  it('checks the number before sending', async () => {
    await renderWith(<ChangePhoneScreen />, rider);
    fireEvent.changeText(screen.getByTestId('change-phone-number-input'), '12345');
    await press('change-phone-send');
    expect(screen.getByTestId('change-phone-number-error')).toHaveTextContent(/Pakistani mobile/);
    expect(mock.history.post).toHaveLength(0);
  });

  it('a number already waiting opens on the code step; Cancel change deletes it after a confirm', async () => {
    unsubscribe = answerDialogs(true);
    mock.onDelete('/profile/phone/pending').reply(200, {
      success: true,
      message: 'Pending phone number change cancelled.',
      data: serverProfile(rider, { pending_phone: null }),
    });
    const store = await renderWith(<ChangePhoneScreen />, { ...rider, pending_phone: '+923009998888' });
    expect(screen.getByTestId('change-phone-sent-to')).toHaveTextContent(/\+92 300 9998888/);

    await press('change-phone-cancel');
    expect(mock.history.delete).toHaveLength(1);
    expect(toast.success).toHaveBeenCalledWith('Number change cancelled.');
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(store.getState().apiAuth.user?.pending_phone).toBeNull();
  });
});

describe('Account banners', () => {
  it('no verified number: "Verify your number" opens the phone flow; nothing is requested', async () => {
    const onOpenPhone = jest.fn();
    await renderWith(<AccountChecks user={{ ...rider, phone: null }} onOpenPhone={onOpenPhone} />, rider);
    await press('account-checks-verify-phone-action');
    expect(onOpenPhone).toHaveBeenCalledTimes(1);
    expect(mock.history.get).toHaveLength(0);
  });

  it('nothing needed: no banner', async () => {
    await renderWith(<AccountChecks user={rider} onOpenPhone={jest.fn()} />, rider);
    expect(screen.queryByTestId('account-checks')).toBeNull();
  });

  it('an email waiting for its link: Cancel change sends the current email back', async () => {
    const user = { ...rider, pending_email: 'next@example.test' };
    mock.onPut('/profile').reply(200, { success: true, message: 'Profile updated', data: serverProfile(rider) });
    await renderWith(<AccountChecks user={user} onOpenPhone={jest.fn()} />, user);
    expect(screen.getByTestId('account-checks-pending-email')).toHaveTextContent(/next@example.test/);
    await press('account-checks-pending-email-action');
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ email: 'rider@example.test' });
    expect(toast.success).toHaveBeenCalledWith('Email change cancelled.');
  });

  it('an unconfirmed email: warns first, then sends the link and shows the server message; 429 says try later', async () => {
    const user = { ...rider, email_verified: false };
    mock.onPost('/profile/email/resend-confirmation').replyOnce(200, {
      success: true,
      message: 'If your email address still needs confirming, we have sent a new link to it. Check your inbox.',
      data: serverProfile(user),
    });
    mock.onPost('/profile/email/resend-confirmation').replyOnce(429, { message: 'Too Many Attempts.' });

    unsubscribe = answerDialogs(false);
    await renderWith(<AccountChecks user={user} onOpenPhone={jest.fn()} />, user);
    await press('account-checks-confirm-email-action');
    expect(mock.history.post).toHaveLength(0);
    unsubscribe();

    unsubscribe = answerDialogs(true);
    await press('account-checks-confirm-email-action');
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/sent a new link/));
    await press('account-checks-confirm-email-action');
    expect(toast.error).toHaveBeenCalledWith('You asked for several links. Please try again in a few minutes.');
  });

  it('T-545: the pending-email action sits under the text, so the address keeps the full width', async () => {
    const user = { ...rider, pending_email: 'passenger@raah-e-haq.com.pk' };
    await renderWith(<AccountChecks user={user} onOpenPhone={jest.fn()} />, user);
    const banner = screen.getByTestId('account-checks-pending-email');
    const action = screen.getByTestId('account-checks-pending-email-action');
    expect(banner).toContainElement(action);
    expect(StyleSheet.flatten(action.props.style)).toMatchObject({ alignSelf: 'flex-start' });
  });

  it('Account tab mode shows only the number banner', async () => {
    const user = { ...rider, phone: null, email_verified: false, pending_email: 'next@example.test' };
    await renderWith(<AccountChecks user={user} onOpenPhone={jest.fn()} phoneOnly />, user);
    expect(screen.getByTestId('account-checks-verify-phone')).toBeTruthy();
    expect(screen.queryByTestId('account-checks-confirm-email')).toBeNull();
    expect(screen.queryByTestId('account-checks-pending-email')).toBeNull();
  });
});

describe('Profile personal info (T-545)', () => {
  it('shows address and bio in full for both roles when the profile has them', async () => {
    const bio = 'I drive mornings in Gulberg and DHA. '.repeat(6).trim();
    for (const user of [rider, driver]) {
      const withText = { ...user, bio };
      await renderWith(<ProfileInfoList user={withText} />, withText);
      expect(screen.getByTestId('passenger-profile-address')).toHaveTextContent(/House 1, Street 2, Lahore/);
      const bioText = screen.getByText(bio);
      expect(bioText.props.numberOfLines).toBe(0);
      screen.unmount();
    }
  });

  it('leaves out blank address and bio', () => {
    const keys = profileInfoRows({ ...rider, address: '  ', bio: undefined }).map((row) => row.key);
    expect(keys).not.toContain('address');
    expect(keys).not.toContain('bio');
    expect(profileInfoRows({ ...rider, bio: 'Hi' }).map((row) => row.key)).toEqual(['phone', 'email', 'gender', 'dob', 'address', 'bio']);
  });
});
