/**
 * App models of the BE-09 wallet ledger (docs/api/CONTRACT_NOTES.md "BE-09 / BE-08").
 * Cash only: there is no top-up, card or gateway; the balance is shown, it never pays a ride.
 */

export type WalletStatus = 'active' | 'suspended' | 'blocked';

/** `none` = informational (cash paid or collected; the balance did not move). */
export type TransactionDirection = 'credit' | 'debit' | 'none';

export type SettlementKind = 'commission_payment' | 'payout';
export type SettlementMethod = 'cash' | 'bank_transfer';
/** BE-70: `reversed` = approved, then its ledger entry was reversed by support. */
export type SettlementStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'reversed';

export interface Settlement {
  id: number;
  kind: SettlementKind;
  amount: number;
  currency: string;
  method: SettlementMethod;
  reference: string | null;
  note: string | null;
  status: SettlementStatus;
  /** The admin's reason on a rejection (shown to the driver). */
  reviewNote: string | null;
  reviewedAt: string | null;
  transactionId: number | null;
  createdAt: string;
}

export interface Wallet {
  /** Signed; a driver's goes negative by the commission owed. */
  balance: number;
  currency: string;
  status: WalletStatus;
  commissionOwed: number;
  availableBalance: number;
  totalSpent: number;
  totalEarnings: number;
  pendingSettlements: Settlement[];
  canSettleCommission: boolean;
  canRequestPayout: boolean;
  updatedAt: string | null;
}

export interface TransactionRide {
  id: number;
  /** Public ride code ("RH…"). */
  rideCode: string | null;
  status: string | null;
  vehicleType: string | null;
  completedAt: string | null;
}

export interface WalletTransaction {
  id: number;
  reference: string | null;
  /** Server type key; unknown keys are kept and shown with `label`. */
  type: string;
  label: string;
  direction: TransactionDirection;
  /** What the row shows (always positive). */
  amount: number;
  grossAmount: number | null;
  fee: number | null;
  netAmount: number | null;
  /** Signed. */
  balanceChange: number;
  /** Null on entries written before BE-09. */
  balanceAfter: number | null;
  currency: string;
  status: string;
  paymentMethod: string | null;
  description: string | null;
  ride: TransactionRide | null;
  settlementId: number | null;
  reversesId: number | null;
  /** A later `reversal` cancelled this entry (struck through). */
  reversed: boolean;
  createdAt: string;
}

export type { Page } from '../../core/api/types';

/** The list filter the Wallet screen offers (maps to `direction`). */
export type TransactionFilter = 'all' | 'credit' | 'debit';

export interface SettlementRequest {
  kind?: SettlementKind;
  amount: number;
  method: SettlementMethod;
  reference?: string;
  note?: string;
}
