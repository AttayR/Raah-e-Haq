/**
 * UI-R18 part 2 units: the BE-129 mappers and copy (known keys only, one devices line, blockers,
 * Pay-now target by `pay_with`, server dates as text), the code-step failure mapping, routing to
 * AccountRestore from `deletion_scheduled_for`, the local-only sign-out after a deletion, and
 * "Keep my account" on a 423 ACCOUNT_DELETION_SCHEDULED (booking, going online).
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient, ApiError } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { dialog, dialogStore } from '../../../src/core/dialog';
import { toast } from '../../../src/core/toast';
import { normalizeUser, resolveAuthRoute } from '../../../src/core/auth/normalizeUser';
import { logout } from '../../../src/store/thunks/sessionThunks';
import { initializeAuth } from '../../../src/store/thunks/apiThunks';
import { authStorage } from '../../../src/services/authStorage';
import { keepAccount } from '../../../src/features/account-deletion/keepAccount';
import { toStoredUser } from '../../../src/core/auth/storedUser';
import { toDeletionStatus, toCodeSent } from '../../../src/features/account-deletion/api';
import {
  blockerView,
  eraseLines,
  formatDeletionDate,
  formatRetryAt,
  formatWait,
  keepLines,
  keepTogether,
  payNowTarget,
  reasonOptions,
} from '../../../src/features/account-deletion/format';
import { requestFailureOf } from '../../../src/features/account-deletion/requestFailure';
import { isDeletionScheduledRefusal, offerKeepAccount } from '../../../src/features/account-deletion/keepAccount';
import { classifyRideRequestFailure } from '../../../src/features/ride-booking/rideRequestFailure';
import { useDriverStatusToggle } from '../../../src/features/driver-status/hooks';
import { loadDriverStatus } from '../../../src/features/driver-status/slice';

const makeStore = () => {
  const initial = rootReducer(undefined, { type: '@@init' });
  return configureStore({
    reducer: rootReducer,
    preloadedState: {
      ...initial,
      apiAuth: {
        ...initial.apiAuth,
        isAuthenticated: true,
        isInitialized: true,
        user: { id: 5, name: 'T', email: 't@example.test', phone: null, status: 'active', role: 'driver', roles: ['driver'], deletion_scheduled_for: '2026-11-19T10:00:00+05:00' },
      },
    },
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false, thunk: { extraArgument: { purgePersistedState: () => Promise.resolve() } } }),
  });
};

const answer = async (yes: boolean) => {
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
});
afterEach(() => {
  act(() => dialog.dismissAll());
  mock.restore();
  jest.restoreAllMocks();
});

describe('GET /account/deletion mapping and copy', () => {
  it('keeps known blockers with their fields, drops junk, and reads the server dates as sent', () => {
    const status = toDeletionStatus({
      state: 'none',
      scheduled_for_if_now: '2026-11-19T10:00:00+05:00',
      retention_years: 5,
      erase: ['profile', 7, 'devices'],
      keep: ['trips'],
      blockers: [
        { code: 'COMMISSION_OWED', amount: '-120.5', currency: 'PKR', pay_with: ['topup', 'settlement'] },
        { code: 'TOPUP_PENDING', retry_after_at: '2026-10-21T10:00:00Z' },
        { code: 'SOMETHING_NEW' },
        'junk',
      ],
      wallet_balance: '0',
      is_driver: true,
    });
    expect(status.blockers).toEqual([
      { code: 'COMMISSION_OWED', amount: 120.5, currency: 'PKR', payWith: ['topup', 'settlement'] },
      { code: 'TOPUP_PENDING', retryAfterAt: '2026-10-21T10:00:00Z' },
      { code: 'OTHER' },
    ]);
    expect(status.erase).toEqual(['profile', 'devices']);
    expect(status.scheduledForIfNow).toBe('2026-11-19T10:00:00+05:00');
    expect(status.isDriver).toBe(true);
    expect(toCodeSent({ expires_in: 300, retry_after: 60, phone_masked: '+92 3•• •••• 001' })).toEqual({
      expiresIn: 300,
      retryAfter: 60,
      phoneMasked: '+92 3•• •••• 001',
    });
  });

  it('renders known keys only, devices + notifications once, device_checks as a keep line', () => {
    expect(eraseLines(['notifications', 'devices', 'documents', 'unknown']).map((l) => l.key)).toEqual(['notifications', 'documents']);
    expect(eraseLines(['notifications', 'devices'])[0].text).toBe('Notification settings and devices');
    expect(keepLines(['device_checks', 'ratings', 'nope']).map((l) => l.text)).toEqual([
      'Device checks we use to stop fraud',
      'Ratings you gave and got',
    ]);
    expect(reasonOptions(['privacy', 'made_up']).map((o) => o.slug)).toEqual(['privacy']);
    expect(reasonOptions([])).toHaveLength(6);
  });

  it('formats server dates and waits without computing a date', () => {
    expect(formatDeletionDate('2026-11-19T10:00:00+05:00')).toBe('19\u00A0Nov\u00A02026');
    expect(formatDeletionDate(null)).toBe('');
    expect(formatWait(42)).toBe('0:42');
    expect(formatWait(600)).toBe('10:00');
    expect(formatWait(7200)).toBe('2 hours');
    expect(keepTogether('+92 3•• •••• 099')).toBe('+92\u00A03••\u00A0••••\u00A0099');
    const at = new Date(2026, 9, 21, 15, 40);
    expect(formatRetryAt(at.toISOString(), new Date(2026, 9, 21, 9, 0))).toBe('3:40\u00A0PM');
    expect(formatRetryAt(at.toISOString(), new Date(2026, 9, 20, 9, 0))).toBe('21\u00A0Oct\u00A02026, 3:40\u00A0PM');
  });

  it('blocker Banners and the Pay-now target by pay_with', () => {
    expect(blockerView({ code: 'ACTIVE_RIDE' })).toMatchObject({ tone: 'danger', action: { kind: 'goToRide' } });
    expect(blockerView({ code: 'PHONE_NOT_VERIFIED' }).action?.kind).toBe('verifyPhone');
    expect(blockerView({ code: 'TOPUP_PENDING', retryAfterAt: null })).toMatchObject({ action: null });
    expect(blockerView({ code: 'OTHER' })).toMatchObject({ tone: 'danger', action: null });
    const owed = { code: 'COMMISSION_OWED' as const, amount: 300, currency: 'PKR', payWith: ['topup', 'settlement'] };
    expect(payNowTarget(owed, true)).toEqual({ route: 'PayCommission', params: { owed: 300, currency: 'PKR' } });
    expect(payNowTarget(owed, false)).toEqual({ route: 'AddMoney', params: { amount: 300 } });
    expect(payNowTarget({ ...owed, payWith: ['topup'] }, true)).toEqual({ route: 'AddMoney', params: { amount: 300 } });
  });
});

describe('POST /account/deletion failures (§D2.6)', () => {
  const err = (status: number, code?: string, extra: Partial<{ retryAfter: number; fieldErrors: Record<string, string[]> }> = {}) =>
    new ApiError({ kind: status === 429 ? 'rate_limited' : status >= 500 ? 'server' : 'validation', message: 'Server says.', status, code, ...extra });

  it('maps each refusal to what the screen does', () => {
    expect(requestFailureOf(err(422, 'INVALID_CODE'))).toEqual({ kind: 'code', message: "That code isn't right. Try again or resend it." });
    expect(requestFailureOf(err(429, 'code_exhausted', { retryAfter: 90 }))).toMatchObject({ kind: 'code', retryAfter: 90 });
    expect(requestFailureOf(err(429, 'otp_ip_limit', { retryAfter: 30 }))).toMatchObject({ kind: 'notice', notice: { tone: 'warning' } });
    expect(requestFailureOf(err(409, 'ACTIVE_RIDE'))).toEqual({ kind: 'back', reprofile: false });
    expect(requestFailureOf(err(409, 'COMMISSION_OWED'))).toEqual({ kind: 'back', reprofile: false });
    expect(requestFailureOf(err(409, 'TOPUP_PENDING'))).toEqual({ kind: 'back', reprofile: false });
    expect(requestFailureOf(err(422, 'BALANCE_NOT_ACKNOWLEDGED'))).toEqual({ kind: 'back', reprofile: false });
    expect(requestFailureOf(err(409, 'DELETION_ALREADY_SCHEDULED'))).toEqual({ kind: 'back', reprofile: true });
    expect(requestFailureOf(err(503, 'sms_unavailable'))).toEqual({ kind: 'notice', notice: { tone: 'danger', text: 'Server says.' } });
    expect(requestFailureOf(new ApiError({ kind: 'network', message: 'x' }))).toMatchObject({ kind: 'notice', notice: { tone: 'danger' } });
  });
});

describe('AccountRestore routing (§D4)', () => {
  it('normalizeUser keeps deletion_scheduled_for; AuthFlow routes to account-restore before any tab', () => {
    const user = normalizeUser({ id: 3, role: 'passenger', status: 'active', deletion_scheduled_for: '2026-11-19T10:00:00Z' });
    expect(user?.deletion_scheduled_for).toBe('2026-11-19T10:00:00Z');
    expect(resolveAuthRoute({ isInitialized: true, isAuthenticated: true, user })).toBe('account-restore');
    expect(resolveAuthRoute({ isInitialized: true, isAuthenticated: true, user: { role: 'driver', status: 'active', deletion_scheduled_for: null } })).toBe('driver');
    // A blocked account still goes to account status first.
    expect(resolveAuthRoute({ isInitialized: true, isAuthenticated: true, user: { role: 'driver', status: 'suspended', deletion_scheduled_for: 'x' } })).toBe('account-status');
  });
});

describe('cold start and the cached user (BE-129)', () => {
  const scheduledUser = {
    id: 5, name: 'T', email: 't@example.test', phone: '+923009990099', status: 'active' as const,
    role: 'driver' as const, roles: ['driver'], deletion_scheduled_for: '2026-11-19T10:00:00+05:00',
  };

  beforeEach(async () => {
    await authStorage.clear();
  });

  it('the stored user keeps the date (allowlist), never the phone', () => {
    expect(toStoredUser(scheduledUser)).toEqual({
      id: 5, name: 'T', role: 'driver', roles: ['driver'], status: 'active', deletion_scheduled_for: '2026-11-19T10:00:00+05:00',
    });
  });

  it('a cached user with the date routes to account-restore at once, without a network call', async () => {
    await authStorage.saveSession({ token: 'test-token-not-real', user: scheduledUser });
    const initial = rootReducer(undefined, { type: '@@init' });
    const store = configureStore({
      reducer: rootReducer,
      preloadedState: initial,
      middleware: (getDefault) =>
        getDefault({ serializableCheck: false, thunk: { extraArgument: { purgePersistedState: () => Promise.resolve() } } }),
    });
    const result = await store.dispatch(initializeAuth());
    expect(mock.history.get).toHaveLength(0);
    expect(result.payload).toMatchObject({ revalidate: true });
    const { apiAuth } = store.getState();
    expect(resolveAuthRoute({ isInitialized: apiAuth.isInitialized, isAuthenticated: apiAuth.isAuthenticated, user: apiAuth.user })).toBe(
      'account-restore',
    );
  });

  it('after "Keep my account" the stored user has no date', async () => {
    await authStorage.saveSession({ token: 'test-token-not-real', user: scheduledUser });
    mock.onPost('/account/deletion/cancel').reply(200, { success: true, data: { state: 'none', scheduled_for: null, cancelled: true } });
    const store = makeStore();
    await keepAccount(store.dispatch);
    expect(store.getState().apiAuth.user?.deletion_scheduled_for).toBeNull();
    const cached = await authStorage.getUser();
    expect(cached?.deletion_scheduled_for ?? null).toBeNull();
    expect(cached?.id).toBe(5);
  });
});

describe('local sign-out after a deletion', () => {
  it('serverAlreadySignedOut: no /auth/logout, no device unregister, and the session is cleared', async () => {
    mock.onAny().reply(200, { success: true });
    const store = makeStore();
    await store.dispatch(logout({ serverAlreadySignedOut: true }));
    expect(mock.history.post).toHaveLength(0);
    expect(mock.history.delete).toHaveLength(0);
    expect(store.getState().apiAuth.isAuthenticated).toBe(false);
  });
});

describe('423 ACCOUNT_DELETION_SCHEDULED → "Keep my account"', () => {
  const refusal = { kind: 'unknown' as const, message: 'x', status: 423, code: 'ACCOUNT_DELETION_SCHEDULED', fieldErrors: {} };

  it('POST /rides: classified as deletion_scheduled (not a generic error)', () => {
    expect(classifyRideRequestFailure(refusal, 'fallback')).toEqual({ kind: 'deletion_scheduled' });
    expect(isDeletionScheduledRefusal(refusal)).toBe(true);
    expect(isDeletionScheduledRefusal({ code: 'ACTIVE_RIDE' })).toBe(false);
  });

  it('offerKeepAccount: yes cancels and clears the date; "Not now" sends nothing', async () => {
    const success = jest.spyOn(toast, 'success');
    mock.onPost('/account/deletion/cancel').reply(200, { success: true, data: { state: 'none', scheduled_for: null, cancelled: true } });
    const store = makeStore();
    let kept: Promise<boolean> | undefined;
    act(() => {
      kept = offerKeepAccount(store.dispatch, 'booking');
    });
    const question = await answer(false);
    expect(question).toMatchObject({ confirmLabel: 'Keep my account', body: 'Keep your account to book rides.' });
    await expect(kept).resolves.toBe(false);
    expect(mock.history.post).toHaveLength(0);

    act(() => {
      kept = offerKeepAccount(store.dispatch, 'booking');
    });
    await answer(true);
    await expect(kept).resolves.toBe(true);
    expect(store.getState().apiAuth.user?.deletion_scheduled_for).toBeNull();
    expect(success).toHaveBeenCalledWith('Welcome back. Your account is safe.');
  });

  it('going online: the toggle offers "Keep my account" instead of an error toast', async () => {
    const errorToast = jest.spyOn(toast, 'error');
    mock.onGet('/driver/status').reply(200, {
      success: true,
      data: { status: 'offline', is_online: false, can_accept_rides: false, active_ride_id: null },
    });
    mock.onPut('/driver/status').reply(423, {
      success: false,
      message: 'Your account is set to be deleted. Keep your account to go online.',
      error: { code: 'ACCOUNT_DELETION_SCHEDULED' },
    });
    const store = makeStore();
    await store.dispatch(loadDriverStatus());
    const Wrapper = ({ children }: React.PropsWithChildren) => <Provider store={store}>{children}</Provider>;
    const { result } = renderHook(() => useDriverStatusToggle(), { wrapper: Wrapper });
    let accepted: Promise<boolean> | undefined;
    await act(async () => {
      accepted = result.current.toggle();
    });
    const question = await answer(false);
    expect(question.body).toBe('Keep your account to go online.');
    await expect(accepted).resolves.toBe(false);
    expect(errorToast).not.toHaveBeenCalled();
  });
});
