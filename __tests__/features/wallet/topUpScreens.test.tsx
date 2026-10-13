/**
 * T-515 (BE-74): the top-up screens. "Add money" on the Wallet only when the server allows it;
 * the Add money form (presets, provider from GET /wallet, method, mobile number, JazzCash CNIC,
 * client and server validation) hands off to the checkout or the status screen; the checkout
 * WebView stops at the app's return link; the status screen shows the polled result; a `topup`
 * ledger entry opens with its top-up.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient, type User } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import WalletScreen from '../../../src/features/wallet/screens/WalletScreen';
import AddMoneyScreen from '../../../src/features/wallet/screens/AddMoneyScreen';
import TopUpCheckoutScreen from '../../../src/features/wallet/screens/TopUpCheckoutScreen';
import TopUpStatusScreen from '../../../src/features/wallet/screens/TopUpStatusScreen';
import TransactionDetailScreen from '../../../src/features/wallet/screens/TransactionDetailScreen';
import { toTopUpResult } from '../../../src/features/wallet/api';
import { envelope, pageInfo, rawTopUp, rawTopUpConfig, rawTransaction, rawWallet } from '../../../test-utils/walletFixtures';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();
const mockDispatch = jest.fn();
let mockParams: Record<string, unknown> = {};
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, replace: mockReplace, dispatch: mockDispatch }),
  useRoute: () => ({ key: 'test', name: 'test', params: mockParams }),
  useIsFocused: () => true,
}));

const TOP_UP_ID = 'top_01k7testtesttesttesttestte';
const FUTURE = '2099-01-01T00:00:00+00:00';

const user = (role: 'passenger' | 'driver'): User => ({
  id: 7,
  name: 'Test User',
  email: 'user@example.test',
  phone: null,
  status: 'active',
  role,
  roles: [role],
});

const show = (Component: React.ComponentType, role: 'passenger' | 'driver' = 'passenger') => {
  const initial = rootReducer(undefined, { type: '@@init' });
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: { ...initial, apiAuth: { ...initial.apiAuth, user: user(role) } },
  });
  render(
    <Provider store={store}>
      <ThemeProvider>
        <Component />
      </ThemeProvider>
    </Provider>,
  );
};

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockReplace.mockClear();
  mockDispatch.mockClear();
  mockParams = {};
});

afterEach(() => {
  mock.restore();
});

const walletWithTopUp = (overrides: Record<string, unknown> = {}) =>
  envelope(rawWallet({ can_top_up: true, top_up: rawTopUpConfig(overrides) }));

describe('Wallet › Add money', () => {
  beforeEach(() => {
    mock.onGet('/wallet/transactions').reply(200, envelope([], pageInfo(1, 1, 0)));
  });

  it('shows Add money when the server allows a top-up and opens the form', async () => {
    mock.onGet('/wallet').reply(200, walletWithTopUp());
    show(WalletScreen);
    fireEvent.press(await screen.findByTestId('wallet-add-money'));
    expect(mockNavigate).toHaveBeenCalledWith('AddMoney');
  });

  it('hides it when can_top_up is false', async () => {
    mock.onGet('/wallet').reply(200, envelope(rawWallet({ can_top_up: false })));
    show(WalletScreen, 'driver');
    await screen.findByTestId('wallet-balance');
    expect(screen.queryByTestId('wallet-add-money')).toBeNull();
  });
});

describe('AddMoneyScreen', () => {
  it('pays with a preset and a mobile account, then opens the status screen', async () => {
    mock.onGet('/wallet').reply(200, walletWithTopUp());
    mock.onPost('/wallet/topups').reply(201, envelope(rawTopUp({ amount: 1000 })));
    show(AddMoneyScreen);

    fireEvent.press(await screen.findByTestId('add-money-preset-1000'));
    expect(screen.getByTestId('add-money-amount-input').props.value).toBe('1000');
    // The only gateway is preselected, with its first method (mobile account).
    fireEvent.changeText(screen.getByTestId('add-money-mobile-input'), '0300 1234567');
    expect(screen.queryByTestId('add-money-cnic')).toBeNull();
    expect(screen.getByText('Pay Rs 1,000')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('add-money-pay'));
    });
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      amount: 1000,
      provider: 'fake',
      method: 'mwallet',
      mobile_number: '03001234567',
    });
    expect(mock.history.post[0].headers?.['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(mockReplace).toHaveBeenCalledWith(
      'TopUpStatus',
      expect.objectContaining({ id: TOP_UP_ID, providerName: 'Test gateway', result: expect.objectContaining({ topUp: expect.any(Object) }) }),
    );
  });

  it('opens the hosted checkout for a card top-up', async () => {
    mock.onGet('/wallet').reply(200, walletWithTopUp());
    mock.onPost('/wallet/topups').reply(
      201,
      envelope(
        rawTopUp({
          method: 'card',
          status: 'created',
          mobile_number: null,
          next_action: { type: 'redirect', url: 'http://localhost:8000/payments/checkout/top_1?signature=x', return_url: 'raahehaq://wallet/topup' },
        }),
      ),
    );
    show(AddMoneyScreen);
    fireEvent.changeText(await screen.findByTestId('add-money-amount-input'), '750');
    fireEvent.press(screen.getByText('Card or checkout page'));
    expect(screen.queryByTestId('add-money-mobile')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-money-pay'));
    });
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        'TopUpCheckout',
        expect.objectContaining({ url: 'http://localhost:8000/payments/checkout/top_1?signature=x', returnUrl: 'raahehaq://wallet/topup' }),
      ),
    );
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ amount: 750, provider: 'fake', method: 'card' });
  });

  it('refuses a checkout URL that is not https (or the Debug local backend) and goes to the status screen', async () => {
    mock.onGet('/wallet').reply(200, walletWithTopUp());
    mock.onPost('/wallet/topups').reply(
      201,
      envelope(
        rawTopUp({
          method: 'card',
          status: 'created',
          mobile_number: null,
          next_action: { type: 'redirect', url: 'http://pay.example.test/checkout', return_url: 'raahehaq://wallet/topup' },
        }),
      ),
    );
    show(AddMoneyScreen);
    fireEvent.changeText(await screen.findByTestId('add-money-amount-input'), '750');
    fireEvent.press(screen.getByText('Card or checkout page'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-money-pay'));
    });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('TopUpStatus', expect.objectContaining({ id: TOP_UP_ID })));
    expect(mockReplace).not.toHaveBeenCalledWith('TopUpCheckout', expect.anything());
  });

  it('shows the field errors and sends nothing when the form is incomplete', async () => {
    mock.onGet('/wallet').reply(200, walletWithTopUp());
    show(AddMoneyScreen);
    const pay = await screen.findByTestId('add-money-pay');
    await act(async () => {
      fireEvent.press(pay);
    });
    expect(screen.getByText('Enter an amount.')).toBeTruthy();
    expect(screen.getByText('Enter your mobile account number.')).toBeTruthy();
    expect(mock.history.post).toHaveLength(0);
  });

  it('asks for the CNIC digits with JazzCash mobile accounts', async () => {
    mock.onGet('/wallet').reply(
      200,
      walletWithTopUp({
        providers: [
          { id: 'jazzcash', name: 'JazzCash', methods: ['mwallet', 'card'] },
          { id: 'easypaisa', name: 'Easypaisa', methods: ['mwallet', 'card'] },
        ],
      }),
    );
    show(AddMoneyScreen);
    fireEvent.press(await screen.findByTestId('top-up-provider-jazzcash'));
    expect(screen.getByTestId('add-money-cnic')).toBeTruthy();
    expect(screen.getByText('JazzCash mobile number')).toBeTruthy();
    fireEvent.press(screen.getByTestId('top-up-provider-easypaisa'));
    expect(screen.queryByTestId('add-money-cnic')).toBeNull();
  });

  it('shows a daily-limit refusal under the amount', async () => {
    mock.onGet('/wallet').reply(200, walletWithTopUp());
    mock.onPost('/wallet/topups').reply(422, {
      success: false,
      message: "You've reached today's top-up limit.",
      error: { code: 'DAILY_LIMIT_REACHED' },
    });
    show(AddMoneyScreen);
    fireEvent.changeText(await screen.findByTestId('add-money-amount-input'), '500');
    fireEvent.changeText(screen.getByTestId('add-money-mobile-input'), '3001234567');
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-money-pay'));
    });
    expect(await screen.findByText("You've reached today's top-up limit.")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('blocks the form when today\'s limit is used up', async () => {
    mock.onGet('/wallet').reply(200, walletWithTopUp({ daily_remaining: 0 }));
    show(AddMoneyScreen);
    expect(await screen.findByTestId('add-money-daily-reached')).toBeTruthy();
    expect(screen.queryByTestId('add-money-preset-500')).toBeNull();
  });
});

describe('TopUpCheckoutScreen', () => {
  it('loads the checkout page and hands the return link to the status screen', async () => {
    const result = toTopUpResult(
      rawTopUp({ method: 'card', status: 'created', next_action: { type: 'redirect', url: 'https://pay.example.test/c', return_url: 'raahehaq://wallet/topup' } }),
    );
    mockParams = { result, url: 'https://pay.example.test/c', returnUrl: 'raahehaq://wallet/topup', providerName: 'Test gateway' };
    show(TopUpCheckoutScreen);
    const webView = await screen.findByTestId('top-up-checkout-webview');
    expect(webView.props.source).toEqual({ uri: 'https://pay.example.test/c' });
    expect(webView.props.onShouldStartLoadWithRequest({ url: 'https://pay.example.test/pay' })).toBe(true);
    expect(webView.props.onShouldStartLoadWithRequest({ url: 'intent://x#Intent;end' })).toBe(false);
    expect(mockDispatch).not.toHaveBeenCalled();

    expect(webView.props.onShouldStartLoadWithRequest({ url: `raahehaq://wallet/topup?id=${TOP_UP_ID}&status=succeeded` })).toBe(false);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch.mock.calls[0][0]).toMatchObject({
      type: 'REPLACE',
      payload: { name: 'TopUpStatus', params: expect.objectContaining({ id: TOP_UP_ID }) },
    });
  });
});

describe('TopUpCheckoutScreen (disallowed URL)', () => {
  it('never renders the WebView and goes to the status screen', async () => {
    const result = toTopUpResult(rawTopUp({ method: 'card', status: 'created' }));
    mockParams = { result, url: 'tel:123', returnUrl: null };
    show(TopUpCheckoutScreen);
    await waitFor(() => expect(mockDispatch).toHaveBeenCalledTimes(1));
    expect(mockDispatch.mock.calls[0][0]).toMatchObject({ type: 'REPLACE', payload: { name: 'TopUpStatus' } });
    expect(screen.queryByTestId('top-up-checkout-webview')).toBeNull();
  });
});

describe('TopUpStatusScreen', () => {
  it('shows a succeeded top-up with its reference and goes back to the wallet', async () => {
    mock.onGet(`/wallet/topups/${TOP_UP_ID}`).reply(
      200,
      envelope(rawTopUp({ status: 'succeeded', transaction_id: 'TXN-01K7TEST', expires_at: FUTURE, next_action: { type: 'none' } })),
    );
    mockParams = { id: TOP_UP_ID };
    show(TopUpStatusScreen);
    expect(await screen.findByText('Money added')).toBeTruthy();
    expect(screen.getByText('Rs 500 was added to your wallet.')).toBeTruthy();
    expect(screen.getByText('TXN-01K7TEST')).toBeTruthy();
    // T-518: opened from a link (no provider name passed), the fake gateway still reads as in the flow.
    expect(screen.getByText('Test gateway')).toBeTruthy();
    expect(screen.queryByText('Fake')).toBeNull();
    fireEvent.press(screen.getByTestId('top-up-status-done'));
    expect(mockDispatch.mock.calls[0][0]).toMatchObject({
      type: 'POP_TO',
      payload: { name: 'PassengerTabs', params: { screen: 'Activity', params: { segment: 'wallet' } } },
    });
  });

  it('shows the server failure message and offers Try again', async () => {
    mock.onGet(`/wallet/topups/${TOP_UP_ID}`).reply(
      200,
      envelope(
        rawTopUp({
          status: 'failed',
          expires_at: FUTURE,
          failure: { code: 'DECLINED', message: 'The payment did not go through. No money was taken from your wallet.' },
          next_action: { type: 'none' },
        }),
      ),
    );
    mockParams = { id: TOP_UP_ID };
    show(TopUpStatusScreen, 'driver');
    expect(await screen.findByText('Top-up failed')).toBeTruthy();
    expect(screen.getByText('The payment did not go through. No money was taken from your wallet.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('top-up-status-retry'));
    expect(mockDispatch.mock.calls[0][0]).toMatchObject({ type: 'REPLACE', payload: { name: 'AddMoney' } });
    fireEvent.press(screen.getByTestId('top-up-status-wallet'));
    expect(mockDispatch.mock.calls[1][0]).toMatchObject({ type: 'POP_TO', payload: { name: 'Wallet' } });
  });

  it('shows a pending mobile-account top-up from the POST answer while it waits', async () => {
    mockParams = { id: TOP_UP_ID, result: toTopUpResult(rawTopUp({ expires_at: FUTURE })), providerName: 'Test gateway' };
    show(TopUpStatusScreen);
    expect(await screen.findByText('Waiting for payment')).toBeTruthy();
    expect(screen.getByText('Approve the payment in your Test gateway app or the prompt on your phone.')).toBeTruthy();
    expect(screen.getByTestId('top-up-status-polling')).toBeTruthy();
  });
});

describe('TransactionDetailScreen (top-up entry)', () => {
  it('shows the top-up id and its gateway, method and masked account', async () => {
    const raw = rawTransaction({
      id: 900,
      type: 'topup',
      label: 'Wallet Top-up',
      direction: 'credit',
      amount: 500,
      payment_method: 'jazzcash',
      ride: null,
      topup_id: TOP_UP_ID,
      description: 'Wallet top-up via JazzCash',
    });
    mock.onGet('/wallet/transactions/900').reply(200, envelope(raw));
    mock.onGet(`/wallet/topups/${TOP_UP_ID}`).reply(200, envelope(rawTopUp({ provider: 'jazzcash', status: 'succeeded' })));
    mockParams = { id: 900 };
    show(TransactionDetailScreen);
    const caption = await screen.findByTestId('transaction-topup-id');
    expect(caption.props.children).toBe(`Top-up ID ${TOP_UP_ID}`);
    // T-518: one line, truncated in the middle, copyable.
    expect(caption.props).toMatchObject({ numberOfLines: 1, ellipsizeMode: 'middle', selectable: true });
    expect(await screen.findByTestId('transaction-topup')).toBeTruthy();
    expect(screen.getAllByText('JazzCash').length).toBeGreaterThan(0);
    expect(screen.getByText('Mobile account')).toBeTruthy();
    expect(screen.getByText('0300*****67')).toBeTruthy();
  });

  it('a card top-up on the test gateway shows its method, never "Payment method: Wallet" (T-518)', async () => {
    const raw = rawTransaction({
      id: 901,
      type: 'topup',
      label: 'Wallet Top-up',
      direction: 'credit',
      amount: 500,
      payment_method: 'wallet',
      ride: null,
      topup_id: TOP_UP_ID,
    });
    mock.onGet('/wallet/transactions/901').reply(200, envelope(raw));
    mock.onGet(`/wallet/topups/${TOP_UP_ID}`).reply(
      200,
      envelope(rawTopUp({ provider: 'fake', method: 'card', mobile_number: null, status: 'succeeded' })),
    );
    mockParams = { id: 901 };
    show(TransactionDetailScreen);
    expect(await screen.findByTestId('transaction-topup')).toBeTruthy();
    expect(screen.getByText('Test gateway')).toBeTruthy();
    expect(screen.getByText('Card / checkout')).toBeTruthy();
    expect(screen.queryByText('Payment method')).toBeNull();
    expect(screen.queryByText('Wallet')).toBeNull();
    expect(screen.queryByText('Fake')).toBeNull();
  });
});
