import { t, type TranslationKey } from '../../i18n';

/** Static copy for the wallet (T-508). Amounts and entries come from GET /wallet (BE-09). */
export const WALLET_COPY = {
  title: 'Wallet',
  back: 'Back',
  balanceLabel: 'Wallet balance',
  spentLabel: 'Spent on rides',
  earnedLabel: 'Your earnings (cash)',
  cashOnlyTitle: 'Cash only',
  cashOnlyPassenger: 'Rides are paid in cash to the driver.',
  cashOnlyDriver: 'Passengers pay you in cash. The platform commission is added up here until you settle it.',
  walletSuspended: 'Your wallet is on hold. Contact support if you think this is a mistake.',
  transactions: 'Transactions',
  filterLabel: 'Show',
  filterAll: 'All',
  filterIn: 'Money in',
  filterOut: 'Money out',
  loadFailed: "Couldn't load your wallet",
  transactionsFailed: "Couldn't load your transactions",
  retry: 'Try again',
  emptyTitle: 'No transactions yet',
  emptyBody: 'Your ride payments and wallet changes will show up here.',
  emptyFilteredTitle: 'Nothing here',
  emptyFilteredBody: 'No transactions match this filter.',
  reversed: 'Reversed',
  viewRide: 'View ride',
  pending: 'Pending',
  // Driver commission. T-521: what is owed can include fare-dispute recoveries (BE-82), so it is
  // "amount owed", not "commission".
  commissionTitle: 'Amount owed',
  commissionNoneOwed: 'You owe nothing. Thank you!',
  commissionBody:
    'Platform commission from your trips, plus any fare-dispute recoveries. Pay it at the office in cash or by bank transfer, then report it here. A top-up also lowers it.',
  payCommission: 'Pay commission',
  paymentRequests: 'Payment reports',
  paymentRequestsSubtitle: 'Your commission payments and their review',
  waitingForReview: 'Waiting for review',
  cancelRequest: 'Cancel',
  cancelRequestTitle: 'Cancel this payment report?',
  cancelRequestBody: 'You can report the payment again afterwards.',
  cancelRequestConfirm: 'Cancel report',
  keepRequest: 'Keep request',
  cancelFailed: "Couldn't cancel the report. Please try again.",
  cancelled: 'Payment report cancelled',
  // Transaction detail.
  detailTitle: 'Transaction',
  detailAmount: 'Amount',
  detailType: 'Type',
  detailStatus: 'Status',
  detailDate: 'Date',
  detailReference: 'Reference',
  detailMethod: 'Payment method',
  detailRide: 'Ride',
  detailFare: 'Fare',
  detailCommission: 'Platform commission',
  detailYourShare: 'Your share',
  detailBalanceAfter: 'Balance after',
  detailReversedNote: 'This entry was cancelled by a later reversal.',
  detailReversalNote: 'This entry cancels an earlier one.',
  detailFailed: "Couldn't load this transaction",
  detailNotFound: 'This transaction was not found.',
  // Payment method of a ledger entry; settlement wording only on settlements.
  methodRideCash: 'Cash (paid to driver)',
  methodCashGeneric: 'Cash',
  // Settlement form.
  formTitle: 'Pay commission',
  formOwed: 'You owe',
  formAmount: 'Amount paid (Rs)',
  formMethod: 'How did you pay?',
  methodCash: 'Cash at office',
  methodBank: 'Bank transfer',
  formReference: 'Transfer reference',
  formReferenceOptional: 'Receipt number (optional)',
  formReferenceHint: 'The transaction ID from your bank (letters, numbers and . _ : / # -).',
  formNote: 'Note (optional)',
  formSubmit: 'Report payment',
  formSubmitted: 'Payment reported. It is waiting for review.',
  formFailed: "Couldn't report the payment. Please try again.",
  formInfo: 'An admin checks your payment and then updates your balance.',
  keyboardDone: 'Done',
  // Settlement list.
  settlementsTitle: 'Payment reports',
  settlementsEmptyTitle: 'No payment reports yet',
  settlementsEmptyBody: 'When you report a commission payment it shows here with its review.',
  settlementsFailed: "Couldn't load your payment reports",
  reviewNote: 'Reviewer note',
} as const;

/**
 * T-521: labels for the ledger types BE-82 / BE-85 added, said from the wallet owner's side. Other
 * types keep the server's `label`.
 */
const TYPE_LABEL_KEYS: ReadonlyMap<string, TranslationKey> = new Map<string, TranslationKey>([
  ['cancellation_fee', 'walletTypes.cancellation_fee'],
  ['cancellation_compensation', 'walletTypes.cancellation_compensation'],
  ['cancellation_compensation_release', 'walletTypes.cancellation_compensation_release'],
  ['fare_dispute_charge', 'walletTypes.fare_dispute_charge'],
  ['refund', 'walletTypes.refund'],
  // BE-91: goodwill refunds got their own type; the owner sees the same "Refund".
  ['goodwill_refund', 'walletTypes.refund'],
]);

/** The i18n label of a ledger type the app labels itself, else null (use the server's `label`). */
export const transactionTypeLabel = (type: string): string | null => {
  const key = TYPE_LABEL_KEYS.get(type);
  return key ? t(key) : null;
};

export const SETTLEMENT_STATUS_LABEL = {
  pending: 'Waiting for review',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  reversed: 'Reversed by support',
} as const;

export const SETTLEMENT_METHOD_LABEL = {
  cash: 'Cash at office',
  bank_transfer: 'Bank transfer',
} as const;

export const SETTLEMENT_KIND_LABEL = {
  commission_payment: 'Commission payment',
  payout: 'Payout',
} as const;

export const SETTLEMENT_FORM_ERRORS = {
  amountRequired: 'Enter the amount you paid.',
  amountInvalid: 'Enter an amount like 500 or 500.50.',
  amountMin: 'The amount must be at least Rs 1.',
  amountTooHigh: (owed: string) => `You owe ${owed}. Enter that amount or less.`,
  amountMax: 'The amount is too large.',
  referenceRequired: 'Enter the bank transfer reference.',
  referenceInvalid: 'Use letters, numbers, spaces and . _ : / # - only.',
  referenceTooLong: 'Use 100 characters or fewer.',
  noteTooLong: 'Use 500 characters or fewer.',
  nothingOwed: 'You owe no commission right now.',
} as const;
