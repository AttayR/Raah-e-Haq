import type { TopUpResult, WalletTransaction } from './types';

/**
 * Wallet routes, registered in both role stacks (T-508). The screens navigate by these names
 * so they work in either stack.
 */
export type WalletRoutes = {
  Wallet: undefined;
  /** `transaction` is the list row, shown while GET /wallet/transactions/{id} loads. */
  WalletTransaction: { id: number; transaction?: WalletTransaction };
  /** T-515: amount, provider and method for a top-up (POST /wallet/topups). */
  AddMoney: undefined;
  /** T-515: the provider's hosted checkout in an in-app browser (`next_action.redirect`). */
  TopUpCheckout: TopUpCheckoutParams;
  /**
   * T-515: one top-up's result, polled from GET /wallet/topups/{id}. `result` is the POST answer
   * (shown at once); the `raahehaq://wallet/topup?id=…` return link opens it with the id only.
   */
  TopUpStatus: TopUpStatusParams;
};

export type TopUpCheckoutParams = {
  result: TopUpResult;
  url: string;
  returnUrl: string | null;
  providerName?: string;
};

export type TopUpStatusParams = { id: string; result?: TopUpResult; providerName?: string };

/** Driver-only wallet routes: report a commission payment, and the list of reports. */
export type DriverWalletRoutes = WalletRoutes & {
  PayCommission: { owed: number; currency: string };
  WalletSettlements: undefined;
};

/** Route names of the top-up flow (the same in both role stacks). */
export const ADD_MONEY_ROUTE = 'AddMoney' as const;
export const TOP_UP_CHECKOUT_ROUTE = 'TopUpCheckout' as const;
export const TOP_UP_STATUS_ROUTE = 'TopUpStatus' as const;

/** The stacks' `getId` for `TopUpStatus`: one screen per top-up (a return link never stacks a twin). */
export const topUpStatusScreenId = ({ params }: { params: TopUpStatusParams }): string => params.id;
