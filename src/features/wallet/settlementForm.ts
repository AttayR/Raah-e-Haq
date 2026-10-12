import { formatMoney, parseMoneyInput } from '../../core/format/money';
import { SETTLEMENT_FORM_ERRORS as ERRORS } from './copy';
import type { SettlementMethod, SettlementRequest } from './types';

/** The server's limits for POST /wallet/settlements (BE-09). */
export const SETTLEMENT_MIN_AMOUNT = 1;
export const SETTLEMENT_MAX_AMOUNT = 500_000;
export const SETTLEMENT_REFERENCE_MAX = 100;
export const SETTLEMENT_NOTE_MAX = 500;
const REFERENCE_PATTERN = /^[A-Za-z0-9 ._:/#-]+$/;

export interface SettlementFormValues {
  amount: string;
  method: SettlementMethod;
  reference: string;
  note: string;
}

export type SettlementFormField = 'amount' | 'reference' | 'note';
export type SettlementFormErrors = Partial<Record<SettlementFormField, string>>;

export type SettlementValidation =
  | { ok: true; request: SettlementRequest }
  | { ok: false; errors: SettlementFormErrors };

/**
 * Checks the "Pay commission" form the way the server will: amount ≥ Rs 1 (server minimum), at most 2 decimals,
 * not more than what is owed now; a reference is required for a bank transfer and limited to
 * the server's character set. The server re-checks everything (the owed amount can change).
 */
export const validateSettlementForm = (
  values: SettlementFormValues,
  commissionOwed: number,
  currency = 'PKR',
): SettlementValidation => {
  const errors: SettlementFormErrors = {};

  const amountText = values.amount.trim();
  const amount = parseMoneyInput(amountText);
  if (!amountText) errors.amount = ERRORS.amountRequired;
  else if (amount === null) errors.amount = ERRORS.amountInvalid;
  else if (amount < SETTLEMENT_MIN_AMOUNT) errors.amount = ERRORS.amountMin;
  else if (commissionOwed <= 0) errors.amount = ERRORS.nothingOwed;
  else if (amount > commissionOwed) errors.amount = ERRORS.amountTooHigh(formatMoney(commissionOwed, { currency }));
  else if (amount > SETTLEMENT_MAX_AMOUNT) errors.amount = ERRORS.amountMax;

  const reference = values.reference.trim();
  if (!reference) {
    if (values.method === 'bank_transfer') errors.reference = ERRORS.referenceRequired;
  } else if (reference.length > SETTLEMENT_REFERENCE_MAX) {
    errors.reference = ERRORS.referenceTooLong;
  } else if (!REFERENCE_PATTERN.test(reference)) {
    errors.reference = ERRORS.referenceInvalid;
  }

  const note = values.note.trim();
  if (note.length > SETTLEMENT_NOTE_MAX) errors.note = ERRORS.noteTooLong;

  if (Object.keys(errors).length > 0 || amount === null) return { ok: false, errors };
  return {
    ok: true,
    request: {
      kind: 'commission_payment',
      amount,
      method: values.method,
      ...(reference ? { reference } : {}),
      ...(note ? { note } : {}),
    },
  };
};
