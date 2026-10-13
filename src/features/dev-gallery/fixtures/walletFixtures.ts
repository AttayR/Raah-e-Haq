/**
 * Kit gallery only (Debug): API-shaped wallet bodies (BE-09) run through the real mappers, so the
 * screen-state previews show exactly what the screens render for such a response. Never imported
 * by a product screen.
 */
import { toSettlement, toTransaction, toWallet } from '../../wallet/api';
import type { Settlement, Wallet, WalletTransaction } from '../../wallet/types';

const rawWallet = (overrides: Record<string, unknown>) => ({
  balance: 0,
  currency: 'PKR',
  status: 'active',
  commission_owed: 0,
  available_balance: 0,
  total_spent: 0,
  total_earnings: 0,
  pending_settlements: [],
  payment_methods: ['cash'],
  can_top_up: false,
  can_request_payout: false,
  can_settle_commission: false,
  updated_at: '2026-10-12T09:00:00+00:00',
  ...overrides,
});

const rawTransaction = (overrides: Record<string, unknown>) => ({
  id: 812,
  reference: 'TXN-GALLERY1',
  type: 'commission_due',
  label: 'Platform Commission',
  direction: 'debit',
  amount: 58,
  gross_amount: 58,
  fee: 0,
  net_amount: 58,
  balance_change: -58,
  balance_after: -116,
  currency: 'PKR',
  status: 'completed',
  payment_method: 'cash',
  description: null,
  ride: null,
  settlement_id: null,
  reverses_id: null,
  reversed: false,
  created_at: '2026-10-12T09:00:00+00:00',
  ...overrides,
});

const rawSettlement = (overrides: Record<string, unknown>) => ({
  id: 3,
  kind: 'commission_payment',
  amount: 116,
  currency: 'PKR',
  method: 'bank_transfer',
  reference: 'IBFT-123',
  note: null,
  status: 'pending',
  review_note: null,
  reviewed_at: null,
  transaction_id: null,
  created_at: '2026-10-12T10:00:00+00:00',
  ...overrides,
});

const pending = rawSettlement({});

export const galleryDriverWallet: Wallet = toWallet(
  rawWallet({ balance: -116, commission_owed: 116, total_earnings: 1340, can_settle_commission: true }),
);

export const galleryPassengerWallet: Wallet = toWallet(rawWallet({ total_spent: 0 }));

export const galleryTransactions: WalletTransaction[] = [
  rawTransaction({ id: 1 }),
  rawTransaction({
    id: 2,
    type: 'ride_earning',
    label: 'Ride earning',
    direction: 'credit',
    amount: 670,
    balance_change: 670,
    created_at: '2026-10-12T08:40:00+00:00',
  }),
  rawTransaction({ id: 3, created_at: '2026-10-11T18:10:00+00:00' }),
]
  .map(toTransaction)
  .filter((t): t is WalletTransaction => t !== null);

export const gallerySettlements: Settlement[] = [
  pending,
  rawSettlement({
    id: 2,
    method: 'cash',
    reference: null,
    status: 'rejected',
    review_note: 'Receipt unreadable',
    created_at: '2026-10-10T10:00:00+00:00',
  }),
]
  .map(toSettlement)
  .filter((s): s is Settlement => s !== null);
