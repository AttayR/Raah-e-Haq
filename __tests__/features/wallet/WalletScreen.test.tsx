/**
 * T-508: the Wallet screen shows GET /wallet and GET /wallet/transactions for both roles, with
 * loading, error (retry), empty and filtered states, infinite scroll, reversed rows struck
 * through, and no fake payment methods (rides are cash; "Add money" only when the server allows a
 * top-up, T-515, covered in topUpScreens.test.tsx). Drivers see the commission owed,
 * "Pay commission" and can cancel a pending report.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { dialog, dialogStore } from '../../../src/core/dialog';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient, type User } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { LightTheme } from '../../../src/theme';
import WalletScreen from '../../../src/features/wallet/screens/WalletScreen';
import { MINUS } from '../../../src/core/format/money';
import { envelope, pageInfo, rawSettlement, rawTransaction, rawWallet } from '../../../test-utils/walletFixtures';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useIsFocused: () => true,
}));

const user = (role: 'passenger' | 'driver'): User => ({
  id: 7,
  name: 'Test User',
  email: 'user@example.test',
  phone: null,
  status: 'active',
  role,
  roles: [role],
});

const renderWallet = (role: 'passenger' | 'driver' = 'passenger') => {
  const initial = rootReducer(undefined, { type: '@@init' });
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: { ...initial, apiAuth: { ...initial.apiAuth, user: user(role) } },
  });
  render(
    <Provider store={store}>
      <ThemeProvider>
        <WalletScreen />
      </ThemeProvider>
    </Provider>,
  );
};

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mockNavigate.mockClear();
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

/** UI-R3: the confirmation is the kit Dialog; this answers every dialog it opens. */
const autoAnswerDialogs = (confirmed: boolean) =>
  dialogStore.subscribe(() => {
    const current = dialogStore.getCurrent();
    if (current) dialog.answer(current.id, confirmed);
  });
let stopAnswering: (() => void) | null = null;
afterEach(() => {
  stopAnswering?.();
  stopAnswering = null;
  dialog.dismissAll();
});

describe('WalletScreen (passenger)', () => {
  it('shows a loading state, then balance, cash-only note and grouped transactions', async () => {
    // Held until the loading state has been seen.
    let releaseWallet: () => void = () => undefined;
    const walletHeld = new Promise<void>((resolve) => {
      releaseWallet = resolve;
    });
    mock.onGet('/wallet').reply(async () => {
      await walletHeld;
      return [200, envelope(rawWallet({ balance: 1500, total_spent: 15230 }))];
    });
    mock.onGet('/wallet/transactions').reply(
      200,
      envelope(
        [
          rawTransaction({ id: 1, type: 'referral_reward', label: 'Referral Reward', direction: 'credit', amount: 500 }),
          rawTransaction({ id: 2, type: 'ride_payment', label: 'Ride Payment', direction: 'none', amount: 300 }),
          rawTransaction({ id: 3, type: 'adjustment_debit', label: 'Adjustment', direction: 'debit', amount: 50, reversed: true }),
        ],
        pageInfo(1, 1, 3),
      ),
    );
    renderWallet();
    expect(await screen.findByTestId('wallet-loading')).toBeTruthy();
    releaseWallet();

    await waitFor(() => expect(screen.getByTestId('wallet-balance')).toBeTruthy());
    expect(screen.getByTestId('wallet-balance').props.children).toBe('Rs 1,500');
    expect(screen.getByTestId('wallet-balance-meta').props.children).toBe('Rs 15,230');
    expect(screen.getByText('Rides are paid in cash to the driver.')).toBeTruthy();
    // No fake funds or payment methods; can_top_up is false here, so no Add money either.
    expect(screen.queryByText(/Add Funds|Payment Methods|1200/)).toBeNull();
    expect(screen.queryByTestId('wallet-add-money')).toBeNull();
    // Passengers have no commission card.
    expect(screen.queryByTestId('wallet-commission-card')).toBeNull();

    await waitFor(() => expect(screen.getByTestId('wallet-transaction-1')).toBeTruthy());
    const credit = screen.getByTestId('wallet-transaction-1-amount');
    expect(credit.props.children).toBe('+Rs 500');
    expect(StyleSheet.flatten(credit.props.style).color).toBe(LightTheme.colors.success);
    expect(screen.getByTestId('wallet-transaction-2-amount').props.children).toBe('Rs 300');
    // UI-R15: the app's own sentence-case label and the time only (no ride code in the row).
    expect(within(screen.getByTestId('wallet-transaction-2')).getByText('Ride payment')).toBeTruthy();
    expect(within(screen.getByTestId('wallet-transaction-2')).queryByText(/RH-TEST1/)).toBeNull();
    const reversed = screen.getByTestId('wallet-transaction-3-amount');
    expect(reversed.props.children).toBe(`${MINUS}Rs 50`);
    expect(StyleSheet.flatten(reversed.props.style).textDecorationLine).toBe('line-through');

    fireEvent.press(screen.getByTestId('wallet-transaction-1'));
    expect(mockNavigate).toHaveBeenCalledWith('WalletTransaction', expect.objectContaining({ id: 1 }));
  });

  it('shows the empty state for a new account', async () => {
    mock.onGet('/wallet').reply(200, envelope(rawWallet({ total_spent: 0 })));
    mock.onGet('/wallet/transactions').reply(200, envelope([], pageInfo(1, 1, 0)));
    renderWallet();
    await waitFor(() => expect(screen.getByTestId('wallet-transactions-empty')).toBeTruthy());
    expect(screen.getByText('No transactions yet')).toBeTruthy();
    expect(screen.getByTestId('wallet-balance').props.children).toBe('Rs 0');
  });

  it('shows an error with retry when the wallet cannot be loaded', async () => {
    mock.onGet('/wallet').replyOnce(500, { message: 'SQLSTATE secret' });
    mock.onGet('/wallet/transactions').reply(200, envelope([], pageInfo(1, 1, 0)));
    renderWallet();
    await waitFor(() => expect(screen.getByTestId('wallet-error')).toBeTruthy());
    // Server exception text is never shown.
    expect(screen.queryByText(/SQLSTATE/)).toBeNull();

    mock.onGet('/wallet').reply(200, envelope(rawWallet({ balance: 20 })));
    fireEvent.press(screen.getByTestId('wallet-error-retry'));
    await waitFor(() => expect(screen.getByTestId('wallet-balance').props.children).toBe('Rs 20'));
  });

  it('filters by direction and loads the next page on scroll', async () => {
    mock.onGet('/wallet').reply(200, envelope(rawWallet()));
    mock.onGet('/wallet/transactions').reply((config) => {
      const { page, direction } = config.params as { page: number; direction?: string };
      if (direction === 'credit') return [200, envelope([], pageInfo(1, 1, 0))];
      return [200, envelope([rawTransaction({ id: page * 100 })], pageInfo(page, 2, 2))];
    });
    renderWallet();
    await waitFor(() => expect(screen.getByTestId('wallet-transaction-100')).toBeTruthy());

    await act(async () => {
      screen.getByTestId('wallet-transactions').props.onEndReached();
    });
    await waitFor(() => expect(screen.getByTestId('wallet-transaction-200')).toBeTruthy());
    expect(screen.getByTestId('wallet-transaction-100')).toBeTruthy();

    fireEvent.press(screen.getByRole('radio', { name: 'Show, Money in' }));
    await waitFor(() => expect(screen.getByTestId('wallet-transactions-empty')).toBeTruthy());
    expect(screen.getByText('No transactions match this filter.')).toBeTruthy();
    const last = mock.history.get.filter((r) => r.url === '/wallet/transactions').pop();
    expect(last?.params).toEqual({ page: 1, per_page: 20, direction: 'credit' });
  });
});

describe('WalletScreen (driver)', () => {
  it('shows commission owed and opens the pay form prefilled with it', async () => {
    mock.onGet('/wallet').reply(
      200,
      envelope(rawWallet({ balance: -116, commission_owed: 116, total_earnings: 464, can_settle_commission: true })),
    );
    mock.onGet('/wallet/transactions').reply(200, envelope([rawTransaction()], pageInfo(1, 1, 1)));
    renderWallet('driver');
    await waitFor(() => expect(screen.getByTestId('wallet-commission-card')).toBeTruthy());
    expect(screen.getByTestId('wallet-balance').props.children).toBe(`${MINUS}Rs 116`);
    expect(screen.getByTestId('wallet-commission-owed').props.children).toBe('Rs 116');
    fireEvent.press(screen.getByTestId('wallet-pay-commission'));
    expect(mockNavigate).toHaveBeenCalledWith('PayCommission', { owed: 116, currency: 'PKR' });
    fireEvent.press(screen.getByTestId('wallet-open-settlements'));
    expect(mockNavigate).toHaveBeenCalledWith('WalletSettlements');
  });

  it('hides "Pay commission" while a report is pending and can cancel it', async () => {
    mock.onGet('/wallet').replyOnce(
      200,
      envelope(
        rawWallet({ balance: -116, commission_owed: 116, can_settle_commission: true, pending_settlements: [rawSettlement()] }),
      ),
    );
    mock.onGet('/wallet/transactions').reply(200, envelope([], pageInfo(1, 1, 0)));
    mock.onDelete('/wallet/settlements/3').reply(200, envelope(rawSettlement({ status: 'cancelled' })));
    mock.onGet('/wallet').reply(200, envelope(rawWallet({ balance: -116, commission_owed: 116, can_settle_commission: true })));
    stopAnswering = autoAnswerDialogs(true);
    renderWallet('driver');
    await waitFor(() => expect(screen.getByTestId('wallet-settlement-3')).toBeTruthy());
    expect(screen.queryByTestId('wallet-pay-commission')).toBeNull();
    expect(screen.getByText('Waiting for review')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('wallet-settlement-3-cancel'));
    });
    await waitFor(() => expect(mock.history.delete).toHaveLength(1));
    // The wallet is read again and "Pay commission" comes back.
    await waitFor(() => expect(screen.getByTestId('wallet-pay-commission')).toBeTruthy());
  });
});
