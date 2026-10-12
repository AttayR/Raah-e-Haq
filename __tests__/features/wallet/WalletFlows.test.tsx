/**
 * T-508: driver "Pay commission" form (prefilled, validated, POST body, server refusals),
 * the payment reports list (status, review note, cancel) and the transaction detail screen.
 */
import React from 'react';
import { Alert, StyleSheet, type AlertButton } from 'react-native';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { apiClient } from '../../../src/services/api';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import PayCommissionScreen from '../../../src/features/wallet/screens/PayCommissionScreen';
import SettlementsScreen from '../../../src/features/wallet/screens/SettlementsScreen';
import TransactionDetailScreen from '../../../src/features/wallet/screens/TransactionDetailScreen';
import { toTransaction } from '../../../src/features/wallet/api';
import { envelope, pageInfo, rawSettlement, rawTransaction } from '../../../test-utils/walletFixtures';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockParams: Record<string, unknown> = {};
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ key: 'test', name: 'test', params: mockParams }),
  useIsFocused: () => true,
}));

const show = (Component: React.ComponentType) =>
  render(
    <ThemeProvider>
      <Component />
    </ThemeProvider>,
  );

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mockNavigate.mockClear();
  mockGoBack.mockClear();
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('PayCommissionScreen', () => {
  beforeEach(() => {
    mockParams = { owed: 116, currency: 'PKR' };
  });

  it('is prefilled with the commission owed and posts the report', async () => {
    mock.onPost('/wallet/settlements').reply(201, envelope(rawSettlement({ method: 'cash', reference: null })));
    show(PayCommissionScreen);
    const amount = await screen.findByTestId('pay-commission-amount');
    expect(amount.props.value).toBe('116');
    expect(screen.getByTestId('pay-commission-owed').props.children).toBe('Rs 116');

    await act(async () => {
      fireEvent.press(screen.getByTestId('pay-commission-submit'));
    });
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ kind: 'commission_payment', amount: 116, method: 'cash' });
  });

  it('sends one report for a double tap', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    mock.onPost('/wallet/settlements').reply(async () => {
      await held;
      return [201, envelope(rawSettlement({ method: 'cash', reference: null }))];
    });
    show(PayCommissionScreen);
    await screen.findByTestId('pay-commission-amount');
    const submit = screen.getByTestId('pay-commission-submit');
    await act(async () => {
      fireEvent.press(submit);
      fireEvent.press(submit);
    });
    release();
    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
    expect(mock.history.post).toHaveLength(1);
  });

  it('blocks more than owed and a bank transfer without a reference, before any request', async () => {
    show(PayCommissionScreen);
    const amount = await screen.findByTestId('pay-commission-amount');
    fireEvent.changeText(amount, '200');
    fireEvent.press(screen.getByRole('radio', { name: 'How did you pay?, Bank transfer' }));
    await act(async () => {
      fireEvent.press(screen.getByTestId('pay-commission-submit'));
    });
    expect(screen.getByTestId('pay-commission-amount-error').props.children).toBe('You owe Rs 116. Enter that amount or less.');
    expect(screen.getByTestId('pay-commission-reference-error').props.children).toBe('Enter the bank transfer reference.');
    expect(mock.history.post).toHaveLength(0);

    fireEvent.changeText(amount, '0');
    await act(async () => {
      fireEvent.press(screen.getByTestId('pay-commission-submit'));
    });
    expect(screen.getByTestId('pay-commission-amount-error').props.children).toBe('The amount must be at least Rs 1.');
    expect(mock.history.post).toHaveLength(0);
  });

  it('shows the server refusal (already pending) and stays on the form', async () => {
    mock.onPost('/wallet/settlements').reply(409, {
      success: false,
      message: 'You already have a payment waiting for review.',
      error: { code: 'SETTLEMENT_ALREADY_PENDING' },
    });
    show(PayCommissionScreen);
    await screen.findByTestId('pay-commission-amount');
    await act(async () => {
      fireEvent.press(screen.getByTestId('pay-commission-submit'));
    });
    await waitFor(() => expect(screen.getByTestId('pay-commission-error')).toBeTruthy());
    expect(screen.getByText('You already have a payment waiting for review.')).toBeTruthy();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('puts AMOUNT_EXCEEDS_OWED under the amount field', async () => {
    mock.onPost('/wallet/settlements').reply(422, {
      success: false,
      message: 'The amount is more than the commission you owe now.',
      error: { code: 'AMOUNT_EXCEEDS_OWED' },
    });
    show(PayCommissionScreen);
    await screen.findByTestId('pay-commission-amount');
    await act(async () => {
      fireEvent.press(screen.getByTestId('pay-commission-submit'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('pay-commission-amount-error').props.children).toBe(
        'The amount is more than the commission you owe now.',
      ),
    );
  });
});

describe('SettlementsScreen', () => {
  it('lists reports with status and the reviewer note, and cancels a pending one', async () => {
    mock.onGet('/wallet/settlements').reply(
      200,
      envelope(
        [rawSettlement({ id: 3 }), rawSettlement({ id: 2, status: 'rejected', review_note: 'Receipt unreadable' })],
        pageInfo(1, 1, 2),
      ),
    );
    mock.onDelete('/wallet/settlements/3').reply(200, envelope(rawSettlement({ id: 3, status: 'cancelled' })));
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _b, buttons?: AlertButton[]) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    show(SettlementsScreen);
    await waitFor(() => expect(screen.getByTestId('wallet-settlement-2')).toBeTruthy());
    expect(screen.getByTestId('wallet-settlement-2-note').props.children).toBe('Reviewer note: Receipt unreadable');
    expect(screen.queryByTestId('wallet-settlement-2-cancel')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByTestId('wallet-settlement-3-cancel'));
    });
    await waitFor(() => expect(screen.getByTestId('wallet-settlement-3-status')).toBeTruthy());
    await waitFor(() => expect(screen.queryByTestId('wallet-settlement-3-cancel')).toBeNull());
  });

  it('shows the empty state', async () => {
    mock.onGet('/wallet/settlements').reply(200, envelope([], pageInfo(1, 1, 0)));
    show(SettlementsScreen);
    await waitFor(() => expect(screen.getByTestId('settlements-empty')).toBeTruthy());
  });
});

describe('TransactionDetailScreen', () => {
  it('shows the passed row at once, then the server copy with the driver earning breakdown', async () => {
    const row = rawTransaction({
      id: 900,
      type: 'driver_earning',
      label: 'Ride Earning',
      direction: 'none',
      amount: 240,
      gross_amount: 300,
      fee: 60,
      net_amount: 240,
      balance_after: null,
    });
    mockParams = { id: 900, transaction: toTransaction(row) };
    mock.onGet('/wallet/transactions/900').reply(200, envelope({ ...row, reversed: true }));
    show(TransactionDetailScreen);
    expect((await screen.findByTestId('transaction-amount')).props.children).toBe('Rs 240');
    expect(screen.getByTestId('transaction-gross')).toBeTruthy();
    expect(screen.getByText('Rs 300')).toBeTruthy();
    expect(screen.getByText('Rs 60')).toBeTruthy();
    expect(screen.queryByTestId('transaction-balance-after')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('transaction-reversed')).toBeTruthy());
    expect(StyleSheet.flatten(screen.getByTestId('transaction-amount').props.style).textDecorationLine).toBe('line-through');
  });

  it('shows an error state when the entry is not found', async () => {
    mockParams = { id: 5 };
    mock.onGet('/wallet/transactions/5').reply(404, { success: false, message: 'Transaction not found', error: { code: 'NOT_FOUND' } });
    show(TransactionDetailScreen);
    await waitFor(() => expect(screen.getByTestId('transaction-error')).toBeTruthy());
    expect(screen.getByText('Transaction not found')).toBeTruthy();
  });
});
