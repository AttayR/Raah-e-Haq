/**
 * T-508: BE-09 wallet shapes are mapped to app models in one place, and the calls use the
 * contract's paths, params and bodies. Cash only: there is no top-up call at all.
 */
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import { ApiError } from '../../../src/core/api/errors';
import {
  toSettlementBody,
  toTransaction,
  toWallet,
  walletApi,
} from '../../../src/features/wallet/api';
import {
  groupByDay,
  transactionAmountColor,
  transactionAmountText,
  transactionIcon,
} from '../../../src/features/wallet/format';
import { MINUS } from '../../../src/core/format/money';
import { envelope, pageInfo, rawSettlement, rawTransaction, rawWallet } from '../../../test-utils/walletFixtures';

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
});

describe('toWallet', () => {
  it('maps a driver wallet with commission owed and a pending report', () => {
    const wallet = toWallet(
      rawWallet({
        balance: -116,
        commission_owed: 116,
        total_spent: 0,
        total_earnings: 464,
        can_settle_commission: true,
        pending_settlements: [rawSettlement()],
      }),
    );
    expect(wallet).toMatchObject({
      balance: -116,
      currency: 'PKR',
      status: 'active',
      commissionOwed: 116,
      totalEarnings: 464,
      canSettleCommission: true,
    });
    expect(wallet.pendingSettlements).toEqual([
      expect.objectContaining({ id: 3, amount: 116, method: 'bank_transfer', reference: 'IBFT-123', status: 'pending', reviewNote: null }),
    ]);
  });

  it('falls back safely on missing or odd fields', () => {
    expect(toWallet(null)).toMatchObject({ balance: 0, currency: 'PKR', commissionOwed: 0, pendingSettlements: [] });
    // commission_owed missing: derived from the balance (max(0, -balance)).
    expect(toWallet({ balance: -40 }).commissionOwed).toBe(40);
    expect(toWallet({ status: 'weird', can_settle_commission: 'yes' })).toMatchObject({ status: 'active', canSettleCommission: false });
  });
});

describe('toTransaction', () => {
  it('maps every contract field', () => {
    expect(toTransaction(rawTransaction())).toEqual({
      id: 812,
      reference: 'TXN-01JATEST',
      type: 'commission_due',
      label: 'Platform Commission',
      direction: 'debit',
      amount: 58,
      grossAmount: 58,
      fee: 0,
      netAmount: 58,
      balanceChange: -58,
      balanceAfter: -116,
      currency: 'PKR',
      status: 'completed',
      paymentMethod: 'cash',
      description: 'Platform commission for ride RH-TEST1',
      ride: { id: 7, rideCode: 'RH-TEST1', status: 'completed', vehicleType: 'car', completedAt: '2026-10-11T08:55:00+00:00' },
      settlementId: null,
      reversesId: null,
      reversed: false,
      createdAt: '2026-10-11T09:00:00+00:00',
    });
  });

  it('keeps unknown types with their label (or a readable fallback); drops rows without an id', () => {
    expect(toTransaction(rawTransaction({ type: 'mystery_bonus', label: 'Mystery' }))).toMatchObject({ type: 'mystery_bonus', label: 'Mystery' });
    expect(toTransaction(rawTransaction({ type: 'adjustment_credit', label: null }))?.label).toBe('Adjustment credit');
    expect(toTransaction(rawTransaction({ id: null }))).toBeNull();
    expect(toTransaction(rawTransaction({ balance_after: null, ride: null }))).toMatchObject({ balanceAfter: null, ride: null });
  });
});

describe('row format', () => {
  it('credit +green, debit −red, none neutral; reversed entries keep their amount', () => {
    const credit = toTransaction(rawTransaction({ direction: 'credit', type: 'referral_reward', amount: 500 }))!;
    const debit = toTransaction(rawTransaction())!;
    const none = toTransaction(rawTransaction({ direction: 'none', type: 'ride_payment', amount: 300 }))!;
    expect(transactionAmountText(credit)).toBe('+Rs 500');
    expect(transactionAmountColor(credit)).toBe('success');
    expect(transactionAmountText(debit)).toBe(`${MINUS}Rs 58`);
    expect(transactionAmountColor(debit)).toBe('danger');
    expect(transactionAmountText(none)).toBe('Rs 300');
    expect(transactionAmountColor(none)).toBe('textPrimary');
    expect(transactionIcon(none)).toBe('rides');
    expect(transactionIcon({ type: 'unknown_thing', direction: 'credit' })).toBe('moneyIn');
  });

  it('groups newest-first entries by local day', () => {
    const now = new Date(2026, 9, 11, 12, 0, 0);
    const at = (d: number, h: number) => new Date(2026, 9, d, h, 0, 0).toISOString();
    const items = [
      toTransaction(rawTransaction({ id: 1, created_at: at(11, 10) }))!,
      toTransaction(rawTransaction({ id: 2, created_at: at(11, 9) }))!,
      toTransaction(rawTransaction({ id: 3, created_at: at(10, 20) }))!,
      toTransaction(rawTransaction({ id: 4, created_at: at(5, 20) }))!,
    ];
    const sections = groupByDay(items, now);
    expect(sections.map((s) => [s.title, s.data.map((t) => t.id)])).toEqual([
      ['Today', [1, 2]],
      ['Yesterday', [3]],
      ['Mon, 5 Oct', [4]],
    ]);
  });
});

describe('walletApi', () => {
  it('GET /wallet', async () => {
    mock.onGet('/wallet').reply(200, envelope(rawWallet({ balance: 250 })));
    expect((await walletApi.getWallet()).balance).toBe(250);
  });

  it('GET /wallet/transactions with page, per_page and the direction filter', async () => {
    mock.onGet('/wallet/transactions').reply(200, envelope([rawTransaction()], pageInfo(2, 3, 45)));
    const page = await walletApi.listTransactions({ page: 2, filter: 'credit' });
    expect(mock.history.get[0].params).toEqual({ page: 2, per_page: 20, direction: 'credit' });
    expect(page).toMatchObject({ page: 2, lastPage: 3, total: 45 });
    expect(page.items).toHaveLength(1);

    await walletApi.listTransactions({ page: 1 });
    expect(mock.history.get[1].params).toEqual({ page: 1, per_page: 20 });
  });

  it('GET /wallet/transactions/{id}; 404 is an ApiError', async () => {
    mock.onGet('/wallet/transactions/812').reply(200, envelope(rawTransaction()));
    expect((await walletApi.getTransaction(812))?.id).toBe(812);
    mock.onGet('/wallet/transactions/9').reply(404, { success: false, message: 'Transaction not found', error: { code: 'NOT_FOUND' } });
    await expect(walletApi.getTransaction(9)).rejects.toMatchObject({ kind: 'not_found', code: 'NOT_FOUND' });
  });

  it('POST /wallet/settlements sends the contract body; refusals keep their code', async () => {
    mock.onPost('/wallet/settlements').replyOnce(201, envelope(rawSettlement()));
    const created = await walletApi.createSettlement({ amount: 116, method: 'bank_transfer', reference: 'IBFT-123' });
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      kind: 'commission_payment',
      amount: 116,
      method: 'bank_transfer',
      reference: 'IBFT-123',
    });
    expect(created?.status).toBe('pending');

    mock.onPost('/wallet/settlements').replyOnce(409, {
      success: false,
      message: 'You already have a payment waiting for review.',
      error: { code: 'SETTLEMENT_ALREADY_PENDING' },
    });
    const refusal = await walletApi.createSettlement({ amount: 10, method: 'cash' }).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(ApiError);
    expect(refusal).toMatchObject({ kind: 'conflict', code: 'SETTLEMENT_ALREADY_PENDING' });
  });

  it('GET and DELETE /wallet/settlements', async () => {
    mock.onGet('/wallet/settlements').reply(200, envelope([rawSettlement({ status: 'rejected', review_note: 'No receipt' })], pageInfo(1, 1, 1)));
    const page = await walletApi.listSettlements({ page: 1 });
    expect(page.items[0]).toMatchObject({ status: 'rejected', reviewNote: 'No receipt' });

    mock.onDelete('/wallet/settlements/3').reply(200, envelope(rawSettlement({ status: 'cancelled' })));
    expect((await walletApi.cancelSettlement(3))?.status).toBe('cancelled');
  });

  it('leaves empty optional text out of the settlement body', () => {
    expect(toSettlementBody({ amount: 5, method: 'cash', reference: '  ', note: '' })).toEqual({
      kind: 'commission_payment',
      amount: 5,
      method: 'cash',
    });
  });
});
