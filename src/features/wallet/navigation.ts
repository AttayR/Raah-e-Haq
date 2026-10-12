import type { WalletTransaction } from './types';

/**
 * Wallet routes, registered in both role stacks (T-508). The screens navigate by these names
 * so they work in either stack.
 */
export type WalletRoutes = {
  Wallet: undefined;
  /** `transaction` is the list row, shown while GET /wallet/transactions/{id} loads. */
  WalletTransaction: { id: number; transaction?: WalletTransaction };
};

/** Driver-only wallet routes: report a commission payment, and the list of reports. */
export type DriverWalletRoutes = WalletRoutes & {
  PayCommission: { owed: number; currency: string };
  WalletSettlements: undefined;
};
