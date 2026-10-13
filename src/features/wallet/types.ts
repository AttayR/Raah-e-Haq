/**
 * App models of the BE-09 wallet ledger (docs/api/CONTRACT_NOTES.md "BE-09 / BE-08") and the
 * BE-74 top-up. Rides stay cash-paid: the balance never pays a ride; a top-up (JazzCash /
 * Easypaisa) only credits the wallet, and for a driver it lowers the commission owed.
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
  /** BE-74: wallet active and at least one top-up provider enabled ("Add money" shown). */
  canTopUp: boolean;
  /** BE-74 top-up limits and providers; null when the server sends none. */
  topUp: TopUpConfig | null;
  updatedAt: string | null;
}

/** BE-74 top-up methods: the provider's mobile-wallet push, or its hosted checkout page. */
export type TopUpMethod = 'mwallet' | 'card';

/** `created`/`pending` are open; the rest are terminal (`cancelled` is reserved). */
export type TopUpStatus = 'created' | 'pending' | 'succeeded' | 'failed' | 'expired' | 'cancelled';

export interface TopUpProvider {
  /** `jazzcash`, `easypaisa`, or `fake` (local/testing backends only). Never hardcoded in the app. */
  id: string;
  name: string;
  methods: TopUpMethod[];
}

export interface TopUpConfig {
  providers: TopUpProvider[];
  minAmount: number;
  maxAmount: number;
  dailyCap: number;
  /** Cap minus today's succeeded + still-open top-ups (Pakistan day). */
  dailyRemaining: number;
  currency: string;
}

export interface TopUp {
  /** Opaque (`top_…`). */
  id: string;
  provider: string;
  method: TopUpMethod;
  amount: number;
  currency: string;
  status: TopUpStatus;
  /** Masked by the server ("0300*****67"); null for card. */
  mobileNumber: string | null;
  /** `message` is written for people and shown as is. */
  failure: { code: string | null; message: string } | null;
  /** Ledger reference (`TXN-…`) once credited. */
  transactionId: string | null;
  createdAt: string;
  expiresAt: string | null;
  completedAt: string | null;
}

/** What the app does next with a top-up (POST and GET /wallet/topups/{id}). */
export type TopUpNextAction =
  | { type: 'redirect'; url: string; returnUrl: string | null }
  | { type: 'poll'; message: string | null; pollIntervalSeconds: number }
  | { type: 'none' };

export interface TopUpResult {
  topUp: TopUp;
  nextAction: TopUpNextAction;
}

/** POST /wallet/topups. The mobile number and CNIC digits are sent once and never stored or logged. */
export interface TopUpRequest {
  amount: number;
  provider: string;
  method: TopUpMethod;
  /** National form "03XXXXXXXXX"; mwallet only. */
  mobileNumber?: string;
  /** JazzCash mwallet only. */
  cnicLast6?: string;
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
  /** BE-74: the top-up (`TopUp.id`) a `topup` entry credited; null on other entries. */
  topupId: string | null;
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
