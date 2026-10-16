import { t } from '../../i18n';
import { formatMoney } from '../../utils/format';
import type { AcReport, VehicleAcStatus } from './types';

/** The status line of the passenger's "AC not working" report (BE-86). */
export const acReportStatusText = (report: AcReport): string => {
  if (report.refundAmount > 0) return t('ac.reportRefunded', { amount: formatMoney(report.refundAmount) });
  switch (report.status) {
    case 'upheld':
      return t('ac.reportUpheld');
    case 'rejected':
      return t('ac.reportRejected');
    default:
      return report.suggestedRefund !== null && report.suggestedRefund > 0
        ? t('ac.reportOpenRefund', { amount: formatMoney(report.suggestedRefund) })
        : t('ac.reportOpen');
  }
};

const STATUS_KEYS = {
  none: 'ac.statusNone',
  pending: 'ac.statusPending',
  approved: 'ac.statusApproved',
  rejected: 'ac.statusRejected',
  suspended: 'ac.statusSuspended',
} as const;

/** The driver's AC status in words (Vehicle AC screen). */
export const vehicleAcStatusText = (status: VehicleAcStatus): string => t(STATUS_KEYS[status]);

/** The status pill's tone. */
export const vehicleAcStatusTone = (status: VehicleAcStatus): 'success' | 'warning' | 'danger' | 'neutral' => {
  switch (status) {
    case 'approved':
      return 'success';
    case 'pending':
      return 'warning';
    case 'rejected':
    case 'suspended':
      return 'danger';
    default:
      return 'neutral';
  }
};
