/**
 * Delete account routes (UI-R18 §D), registered in both role stacks: Profile → `DeleteAccount`
 * (consequences, blockers, balance, reason) → `DeleteAccountVerify` (SMS code, final Dialog).
 * AccountRestore is not a route: AuthFlow shows it before any tab (§D4).
 */
export type AccountDeletionRoutes = {
  DeleteAccount: undefined;
  DeleteAccountVerify: DeleteAccountVerifyParams;
};

export interface DeleteAccountVerifyParams {
  phoneMasked: string | null;
  /** Seconds until "Resend code" (the POST /account/deletion/code answer). */
  retryAfter: number;
  /** The server's `scheduled_for_if_now`, for the final Dialog. */
  scheduledForIfNow: string | null;
  acknowledgeBalance: boolean;
  reason: string | null;
}

/** Where the deletion screens send the user (the blockers' actions, the verify step). */
export interface AccountDeletionNavigator {
  navigate(name: 'DeleteAccountVerify', params: DeleteAccountVerifyParams): void;
  navigate(name: 'Booking' | 'DriverRide' | 'ChangePhone'): void;
  navigate(name: 'PayCommission', params: { owed: number; currency: string }): void;
  navigate(name: 'AddMoney', params: { amount: number } | undefined): void;
  goBack(): void;
}
