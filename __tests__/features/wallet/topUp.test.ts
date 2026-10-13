/**
 * T-515 (BE-74): wallet top-up logic. Mappers and the POST/GET calls, the form validation
 * against the server's limits, one Idempotency-Key per attempt (reused only when the same
 * attempt is retried after a lost answer), status polling that stops on a terminal state,
 * expiry, 404, blur and unmount, and the return-link parsing.
 */
import MockAdapter from 'axios-mock-adapter';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { apiClient } from '../../../src/services/api';
import { toTopUpResult, toTopUpBody, toWallet, toTransaction, walletApi } from '../../../src/features/wallet/api';
import { canTopUpToday, topUpPresets, validateTopUpForm, type TopUpFormValues } from '../../../src/features/wallet/topUpForm';
import { isForegroundState, newIdempotencyKey, useCreateTopUp, useTopUpStatus } from '../../../src/features/wallet/topUpHooks';
import { Linking } from 'react-native';
import { isAllowedCheckoutUrl, isTopUpReturnUrl, topUpIdFromPath, topUpIdFromUrl } from '../../../src/features/wallet/topUpLinks';
import { transactionIcon } from '../../../src/features/wallet/format';
import { createLinking, stateForPath, type AuthSnapshot } from '../../../src/app/navigation/linking';
import { CHECKOUT_ORIGIN_WHITELIST, checkoutDecision } from '../../../src/features/wallet/screens/TopUpCheckoutScreen';
import type { TopUpConfig } from '../../../src/features/wallet/types';
import { envelope, rawTopUp, rawTopUpConfig, rawTransaction, rawWallet } from '../../../test-utils/walletFixtures';

const TOP_UP_ID = 'top_01k7testtesttesttesttestte';
const FUTURE = '2099-01-01T00:00:00+00:00';

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
  jest.useRealTimers();
});

const config = (overrides: Record<string, unknown> = {}): TopUpConfig => {
  const wallet = toWallet(rawWallet({ can_top_up: true, top_up: rawTopUpConfig(overrides) }));
  if (!wallet.topUp) throw new Error('fixture has no top-up config');
  return wallet.topUp;
};

describe('mappers', () => {
  it('reads can_top_up and the provider list from GET /wallet; hides it without providers', () => {
    const wallet = toWallet(rawWallet({ can_top_up: true, top_up: rawTopUpConfig() }));
    expect(wallet.canTopUp).toBe(true);
    expect(wallet.topUp).toEqual({
      providers: [{ id: 'fake', name: 'Test gateway', methods: ['mwallet', 'card'] }],
      minAmount: 100,
      maxAmount: 25000,
      dailyCap: 50000,
      dailyRemaining: 49500,
      currency: 'PKR',
    });
    expect(toWallet(rawWallet()).canTopUp).toBe(false);
    expect(toWallet(rawWallet({ top_up: rawTopUpConfig({ providers: [] }) })).topUp).toBeNull();
    // A method the app does not know is dropped; a provider with none left is dropped.
    expect(
      toWallet(rawWallet({ top_up: rawTopUpConfig({ providers: [{ id: 'x', name: 'X', methods: ['crypto'] }] }) })).topUp,
    ).toBeNull();
  });

  it('maps a top-up with each next_action', () => {
    expect(toTopUpResult(rawTopUp())).toEqual({
      topUp: expect.objectContaining({ id: TOP_UP_ID, provider: 'fake', method: 'mwallet', amount: 500, status: 'pending', mobileNumber: '0300*****67' }),
      nextAction: { type: 'poll', pollIntervalSeconds: 3, message: expect.stringContaining('Approve') },
    });
    expect(
      toTopUpResult(
        rawTopUp({ method: 'card', status: 'created', next_action: { type: 'redirect', url: 'https://pay.example.test/c/1', return_url: 'raahehaq://wallet/topup' } }),
      )?.nextAction,
    ).toEqual({ type: 'redirect', url: 'https://pay.example.test/c/1', returnUrl: 'raahehaq://wallet/topup' });
    expect(toTopUpResult(rawTopUp({ status: 'succeeded', next_action: { type: 'none' } }))?.nextAction).toEqual({ type: 'none' });
    // Missing next_action: keep checking while open.
    expect(toTopUpResult(rawTopUp({ next_action: undefined }))?.nextAction.type).toBe('poll');
    expect(toTopUpResult({ id: null })).toBeNull();
  });

  it('keeps topup_id on ledger entries and gives top-ups their own icon', () => {
    const entry = toTransaction(rawTransaction({ type: 'topup', label: 'Wallet Top-up', direction: 'credit', topup_id: TOP_UP_ID }));
    expect(entry?.topupId).toBe(TOP_UP_ID);
    expect(transactionIcon({ type: 'topup', direction: 'credit' })).toBe('topUp');
  });

  it('sends the mobile number and CNIC digits only for a mobile-account top-up', () => {
    expect(toTopUpBody({ amount: 500, provider: 'jazzcash', method: 'mwallet', mobileNumber: '03001234567', cnicLast6: '123456' })).toEqual({
      amount: 500,
      provider: 'jazzcash',
      method: 'mwallet',
      mobile_number: '03001234567',
      cnic_last6: '123456',
    });
    expect(toTopUpBody({ amount: 500, provider: 'jazzcash', method: 'card', mobileNumber: '03001234567', cnicLast6: '123456' })).toEqual({
      amount: 500,
      provider: 'jazzcash',
      method: 'card',
    });
  });
});

describe('validateTopUpForm', () => {
  const values = (overrides: Partial<TopUpFormValues> = {}): TopUpFormValues => ({
    amount: '500',
    provider: 'fake',
    method: 'mwallet',
    mobile: '3001234567',
    cnic: '',
    ...overrides,
  });

  it('builds the request (national number with its 0)', () => {
    expect(validateTopUpForm(values(), config())).toEqual({
      ok: true,
      request: { amount: 500, provider: 'fake', method: 'mwallet', mobileNumber: '03001234567' },
    });
    expect(validateTopUpForm(values({ method: 'card', mobile: '' }), config())).toEqual({
      ok: true,
      request: { amount: 500, provider: 'fake', method: 'card' },
    });
  });

  it('checks the amount against min, max and what is left of today', () => {
    const cfg = config({ daily_remaining: 1500 });
    expect(validateTopUpForm(values({ amount: '' }), cfg)).toMatchObject({ ok: false, errors: { amount: 'Enter an amount.' } });
    expect(validateTopUpForm(values({ amount: '50.5' }), cfg)).toMatchObject({ ok: false, errors: { amount: expect.stringContaining('whole rupee') } });
    expect(validateTopUpForm(values({ amount: '99' }), cfg)).toMatchObject({ ok: false, errors: { amount: 'The minimum top-up is Rs 100.' } });
    expect(validateTopUpForm(values({ amount: '30000' }), cfg)).toMatchObject({ ok: false, errors: { amount: 'The most you can add at once is Rs 25,000.' } });
    expect(validateTopUpForm(values({ amount: '2000' }), cfg)).toMatchObject({ ok: false, errors: { amount: 'You can add up to Rs 1,500 more today.' } });
    expect(validateTopUpForm(values({ amount: '1500' }), cfg).ok).toBe(true);
  });

  it('needs a provider, a listed method and a Pakistani mobile number', () => {
    const result = validateTopUpForm(values({ provider: null, method: null }), config());
    expect(result).toMatchObject({ ok: false, errors: { provider: expect.any(String), method: expect.any(String) } });
    const cardOnly = config({ providers: [{ id: 'easypaisa', name: 'Easypaisa', methods: ['card'] }] });
    expect(validateTopUpForm(values({ provider: 'easypaisa' }), cardOnly)).toMatchObject({ ok: false, errors: { method: expect.any(String) } });
    expect(validateTopUpForm(values({ mobile: '' }), config())).toMatchObject({ ok: false, errors: { mobile: 'Enter your mobile account number.' } });
    expect(validateTopUpForm(values({ mobile: '2001234567' }), config())).toMatchObject({ ok: false, errors: { mobile: expect.stringContaining('Pakistani') } });
  });

  it('asks JazzCash mobile accounts for the CNIC last 6 digits, and only them', () => {
    const jazz = config({ providers: [{ id: 'jazzcash', name: 'JazzCash', methods: ['mwallet', 'card'] }] });
    expect(validateTopUpForm(values({ provider: 'jazzcash' }), jazz)).toMatchObject({ ok: false, errors: { cnic: 'Enter the last 6 digits of your CNIC.' } });
    expect(validateTopUpForm(values({ provider: 'jazzcash', cnic: '12345' }), jazz)).toMatchObject({ ok: false, errors: { cnic: 'Enter exactly 6 digits.' } });
    expect(validateTopUpForm(values({ provider: 'jazzcash', cnic: '123456' }), jazz)).toEqual({
      ok: true,
      request: { amount: 500, provider: 'jazzcash', method: 'mwallet', mobileNumber: '03001234567', cnicLast6: '123456' },
    });
    expect(validateTopUpForm(values({ provider: 'jazzcash', method: 'card', cnic: '' }), jazz).ok).toBe(true);
  });

  it('offers only the presets that fit the limits and today', () => {
    expect(topUpPresets(config())).toEqual([500, 1000, 2000, 5000]);
    expect(topUpPresets(config({ daily_remaining: 1800 }))).toEqual([500, 1000]);
    expect(topUpPresets(config({ min_amount: 1000, max_amount: 2000 }))).toEqual([1000, 2000]);
    expect(canTopUpToday(config({ daily_remaining: 50 }))).toBe(false);
  });
});

describe('Idempotency-Key', () => {
  it('is a UUID v4 within the server pattern', () => {
    const key = newIdempotencyKey();
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(key).toMatch(/^[A-Za-z0-9._:-]{8,100}$/);
    expect(newIdempotencyKey()).not.toBe(key);
  });

  const request = { amount: 500, provider: 'fake', method: 'mwallet' as const, mobileNumber: '03001234567' };
  const keys = () => mock.history.post.map((call) => call.headers?.['Idempotency-Key']);

  it('POSTs the body with the key header', async () => {
    mock.onPost('/wallet/topups').reply(201, envelope(rawTopUp()));
    const result = await walletApi.createTopUp(request, 'key-12345678');
    expect(result?.topUp.id).toBe(TOP_UP_ID);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ amount: 500, provider: 'fake', method: 'mwallet', mobile_number: '03001234567' });
    expect(keys()).toEqual(['key-12345678']);
  });

  it('reuses the key when the same attempt is retried after a network failure', async () => {
    mock.onPost('/wallet/topups').networkErrorOnce();
    mock.onPost('/wallet/topups').reply(201, envelope(rawTopUp()));
    const { result } = renderHook(() => useCreateTopUp());

    await act(async () => {
      await expect(result.current.create(request)).rejects.toMatchObject({ kind: 'network' });
    });
    let created: unknown;
    await act(async () => {
      created = await result.current.create(request);
    });
    expect(created).toMatchObject({ topUp: { id: TOP_UP_ID } });
    const [first, second] = keys();
    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });

  it('uses a fresh key for a new attempt: after success, after a refusal, or with changed details', async () => {
    mock
      .onPost('/wallet/topups')
      .replyOnce(201, envelope(rawTopUp()))
      .onPost('/wallet/topups')
      .replyOnce(409, { success: false, message: 'You have 3 top-ups waiting.', error: { code: 'TOO_MANY_OPEN_TOPUPS' } })
      .onPost('/wallet/topups')
      .networkErrorOnce()
      .onPost('/wallet/topups')
      .reply(201, envelope(rawTopUp()));
    const { result } = renderHook(() => useCreateTopUp());

    await act(async () => {
      await result.current.create(request);
    });
    await act(async () => {
      await expect(result.current.create(request)).rejects.toMatchObject({ kind: 'conflict' });
    });
    await act(async () => {
      await expect(result.current.create(request)).rejects.toMatchObject({ kind: 'network' });
    });
    await act(async () => {
      await result.current.create({ ...request, amount: 1000 });
    });
    const all = keys();
    expect(all).toHaveLength(4);
    expect(new Set(all).size).toBe(4);
  });

  it('never sends twice while a create is in flight', async () => {
    mock.onPost('/wallet/topups').reply(201, envelope(rawTopUp()));
    const { result } = renderHook(() => useCreateTopUp());
    await act(async () => {
      const [a, b] = await Promise.all([result.current.create(request), result.current.create(request)]);
      expect(a).not.toBeNull();
      expect(b).toBeNull();
    });
    expect(mock.history.post).toHaveLength(1);
  });
});

describe('useTopUpStatus (polling)', () => {
  const url = `/wallet/topups/${TOP_UP_ID}`;
  const pending = () => envelope(rawTopUp({ expires_at: FUTURE }));
  const succeeded = () =>
    envelope(rawTopUp({ status: 'succeeded', transaction_id: 'TXN-01K7TEST', expires_at: FUTURE, next_action: { type: 'none' } }));
  const tick = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
    await act(async () => {
      await Promise.resolve();
    });
  };

  it('polls every 3 s while open and stops for good once it succeeds', async () => {
    jest.useFakeTimers();
    mock.onGet(url).replyOnce(200, pending()).onGet(url).reply(200, succeeded());
    const initial = toTopUpResult(rawTopUp({ expires_at: FUTURE }));
    const { result } = renderHook(() => useTopUpStatus(TOP_UP_ID, initial, true));

    // The POST answer said "poll": the first check waits one interval.
    expect(mock.history.get).toHaveLength(0);
    await tick(3000);
    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    await tick(3000);
    await waitFor(() => expect(result.current.result?.topUp.status).toBe('succeeded'));
    expect(mock.history.get).toHaveLength(2);
    await tick(30000);
    expect(mock.history.get).toHaveLength(2);
  });

  it('checks at once without a POST answer (return link), pauses while inactive and clears on unmount', async () => {
    jest.useFakeTimers();
    mock.onGet(url).reply(200, pending());
    const { rerender, unmount } = renderHook(({ active }: { active: boolean }) => useTopUpStatus(TOP_UP_ID, null, active), {
      initialProps: { active: true },
    });
    await waitFor(() => expect(mock.history.get).toHaveLength(1));

    rerender({ active: false });
    await tick(15000);
    expect(mock.history.get).toHaveLength(1);

    rerender({ active: true });
    await waitFor(() => expect(mock.history.get).toHaveLength(2));
    unmount();
    await tick(15000);
    expect(mock.history.get).toHaveLength(2);
  });

  it('stops after expires_at (still waiting) until "Check again"', async () => {
    jest.useFakeTimers();
    mock.onGet(url).reply(200, envelope(rawTopUp({ expires_at: '2020-01-01T00:00:00+00:00' })));
    const { result } = renderHook(() => useTopUpStatus(TOP_UP_ID, null, true));
    await waitFor(() => expect(result.current.timedOut).toBe(true));
    await tick(30000);
    expect(mock.history.get).toHaveLength(1);

    act(() => result.current.checkAgain());
    await waitFor(() => expect(mock.history.get).toHaveLength(2));
  });

  it('stops on 404 (not the caller\'s top-up)', async () => {
    jest.useFakeTimers();
    mock.onGet(url).reply(404, { success: false, message: 'Top-up not found', error: { code: 'NOT_FOUND' } });
    const { result } = renderHook(() => useTopUpStatus(TOP_UP_ID, null, true));
    await waitFor(() => expect(result.current.gone).toBe(true));
    expect(result.current.error).toBe('Top-up not found');
    await tick(30000);
    expect(mock.history.get).toHaveLength(1);
  });

  it('keeps polling through a network blip', async () => {
    jest.useFakeTimers();
    mock.onGet(url).networkErrorOnce().onGet(url).reply(200, succeeded());
    const { result } = renderHook(() => useTopUpStatus(TOP_UP_ID, null, true));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    await tick(3000);
    await waitFor(() => expect(result.current.result?.topUp.status).toBe('succeeded'));
    expect(result.current.error).toBeNull();
  });
});

describe('isForegroundState', () => {
  it('pauses polling in the background and while inactive, with the same rule at start and on change', () => {
    expect(isForegroundState('active')).toBe(true);
    expect(isForegroundState('unknown')).toBe(true);
    expect(isForegroundState('background')).toBe(false);
    expect(isForegroundState('inactive')).toBe(false);
  });
});

describe('return link', () => {
  it('reads only a well-formed id from raahehaq://wallet/topup', () => {
    expect(topUpIdFromPath(`wallet/topup?id=${TOP_UP_ID}&status=succeeded`)).toBe(TOP_UP_ID);
    expect(topUpIdFromPath('/wallet/topup?status=failed&id=top_abc')).toBe('top_abc');
    expect(topUpIdFromPath('wallet/topup?id=../../etc')).toBeNull();
    expect(topUpIdFromPath('wallet/other?id=top_abc')).toBeNull();
    expect(topUpIdFromUrl(`raahehaq://wallet/topup?id=${TOP_UP_ID}`)).toBe(TOP_UP_ID);
    expect(topUpIdFromUrl(`https://evil.test/wallet/topup?id=${TOP_UP_ID}`)).toBeNull();
  });

  it('recognises the checkout return URL and decides what the WebView loads', () => {
    expect(isTopUpReturnUrl('raahehaq://wallet/topup?id=top_1&status=succeeded')).toBe(true);
    expect(isTopUpReturnUrl('raahehaq://wallet/topup/', null)).toBe(true);
    expect(isTopUpReturnUrl('https://pay.example.test/return', 'https://pay.example.test/return')).toBe(true);
    expect(isTopUpReturnUrl('raahehaq://wallet/other')).toBe(false);
    expect(checkoutDecision('raahehaq://wallet/topup?id=top_1', 'raahehaq://wallet/topup')).toBe('finish');
    expect(checkoutDecision('https://sandbox.jazzcash.test/checkout', null, false)).toBe('load');
    expect(checkoutDecision('http://localhost:8000/payments/checkout/top_1', null, true)).toBe('load');
    // Release: plain http is never loaded, not even localhost.
    expect(checkoutDecision('http://localhost:8000/payments/checkout/top_1', null, false)).toBe('block');
    ['intent://pay#Intent;end', 'tel:123', 'sms:123', 'market://details?id=x', 'jazzcash://pay', ['javascript', 'alert(1)'].join(':'), 'raahehaq://wallet/other'].forEach(
      (url) => expect(checkoutDecision(url, null, true)).toBe('block'),
    );
  });

  it('allows https, and http only to the local backend in Debug', () => {
    expect(isAllowedCheckoutUrl('https://pay.example.test/c', false)).toBe(true);
    expect(isAllowedCheckoutUrl('http://pay.example.test/c', true)).toBe(false);
    expect(isAllowedCheckoutUrl('http://127.0.0.1:8000/x', true)).toBe(true);
    expect(isAllowedCheckoutUrl('http://10.0.2.2:8000/x', true)).toBe(true);
    expect(isAllowedCheckoutUrl('http://localhost@evil.test/x', true)).toBe(false);
    expect(isAllowedCheckoutUrl('http://localhost.evil.test/x', true)).toBe(false);
    expect(isAllowedCheckoutUrl('http://127.0.0.1:8000/x', false)).toBe(false);
    expect(isAllowedCheckoutUrl('https://', false)).toBe(false);
  });

  it('never hands a non-web scheme from the checkout to the OS (the library whitelist path)', async () => {
    // The real react-native-webview gate: a URL outside originWhitelist goes to Linking.openURL
    // before onShouldStartLoadWithRequest. With CHECKOUT_ORIGIN_WHITELIST nothing takes that path.
    const { createOnShouldStartLoadWithRequest } = jest.requireActual<{
      createOnShouldStartLoadWithRequest: (
        load: (start: boolean, url: string, lock?: number) => void,
        whitelist: readonly string[],
        callback: (event: { url: string }) => boolean,
      ) => (event: { nativeEvent: { url: string; lockIdentifier: number } }) => void;
    }>('react-native-webview/lib/WebViewShared');
    const canOpen = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const loads: Array<[string, boolean]> = [];
    const gate = createOnShouldStartLoadWithRequest(
      (start, url) => loads.push([url, start]),
      CHECKOUT_ORIGIN_WHITELIST,
      ({ url }) => checkoutDecision(url, 'raahehaq://wallet/topup', false) === 'load',
    );
    const urls = ['tel:123', 'sms:123', 'intent://pay#Intent;end', 'market://details?id=x', 'jazzcash://pay', 'raahehaq://wallet/topup?id=top_1', 'https://pay.example.test/c'];
    urls.forEach((url) => gate({ nativeEvent: { url, lockIdentifier: 1 } }));
    await Promise.resolve();
    expect(canOpen).not.toHaveBeenCalled();
    expect(openURL).not.toHaveBeenCalled();
    expect(loads).toEqual(urls.map((url) => [url, url.startsWith('https://')]));

    // The old whitelist would have sent tel: to the dialer: proves the test drives the real path.
    const leaky = createOnShouldStartLoadWithRequest(() => undefined, ['http://*', 'https://*'], () => true);
    leaky({ nativeEvent: { url: 'tel:123', lockIdentifier: 2 } });
    await Promise.resolve();
    expect(canOpen).toHaveBeenCalledWith('tel:123');
    canOpen.mockRestore();
    openURL.mockRestore();
  });

  it('routes the link to the active role\'s status screen over its tabs, and nowhere else', () => {
    expect(stateForPath(`wallet/topup?id=${TOP_UP_ID}`, 'passenger')).toEqual({
      routes: [
        {
          name: 'Passenger',
          state: { index: 1, routes: [{ name: 'PassengerTabs' }, { name: 'TopUpStatus', params: { id: TOP_UP_ID } }] },
        },
      ],
    });
    expect(stateForPath(`wallet/topup?id=${TOP_UP_ID}`, 'driver')?.routes[0].name).toBe('Driver');
    (['splash', 'auth', 'account-status'] as const).forEach((route) =>
      expect(stateForPath(`wallet/topup?id=${TOP_UP_ID}`, route)).toBeUndefined(),
    );
    expect(stateForPath('rides/12', 'passenger')).toBeUndefined();
  });

  it('resolves the auth state like AuthFlow (a suspended driver gets nothing)', () => {
    const linking = (auth: AuthSnapshot) => createLinking(() => auth);
    const path = `wallet/topup?id=${TOP_UP_ID}`;
    const active = { isInitialized: true, isAuthenticated: true, user: { role: 'driver' as const, status: 'active' as const } };
    expect(linking(active).getStateFromPath?.(path, undefined)?.routes[0].name).toBe('Driver');
    expect(linking({ ...active, user: { role: 'driver', status: 'suspended' } }).getStateFromPath?.(path, undefined)).toBeUndefined();
    expect(linking({ ...active, isAuthenticated: false }).getStateFromPath?.(path, undefined)).toBeUndefined();
    expect(linking({ ...active, isInitialized: false }).getStateFromPath?.(path, undefined)).toBeUndefined();
  });
});
