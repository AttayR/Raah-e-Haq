import type { BannerTone } from '../../components/ui';
import type { ApiError } from '../../core/api/errors';
import { t } from '../../i18n';
import { BLOCKER_CODES, DELETION_CODES } from './api';
import { formatWait } from './format';

export type Notice = { tone: BannerTone; text: string };

/** What the code step does with a refused POST /account/deletion (UI-R18 §D2.6). */
export type RequestFailure =
  /** 422 INVALID_CODE (boxes clear, error under them) or 429 code_exhausted (also wait to resend). */
  | { kind: 'code'; message: string; retryAfter?: number }
  /** 409 / 422 / 403 blocker or balance: back to Delete account, which re-reads (`reprofile`: already scheduled). */
  | { kind: 'back'; reprofile: boolean }
  /** 429 limits, 503 sms_unavailable (server text), network and the rest. */
  | { kind: 'notice'; notice: Notice };

export const requestFailureOf = (error: ApiError): RequestFailure => {
  if (error.code === DELETION_CODES.invalidCode || (error.status === 422 && error.fieldErrors.code)) {
    return { kind: 'code', message: t('accountDeletion.invalidCode') };
  }
  if (error.code === DELETION_CODES.codeExhausted) {
    return { kind: 'code', message: t('accountDeletion.codeExhausted'), retryAfter: error.retryAfter ?? 60 };
  }
  if (error.status === 429) {
    return {
      kind: 'notice',
      notice: { tone: 'warning', text: t('accountDeletion.codeWait', { time: formatWait(error.retryAfter ?? 60) }) },
    };
  }
  // Blockers and the balance are checked before the code is used, so the same code works after.
  if (error.code && BLOCKER_CODES.has(error.code)) return { kind: 'back', reprofile: false };
  if (error.code === DELETION_CODES.alreadyScheduled) return { kind: 'back', reprofile: true };
  if (error.code === DELETION_CODES.smsUnavailable) return { kind: 'notice', notice: { tone: 'danger', text: error.message } };
  return { kind: 'notice', notice: { tone: 'danger', text: t('accountDeletion.requestFailed') } };
};
