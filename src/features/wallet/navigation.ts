import type { TopUpResult, Wallet, WalletTransaction } from './types';

/**
 * Wallet routes, registered in both role stacks (T-508). The screens navigate by these names
 * so they work in either stack.
 */
export type WalletRoutes = {
  Wallet: undefined;
  /** `transaction` is the list row, shown while GET /wallet/transactions/{id} loads. */
  WalletTransaction: { id: number; transaction?: WalletTransaction };
  /**
   * T-515: amount, provider and method for a top-up (POST /wallet/topups). `amount` prefills the
   * field (T-543: what the passenger owes), clamped to the server's limits on the screen.
   */
  AddMoney: AddMoneyParams | undefined;
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

export type AddMoneyParams = { amount?: number };

/** Add money's params for an amount owed: prefilled when it is a positive number, else none. */
export const topUpParamsFor = (amountOwed: number | null | undefined): AddMoneyParams | undefined =>
  typeof amountOwed === 'number' && Number.isFinite(amountOwed) && amountOwed > 0 ? { amount: amountOwed } : undefined;

/**
 * The amount for the passenger's "You owe Rs X before your next booking" banner and its top-up
 * prefill, or null when the banner is hidden. BE-100: shown only while `booking_blocked`, with the
 * passenger-side debt (`passenger_amount_owed`), so a dual-role user's driver commission is not in
 * it (blocked without that field: hidden). A backend without `booking_blocked` keeps the BE-85 rule: any `amount_owed` above zero.
 */
export const passengerOwedBannerAmount = (
  wallet: Pick<Wallet, 'amountOwed' | 'passengerAmountOwed' | 'bookingBlocked'>,
): number | null => {
  if (wallet.bookingBlocked === null) return wallet.amountOwed > 0 ? wallet.amountOwed : null;
  if (!wallet.bookingBlocked) return null;
  // Blocked without the passenger-side figure: `amount_owed` may include a dual-role user's
  // commission, so show nothing rather than a wrong amount (POST /rides still reports the right one).
  const owed = wallet.passengerAmountOwed;
  return owed !== null && owed > 0 ? owed : null;
};

/**
 * T-547 (BE-100): the softer info note for a passenger who owes fees but can still book, or null.
 * Needs `booking_blocked: false`, `passenger_amount_owed` above zero and a known `max_owed_to_book`.
 */
export const passengerOwedNote = (
  wallet: Pick<Wallet, 'passengerAmountOwed' | 'maxOwedToBook' | 'bookingBlocked'>,
): { owed: number; limit: number } | null =>
  wallet.bookingBlocked === false &&
  wallet.passengerAmountOwed !== null &&
  wallet.passengerAmountOwed > 0 &&
  wallet.maxOwedToBook !== null
    ? { owed: wallet.passengerAmountOwed, limit: wallet.maxOwedToBook }
    : null;

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
