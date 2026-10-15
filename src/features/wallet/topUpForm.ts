import { formatMoney } from '../../core/format/money';
import { t } from '../../i18n';
import type { TopUpConfig, TopUpMethod, TopUpProvider, TopUpRequest } from './types';

/** Amounts offered as chips, kept only when they fit the server's limits (BE-74). */
export const TOP_UP_PRESETS: readonly number[] = [500, 1000, 2000, 5000];

const MOBILE_NATIONAL = /^3\d{9}$/;
const CNIC_LAST6 = /^\d{6}$/;
const WHOLE_RUPEES = /^\d+$/;

/** JazzCash's mobile-account API (v2.0) needs the CNIC's last 6 digits (BE-74). */
export const needsCnic = (provider: string | null, method: TopUpMethod | null): boolean =>
  provider === 'jazzcash' && method === 'mwallet';

/** The most one top-up may be now: the per-top-up maximum, capped by what is left of today's limit. */
export const topUpCeiling = (config: TopUpConfig): number => Math.min(config.maxAmount, config.dailyRemaining);

/** False when today's limit cannot fit even the minimum top-up. */
export const canTopUpToday = (config: TopUpConfig): boolean => topUpCeiling(config) >= config.minAmount;

/** The preset chips that are allowed right now. */
export const topUpPresets = (config: TopUpConfig): number[] => {
  const ceiling = topUpCeiling(config);
  return TOP_UP_PRESETS.filter((amount) => amount >= config.minAmount && amount <= ceiling);
};

/**
 * The amount to prefill from what is owed (T-543): whole rupees rounded up (so the top-up clears
 * the debt), at least the minimum and at most the ceiling. Null when nothing fits today.
 */
export const prefillTopUpAmount = (owed: number | null | undefined, config: TopUpConfig): number | null => {
  if (typeof owed !== 'number' || !Number.isFinite(owed) || owed <= 0 || !canTopUpToday(config)) return null;
  return Math.min(topUpCeiling(config), Math.max(config.minAmount, Math.ceil(owed)));
};

export interface TopUpFormValues {
  /** As typed: whole rupees. */
  amount: string;
  provider: string | null;
  method: TopUpMethod | null;
  /** National digits from the phone field ("3001234567"). */
  mobile: string;
  cnic: string;
}

export type TopUpFormField = 'amount' | 'provider' | 'method' | 'mobile' | 'cnic';
export type TopUpFormErrors = Partial<Record<TopUpFormField, string>>;

export type TopUpValidation = { ok: true; request: TopUpRequest } | { ok: false; errors: TopUpFormErrors };

const providerOf = (config: TopUpConfig, id: string | null): TopUpProvider | null =>
  config.providers.find((provider) => provider.id === id) ?? null;

/**
 * Checks the Add money form the way the server will (whole rupees, min..max, today's remaining
 * limit, an enabled provider and method, a Pakistani mobile number and, for JazzCash mobile
 * accounts, the CNIC's last 6 digits). The server checks everything again.
 */
export const validateTopUpForm = (values: TopUpFormValues, config: TopUpConfig): TopUpValidation => {
  const errors: TopUpFormErrors = {};
  const money = (amount: number) => formatMoney(amount, { currency: config.currency });

  const amountText = values.amount.trim();
  const amount = WHOLE_RUPEES.test(amountText) ? Number(amountText) : null;
  if (!amountText) errors.amount = t('topUp.amountRequired');
  else if (amount === null) errors.amount = t('topUp.amountWhole');
  else if (amount < config.minAmount) errors.amount = t('topUp.amountMin', { min: money(config.minAmount) });
  else if (amount > config.maxAmount) errors.amount = t('topUp.amountMax', { max: money(config.maxAmount) });
  else if (amount > config.dailyRemaining) {
    errors.amount = canTopUpToday(config)
      ? t('topUp.amountDaily', { amount: money(config.dailyRemaining) })
      : t('topUp.dailyReached');
  }

  const provider = providerOf(config, values.provider);
  if (!provider) errors.provider = t('topUp.providerRequired');
  const method = values.method;
  if (!method || (provider && !provider.methods.includes(method))) errors.method = t('topUp.methodRequired');

  const mwallet = method === 'mwallet';
  const mobile = values.mobile.replace(/\D/g, '');
  if (mwallet) {
    if (!mobile) errors.mobile = t('topUp.mobileRequired');
    else if (!MOBILE_NATIONAL.test(mobile)) errors.mobile = t('topUp.mobileInvalid');
  }
  const cnicNeeded = needsCnic(provider?.id ?? null, method);
  const cnic = values.cnic.trim();
  if (cnicNeeded) {
    if (!cnic) errors.cnic = t('topUp.cnicRequired');
    else if (!CNIC_LAST6.test(cnic)) errors.cnic = t('topUp.cnicInvalid');
  }

  if (Object.keys(errors).length > 0 || amount === null || !provider || !method) return { ok: false, errors };
  return {
    ok: true,
    request: {
      amount,
      provider: provider.id,
      method,
      ...(mwallet ? { mobileNumber: `0${mobile}` } : {}),
      ...(cnicNeeded ? { cnicLast6: cnic } : {}),
    },
  };
};

/** Server field errors (422 `errors.*`) mapped onto the form fields. */
export const topUpFieldErrors = (fields: Partial<Record<string, string>>): TopUpFormErrors => {
  const errors: TopUpFormErrors = {};
  if (fields.amount) errors.amount = fields.amount;
  if (fields.provider) errors.provider = fields.provider;
  if (fields.method) errors.method = fields.method;
  if (fields.mobile_number) errors.mobile = fields.mobile_number;
  if (fields.cnic_last6) errors.cnic = fields.cnic_last6;
  return errors;
};
