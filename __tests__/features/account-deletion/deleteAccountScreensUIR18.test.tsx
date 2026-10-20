/**
 * UI-R18 part 2 (shared-support-invite §D1, §D2, §D4; BE-129 / BE-132 / BE-133 / BE-135): Delete
 * account from GET /account/deletion (known erase/keep keys only, `devices` + `notifications` as
 * one line, `device_checks` kept, retention years, the server's date), every blocker with its way
 * out (ACTIVE_RIDE, COMMISSION_OWED by `pay_with`, PHONE_NOT_VERIFIED, TOPUP_PENDING with and
 * without `retry_after_at`), the balance checkbox and optional reason, the code send (429 wait,
 * 503); the code step (422 INVALID_CODE, 429 code_exhausted, 409 blocker, 503, network, 200 local
 * sign-out without /auth/logout and the date Toast); AccountRestore before any tab.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient, type User } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { dialog, dialogStore } from '../../../src/core/dialog';
import { toast } from '../../../src/core/toast';
import DeleteAccountScreen from '../../../src/features/account-deletion/screens/DeleteAccountScreen';
import DeleteAccountVerifyScreen from '../../../src/features/account-deletion/screens/DeleteAccountVerifyScreen';
import AccountRestoreScreen from '../../../src/features/account-deletion/screens/AccountRestoreScreen';
import AuthFlow from '../../../src/app/navigation/AuthFlow';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockParams: Record<string, unknown> | undefined;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useRoute: () => ({ key: 'test', name: 'test', params: mockParams }),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, setOptions: jest.fn(), dispatch: jest.fn() }),
}));
// AuthFlow's home stacks are not under test here.
jest.mock('../../../src/app/navigation/RootNavigation', () => {
  const { Text } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <Text testID="home-stacks">tabs</Text> };
});

const SCHEDULED = '2026-11-19T10:00:00+05:00';

const user = (role: 'passenger' | 'driver', over: Partial<User> = {}): User => ({
  id: 9,
  name: 'Throwaway Tester',
  email: 'throwaway@example.test',
  phone: '+923009990099',
  status: 'active',
  role,
  roles: [role],
  ...over,
});

const status = (over: Record<string, unknown> = {}) => ({
  success: true,
  data: {
    state: 'none',
    scheduled_for: null,
    scheduled_for_if_now: SCHEDULED,
    grace_days: 30,
    retention_years: 5,
    erase: ['profile', 'phone_email', 'saved_places', 'emergency_contacts', 'chats', 'devices', 'notifications', 'future_key'],
    keep: ['trips', 'payments', 'safety_reports', 'support_requests', 'ratings', 'device_checks', 'another_future_key'],
    blockers: [],
    wallet_balance: 0,
    currency: 'PKR',
    phone_masked: '+92 3•• •••• 099',
    is_driver: false,
    reasons: ['not_using', 'too_expensive', 'safety', 'privacy', 'other_app', 'other'],
    ...over,
  },
});

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
};

const makeStore = (signedIn: User) => {
  const initial = rootReducer(undefined, { type: '@@init' });
  return configureStore({
    reducer: rootReducer,
    preloadedState: { ...initial, apiAuth: { ...initial.apiAuth, user: signedIn, isAuthenticated: true, isInitialized: true } },
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false, thunk: { extraArgument: { purgePersistedState: () => Promise.resolve() } } }),
  });
};

const show = async (Component: React.ComponentType, signedIn: User = user('passenger')) => {
  const store = makeStore(signedIn);
  render(
    <Provider store={store}>
      <ThemeProvider>
        <Component />
      </ThemeProvider>
    </Provider>,
  );
  await flush();
  return store;
};

const answerDialog = async (yes: boolean) => {
  await waitFor(() => expect(dialogStore.getCurrent()).not.toBeNull());
  const current = dialogStore.getCurrent();
  if (!current) throw new Error('no dialog');
  await act(async () => {
    dialog.answer(current.id, yes);
  });
  return current;
};

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockParams = undefined;
});
afterEach(() => {
  act(() => dialog.dismissAll());
  mock.restore();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('Delete account (§D1)', () => {
  it('lists the known erase and keep keys from the server, one devices line, the retention helper and the date', async () => {
    mock.onGet('/account/deletion').reply(200, status());
    await show(DeleteAccountScreen);
    expect(screen.getByTestId('delete-account-hero-body')).toHaveTextContent(/deleted for good on 19 Nov 2026/);
    expect(screen.getByText('Notification settings and devices')).toBeTruthy();
    expect(screen.getAllByText('Notification settings and devices')).toHaveLength(1);
    expect(screen.getByTestId('delete-account-erase-devices')).toBeTruthy();
    expect(screen.queryByTestId('delete-account-erase-notifications')).toBeNull();
    expect(screen.queryByTestId('delete-account-erase-future_key')).toBeNull();
    expect(screen.queryByTestId('delete-account-erase-documents')).toBeNull();
    expect(screen.getByText('Device checks we use to stop fraud')).toBeTruthy();
    expect(screen.queryByTestId('delete-account-keep-another_future_key')).toBeNull();
    expect(screen.getByTestId('delete-account-keep-helper')).toHaveTextContent(/for 5 years/);
    expect(screen.queryByTestId('delete-account-balance')).toBeNull();
    expect(screen.queryByTestId('delete-account-driver-note')).toBeNull();
    expect(screen.getByTestId('delete-account-continue')).not.toBeDisabled();
  });

  it('shows skeleton rows while loading and an error with retry (Continue stays disabled)', async () => {
    let fail: (() => void) | null = null;
    mock.onGet('/account/deletion').replyOnce(
      () =>
        new Promise((resolve) => {
          fail = () => resolve([500, { success: false }]);
        }),
    );
    await show(DeleteAccountScreen);
    expect(screen.getByTestId('delete-account-loading')).toBeTruthy();
    expect(screen.getByTestId('delete-account-continue')).toBeDisabled();
    await act(async () => {
      fail?.();
    });
    await flush();
    expect(screen.getByTestId('delete-account-error')).toHaveTextContent(/Couldn't check your account/);
    expect(screen.getByTestId('delete-account-continue')).toBeDisabled();
    mock.onGet('/account/deletion').reply(200, status());
    fireEvent.press(screen.getByText('Try again'));
    await flush();
    expect(screen.getByTestId('delete-account-erase')).toBeTruthy();
  });

  it('ACTIVE_RIDE: danger Banner with "Go to ride" (Booking for a passenger, DriverRide for a driver)', async () => {
    mock.onGet('/account/deletion').reply(200, status({ blockers: [{ code: 'ACTIVE_RIDE' }] }));
    await show(DeleteAccountScreen);
    expect(screen.getByTestId('delete-account-blocker-active_ride')).toHaveTextContent(/Finish or cancel your current ride first/);
    expect(screen.getByTestId('delete-account-continue')).toBeDisabled();
    fireEvent.press(screen.getByTestId('delete-account-blocker-active_ride-action'));
    expect(mockNavigate).toHaveBeenLastCalledWith('Booking');
    screen.unmount();
    await show(DeleteAccountScreen, user('driver'));
    fireEvent.press(screen.getByTestId('delete-account-blocker-active_ride-action'));
    expect(mockNavigate).toHaveBeenLastCalledWith('DriverRide');
  });

  it('COMMISSION_OWED: "Pay now" by pay_with (top-up only → Add money; driver with settlement → Pay commission)', async () => {
    mock.onGet('/account/deletion').reply(
      200,
      status({ wallet_balance: -350, blockers: [{ code: 'COMMISSION_OWED', amount: 350, currency: 'PKR', pay_with: ['topup'] }] }),
    );
    await show(DeleteAccountScreen);
    expect(screen.getByTestId('delete-account-blocker-commission_owed')).toHaveTextContent(/Pay the Rs 350 you owe/);
    expect(screen.queryByTestId('delete-account-balance')).toBeNull();
    fireEvent.press(screen.getByTestId('delete-account-blocker-commission_owed-action'));
    expect(mockNavigate).toHaveBeenLastCalledWith('AddMoney', { amount: 350 });
    screen.unmount();

    mock.onGet('/account/deletion').reply(
      200,
      status({ is_driver: true, blockers: [{ code: 'COMMISSION_OWED', amount: 350, currency: 'PKR', pay_with: ['topup', 'settlement'] }] }),
    );
    await show(DeleteAccountScreen, user('driver'));
    fireEvent.press(screen.getByTestId('delete-account-blocker-commission_owed-action'));
    expect(mockNavigate).toHaveBeenLastCalledWith('PayCommission', { owed: 350, currency: 'PKR' });
    expect(screen.getByTestId('delete-account-driver-note')).toHaveTextContent(/go offline/);
  });

  it('PHONE_NOT_VERIFIED goes to phone verification', async () => {
    mock.onGet('/account/deletion').reply(200, status({ blockers: [{ code: 'PHONE_NOT_VERIFIED' }] }));
    await show(DeleteAccountScreen);
    fireEvent.press(screen.getByTestId('delete-account-blocker-phone_not_verified-action'));
    expect(mockNavigate).toHaveBeenLastCalledWith('ChangePhone');
    expect(screen.getByTestId('delete-account-continue')).toBeDisabled();
  });

  it('TOPUP_PENDING without and with retry_after_at: no action, Continue disabled', async () => {
    mock.onGet('/account/deletion').reply(200, status({ blockers: [{ code: 'TOPUP_PENDING' }] }));
    await show(DeleteAccountScreen);
    expect(screen.getByTestId('delete-account-blocker-topup_pending')).toHaveTextContent(/still being processed/);
    expect(screen.queryByTestId('delete-account-blocker-topup_pending-action')).toBeNull();
    expect(screen.getByTestId('delete-account-continue')).toBeDisabled();
    screen.unmount();
    mock.onGet('/account/deletion').reply(
      200,
      status({ blockers: [{ code: 'TOPUP_PENDING', retry_after_at: '2026-12-02T15:40:00Z' }] }),
    );
    await show(DeleteAccountScreen);
    expect(screen.getByTestId('delete-account-blocker-topup_pending')).toHaveTextContent(
      /payment provider\. You can try again at 2 Dec 2026, /,
    );
  });

  it('balance > 0 needs the checkbox; Continue sends the code and opens the code step with reason and acknowledgement', async () => {
    mock.onGet('/account/deletion').reply(200, status({ wallet_balance: 120 }));
    mock.onPost('/account/deletion/code').reply(200, { success: true, data: { expires_in: 300, retry_after: 60, phone_masked: '+92 3•• •••• 099' } });
    await show(DeleteAccountScreen);
    expect(screen.getByTestId('delete-account-balance-warning')).toHaveTextContent(/Rs 120 will be lost/);
    expect(screen.getByTestId('delete-account-continue')).toBeDisabled();
    fireEvent.press(screen.getByTestId('delete-account-balance-ack'));
    fireEvent.press(screen.getByTestId('delete-account-reason-privacy'));
    expect(screen.getByTestId('delete-account-continue')).not.toBeDisabled();
    await act(async () => {
      fireEvent.press(screen.getByTestId('delete-account-continue'));
    });
    await flush();
    expect(mockNavigate).toHaveBeenCalledWith('DeleteAccountVerify', {
      phoneMasked: '+92 3•• •••• 099',
      retryAfter: 60,
      scheduledForIfNow: SCHEDULED,
      acknowledgeBalance: true,
      reason: 'privacy',
    });
  });

  it('Continue: 429 shows the wait, 503 shows the server text', async () => {
    mock.onGet('/account/deletion').reply(200, status());
    mock.onPost('/account/deletion/code').replyOnce(429, { success: false, code: 'otp_cooldown', message: 'Wait.', retry_after: 42 });
    await show(DeleteAccountScreen);
    await act(async () => {
      fireEvent.press(screen.getByTestId('delete-account-continue'));
    });
    await flush();
    expect(screen.getByTestId('delete-account-notice')).toHaveTextContent(/Wait 0:42 before asking for a new code\./);
    expect(mockNavigate).not.toHaveBeenCalled();
    mock.onPost('/account/deletion/code').replyOnce(503, {
      success: false,
      code: 'sms_unavailable',
      message: 'We cannot send SMS codes right now. Please try again later.',
      retry_after: 600,
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('delete-account-continue'));
    });
    await flush();
    expect(screen.getByTestId('delete-account-notice')).toHaveTextContent(/We cannot send SMS codes right now\. Please try again later\./);
  });

  it('already scheduled (race): shows the restore content and "Keep my account" cancels it', async () => {
    mock.onGet('/account/deletion').reply(200, status({ state: 'scheduled', scheduled_for: SCHEDULED }));
    mock.onPost('/account/deletion/cancel').reply(200, { success: true, data: { state: 'none', scheduled_for: null, cancelled: true } });
    await show(DeleteAccountScreen);
    expect(screen.getByTestId('account-restore-body')).toHaveTextContent(/19 Nov 2026/);
    expect(screen.queryByTestId('delete-account-continue')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByTestId('delete-account-restore'));
    });
    await flush();
    expect(mock.history.post.map((r) => r.url)).toEqual(['/account/deletion/cancel']);
    expect(mockGoBack).toHaveBeenCalled();
  });
});

const verifyParams = {
  phoneMasked: '+92 3•• •••• 099',
  retryAfter: 60,
  scheduledForIfNow: SCHEDULED,
  acknowledgeBalance: true,
  reason: 'other_app',
};

const enterCode = (code: string) => fireEvent.changeText(screen.getByTestId('delete-account-code-input'), code);

const pressDelete = async () => {
  await act(async () => {
    fireEvent.press(screen.getByTestId('delete-account-confirm'));
  });
  return answerDialog(true);
};

describe('Confirm it\'s you (§D2)', () => {
  beforeEach(() => {
    mockParams = verifyParams;
  });

  it('shows the masked phone, counts down to "Resend code", and enables Delete at 6 digits', async () => {
    jest.useFakeTimers();
    await show(DeleteAccountVerifyScreen);
    expect(screen.getByTestId('delete-account-verify-body')).toHaveTextContent('Enter the 6-digit code we sent to +92 3•• •••• 099.');
    expect(screen.getByTestId('delete-account-resend-wait')).toHaveTextContent('Resend code in 1:00');
    expect(screen.getByTestId('delete-account-confirm')).toBeDisabled();
    enterCode('12345');
    expect(screen.getByTestId('delete-account-confirm')).toBeDisabled();
    enterCode('123456');
    expect(screen.getByTestId('delete-account-confirm')).not.toBeDisabled();
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(screen.getByTestId('delete-account-resend')).toBeTruthy();
  });

  it('asks with a destructive Dialog and sends code, reason and acknowledgement; 200 signs out locally without /auth/logout', async () => {
    const shown = jest.spyOn(toast, 'show');
    mock.onPost('/account/deletion').reply(200, { success: true, data: { state: 'scheduled', scheduled_for: SCHEDULED } });
    mock.onPost('/auth/logout').reply(200, { success: true });
    const store = await show(DeleteAccountVerifyScreen);
    enterCode('246810');
    const question = await pressDelete();
    expect(question).toMatchObject({ title: 'Delete your account?', confirmLabel: 'Delete account', destructive: true });
    expect(question.body).toMatch(/deleted on 19 Nov 2026/);
    await flush();
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ code: '246810', reason: 'other_app', acknowledge_balance: true });
    expect(mock.history.post.some((r) => r.url === '/auth/logout')).toBe(false);
    expect(store.getState().apiAuth.isAuthenticated).toBe(false);
    expect(shown).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', title: 'Your account is closed. It will be deleted on 19 Nov 2026.', duration: 4000 }),
    );
  });

  it('Cancel in the Dialog sends nothing', async () => {
    await show(DeleteAccountVerifyScreen);
    enterCode('246810');
    await act(async () => {
      fireEvent.press(screen.getByTestId('delete-account-confirm'));
    });
    await answerDialog(false);
    expect(mock.history.post).toHaveLength(0);
  });

  it('422 INVALID_CODE clears the boxes and shows the error under them', async () => {
    mock.onPost('/account/deletion').reply(422, {
      success: false,
      message: "That code isn't right. Try again or resend it.",
      errors: { code: ["That code isn't right. Try again or resend it."] },
      error: { code: 'INVALID_CODE' },
    });
    await show(DeleteAccountVerifyScreen);
    enterCode('111111');
    await pressDelete();
    await flush();
    expect(screen.getByText("That code isn't right. Try again or resend it.")).toBeTruthy();
    expect(screen.getByTestId('delete-account-confirm')).toBeDisabled();
  });

  it('429 code_exhausted asks for a new code and restarts the resend wait', async () => {
    mock.onPost('/account/deletion').reply(429, { success: false, code: 'code_exhausted', message: 'Too many.', retry_after: 90 });
    await show(DeleteAccountVerifyScreen);
    enterCode('111111');
    await pressDelete();
    await flush();
    expect(screen.getByText('Too many wrong codes. Ask for a new code.')).toBeTruthy();
    expect(screen.getByTestId('delete-account-resend-wait')).toHaveTextContent('Resend code in 1:30');
  });

  it('409 blocker goes back to Delete account (which re-reads); 503 and network show a Banner', async () => {
    mock.onPost('/account/deletion').replyOnce(409, { success: false, message: 'Finish first.', error: { code: 'ACTIVE_RIDE' } });
    await show(DeleteAccountVerifyScreen);
    enterCode('246810');
    await pressDelete();
    await flush();
    expect(mockGoBack).toHaveBeenCalledTimes(1);

    mock.onPost('/account/deletion').replyOnce(503, { success: false, code: 'sms_unavailable', message: 'SMS is down.', retry_after: 60 });
    await pressDelete();
    await flush();
    expect(screen.getByTestId('delete-account-verify-notice')).toHaveTextContent(/SMS is down\./);

    mock.onPost('/account/deletion').networkErrorOnce();
    await pressDelete();
    await flush();
    expect(screen.getByTestId('delete-account-verify-notice')).toHaveTextContent(
      /Couldn't delete your account\. Check your connection and try again\./,
    );
  });

  it('Resend code: 429 waits its retry_after', async () => {
    mockParams = { ...verifyParams, retryAfter: 0 };
    mock.onPost('/account/deletion/code').replyOnce(429, { success: false, code: 'otp_send_limit', message: 'Limit.', retry_after: 90 });
    await show(DeleteAccountVerifyScreen);
    await act(async () => {
      fireEvent.press(screen.getByTestId('delete-account-resend'));
    });
    await flush();
    expect(screen.getByTestId('delete-account-resend-wait')).toHaveTextContent('Resend code in 1:30');
  });

  it('Resend code: a new code restarts the countdown', async () => {
    mockParams = { ...verifyParams, retryAfter: 0 };
    mock.onPost('/account/deletion/code').replyOnce(200, { success: true, data: { expires_in: 300, retry_after: 60, phone_masked: 'x' } });
    await show(DeleteAccountVerifyScreen);
    await act(async () => {
      fireEvent.press(screen.getByTestId('delete-account-resend'));
    });
    await flush();
    expect(screen.getByTestId('delete-account-resend-wait')).toHaveTextContent('Resend code in 1:00');
  });
});

describe('AccountRestore (§D4)', () => {
  it('AuthFlow shows it before any tab when deletion_scheduled_for is set', async () => {
    await show(AuthFlow, user('passenger', { deletion_scheduled_for: SCHEDULED }));
    expect(screen.getByTestId('account-restore')).toBeTruthy();
    expect(screen.queryByTestId('home-stacks')).toBeNull();
    expect(screen.getByTestId('account-restore-body')).toHaveTextContent(
      'It will be deleted on 19 Nov 2026. Keep it to carry on riding with Raah-e-Haq.',
    );
  });

  it('"Keep my account" cancels and AuthFlow shows the tabs with a welcome Toast', async () => {
    const success = jest.spyOn(toast, 'success');
    mock.onPost('/account/deletion/cancel').reply(200, { success: true, data: { state: 'none', scheduled_for: null, cancelled: true } });
    const store = await show(AuthFlow, user('driver', { deletion_scheduled_for: SCHEDULED }));
    expect(screen.getByTestId('account-restore-body')).toHaveTextContent(/carry on driving/);
    await act(async () => {
      fireEvent.press(screen.getByTestId('account-restore-keep'));
    });
    await flush();
    expect(store.getState().apiAuth.user?.deletion_scheduled_for).toBeNull();
    expect(screen.getByTestId('home-stacks')).toBeTruthy();
    expect(success).toHaveBeenCalledWith('Welcome back. Your account is safe.');
  });

  it('a failed keep shows a danger Banner with "Try again"', async () => {
    mock.onPost('/account/deletion/cancel').networkErrorOnce();
    await show(AccountRestoreScreen, user('passenger', { deletion_scheduled_for: SCHEDULED }));
    await act(async () => {
      fireEvent.press(screen.getByTestId('account-restore-keep'));
    });
    await flush();
    expect(screen.getByTestId('account-restore-error')).toHaveTextContent(/Couldn't keep your account/);
    mock.onPost('/account/deletion/cancel').reply(200, { success: true, data: { state: 'none', scheduled_for: null, cancelled: true } });
    await act(async () => {
      fireEvent.press(screen.getByTestId('account-restore-retry'));
    });
    await flush();
    expect(screen.queryByTestId('account-restore-error')).toBeNull();
  });

  it('"Sign out" asks first (normal sign-out)', async () => {
    await show(AccountRestoreScreen, user('passenger', { deletion_scheduled_for: SCHEDULED }));
    await act(async () => {
      fireEvent.press(screen.getByTestId('account-restore-sign-out'));
    });
    const question = await answerDialog(false);
    expect(question).toMatchObject({ title: 'Sign out?' });
  });
});
