import { t } from '../../i18n';
import { formatMoney } from '../../utils/format';
import { formatTime } from '../wallet/format';
import type { CancellationPreview, FarePolicy, OverchargeReport } from './types';

/**
 * Text for fare fairness (T-521). Pure: the numbers come from the server's ride and estimate,
 * the wording from the i18n table.
 */

/** "Rs 3", or "Rs 2.50" for a fractional per-minute rate. */
const money = (amount: number): string => formatMoney(amount);

/**
 * The booking sheet's terms line(s), only when fees are on (BE-85 FARE_FEES_ENABLED): free
 * waiting then the per-minute rate, and the free-cancel window then the fee. Empty otherwise.
 */
export const farePolicyLines = (policy: FarePolicy | null): string[] => {
  if (!policy || !policy.feesEnabled) return [];
  const lines: string[] = [];
  if (policy.waitPerMin > 0) {
    lines.push(t('fare.policyWait', { free: policy.freeWaitMin, rate: money(policy.waitPerMin) }));
  }
  if (policy.cancelFee > 0) {
    lines.push(t('fare.policyCancel', { minutes: policy.freeCancelMinutes, fee: money(policy.cancelFee) }));
  }
  return lines;
};

/**
 * The cancel sheet's line (BE-85 `cancellation_preview`): what cancelling costs now, or until
 * when it is free. Null without a preview (the generic question is shown).
 */
export const cancelPreviewText = (preview: CancellationPreview | null): string | null => {
  if (!preview) return null;
  if (preview.feeNow > 0) return t('fare.cancelCostsNow', { amount: money(preview.feeNow) });
  if (preview.freeUntil) {
    const time = formatTime(preview.freeUntil);
    if (time) return t('fare.cancelFreeUntil', { time });
  }
  return t('fare.cancelFreeNow');
};

/** "2:05" (m:ss) for a waiting time in seconds; negative reads 0:00. */
export const formatClock = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/** Seconds since `fromIso` at `nowMs`; null when unreadable. */
export const secondsSince = (fromIso: string | null | undefined, nowMs: number): number | null => {
  if (!fromIso) return null;
  const start = Date.parse(fromIso);
  return Number.isFinite(start) ? Math.max(0, Math.floor((nowMs - start) / 1000)) : null;
};

/**
 * The waiting timer's second line: the free minutes left, then the rate once they are used up
 * (BE-85 bills whole minutes after `free_wait_min`, up to `max_wait_billed_minutes`).
 */
export const waitingDetail = (policy: FarePolicy, elapsedSeconds: number): string => {
  const freeSeconds = policy.freeWaitMin * 60;
  if (elapsedSeconds < freeSeconds) return t('fare.waitingFree', { left: formatClock(freeSeconds - elapsedSeconds) });
  return t('fare.waitingBilled', {
    rate: money(policy.waitPerMin),
    free: policy.freeWaitMin,
    max: policy.maxWaitBilledMinutes,
  });
};

/** A report's status sentence (open / upheld with or without a refund / rejected). */
export const reportStatusText = (report: OverchargeReport): string => {
  if (report.status === 'upheld') {
    return report.refundAmount > 0
      ? t('fare.reportStatusUpheldRefund', { amount: money(report.refundAmount) })
      : t('fare.reportStatusUpheld');
  }
  if (report.status === 'rejected') return t('fare.reportStatusRejected');
  return t('fare.reportStatusOpen');
};

/** "12.5" / "20": a commission percent without trailing zeros. */
export const formatRate = (rate: number): string => String(Math.round(rate * 100) / 100);

/** What the passenger was charged on a cancelled ride, said from their side; null when nothing. */
export const cancellationFeeText = (fee: number | null, reason: string | null): string | null => {
  if (fee === null || fee <= 0) return null;
  return reason === 'no_show'
    ? t('fare.noShowFeeCharged', { amount: money(fee) })
    : t('fare.cancelFeeCharged', { amount: money(fee) });
};
