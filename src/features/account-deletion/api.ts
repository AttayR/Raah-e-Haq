import { apiService, unwrap } from '../../services/api';
import { isRecord, readNumber, readText } from '../../core/api/read';

/**
 * Self-service account deletion (UI-R18 §D; BE-129 + BE-132/133/135, CONTRACT_NOTES
 * "Self-service account deletion"), through the shared client:
 * - GET  /account/deletion         -> state, dates, erase/keep keys, blockers, balance, masked phone
 * - POST /account/deletion/code    -> { expires_in, retry_after, phone_masked } (429 retry_after)
 * - POST /account/deletion         -> { state: 'scheduled', scheduled_for } (tokens already revoked)
 * - POST /account/deletion/cancel  -> { state: 'none', scheduled_for: null, cancelled }
 * Dates are the server's ISO strings, shown as sent (the app never adds grace_days itself).
 */

export const DELETION_CODES = {
  activeRide: 'ACTIVE_RIDE',
  commissionOwed: 'COMMISSION_OWED',
  phoneNotVerified: 'PHONE_NOT_VERIFIED',
  topUpPending: 'TOPUP_PENDING',
  alreadyScheduled: 'DELETION_ALREADY_SCHEDULED',
  balanceNotAcknowledged: 'BALANCE_NOT_ACKNOWLEDGED',
  invalidCode: 'INVALID_CODE',
  codeExhausted: 'code_exhausted',
  smsUnavailable: 'sms_unavailable',
  /** 423 on POST /rides, going online and POST /wallet/topups during the cooling-off period. */
  scheduled: 'ACCOUNT_DELETION_SCHEDULED',
} as const;

/** The server's blocker codes that keep POST /account/deletion from going through (409 / 403). */
export const BLOCKER_CODES: ReadonlySet<string> = new Set([
  DELETION_CODES.activeRide,
  DELETION_CODES.commissionOwed,
  DELETION_CODES.phoneNotVerified,
  DELETION_CODES.topUpPending,
  DELETION_CODES.balanceNotAcknowledged,
]);

export type DeletionBlocker =
  | { code: 'ACTIVE_RIDE' }
  | { code: 'COMMISSION_OWED'; amount: number; currency: string | null; payWith: ReadonlyArray<string> }
  | { code: 'PHONE_NOT_VERIFIED' }
  /** `retryAfterAt` (BE-135): a failed or expired top-up the provider could still confirm late. */
  | { code: 'TOPUP_PENDING'; retryAfterAt: string | null }
  | { code: 'OTHER' };

export interface DeletionStatus {
  state: 'none' | 'scheduled';
  scheduledFor: string | null;
  /** The date a request made now would get (the server's, never computed here). */
  scheduledForIfNow: string | null;
  retentionYears: number | null;
  erase: ReadonlyArray<string>;
  keep: ReadonlyArray<string>;
  blockers: ReadonlyArray<DeletionBlocker>;
  /** Forfeited credit when > 0; negative is a debt (a COMMISSION_OWED blocker then). */
  walletBalance: number;
  currency: string | null;
  phoneMasked: string | null;
  isDriver: boolean;
  reasons: ReadonlyArray<string>;
}

export interface DeletionCodeSent {
  expiresIn: number;
  /** Seconds before another code may be asked for. */
  retryAfter: number;
  phoneMasked: string | null;
}

export interface DeletionRequest {
  code: string;
  reason?: string | null;
  acknowledgeBalance?: boolean;
}

const toStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];

const toBlocker = (raw: unknown): DeletionBlocker | null => {
  if (!isRecord(raw)) return null;
  switch (raw.code) {
    case DELETION_CODES.activeRide:
      return { code: 'ACTIVE_RIDE' };
    case DELETION_CODES.commissionOwed:
      return {
        code: 'COMMISSION_OWED',
        amount: Math.abs(readNumber(raw.amount)),
        currency: readText(raw.currency),
        payWith: toStrings(raw.pay_with),
      };
    case DELETION_CODES.phoneNotVerified:
      return { code: 'PHONE_NOT_VERIFIED' };
    case DELETION_CODES.topUpPending:
      return { code: 'TOPUP_PENDING', retryAfterAt: readText(raw.retry_after_at) };
    default:
      // An unknown blocker still blocks (the server will refuse), shown with general copy.
      return typeof raw.code === 'string' ? { code: 'OTHER' } : null;
  }
};

export const toDeletionStatus = (raw: unknown): DeletionStatus => {
  const data = isRecord(raw) ? raw : {};
  const retention = readNumber(data.retention_years, -1);
  return {
    state: data.state === 'scheduled' ? 'scheduled' : 'none',
    scheduledFor: readText(data.scheduled_for),
    scheduledForIfNow: readText(data.scheduled_for_if_now),
    retentionYears: retention > 0 ? retention : null,
    erase: toStrings(data.erase),
    keep: toStrings(data.keep),
    blockers: (Array.isArray(data.blockers) ? data.blockers : [])
      .map(toBlocker)
      .filter((b): b is DeletionBlocker => b !== null),
    walletBalance: readNumber(data.wallet_balance),
    currency: readText(data.currency),
    phoneMasked: readText(data.phone_masked),
    isDriver: data.is_driver === true,
    reasons: toStrings(data.reasons),
  };
};

export const toCodeSent = (raw: unknown): DeletionCodeSent => {
  const data = isRecord(raw) ? raw : {};
  return {
    expiresIn: Math.max(0, readNumber(data.expires_in)),
    retryAfter: Math.max(0, Math.round(readNumber(data.retry_after))),
    phoneMasked: readText(data.phone_masked),
  };
};

export const accountDeletionApi = {
  async status(): Promise<DeletionStatus> {
    return toDeletionStatus(unwrap(await apiService.get<unknown>('/account/deletion')));
  },
  async sendCode(): Promise<DeletionCodeSent> {
    return toCodeSent(unwrap(await apiService.post<unknown>('/account/deletion/code')));
  },
  /** Resolves the server's deletion date. */
  async request({ code, reason, acknowledgeBalance }: DeletionRequest): Promise<string | null> {
    const body: Record<string, unknown> = { code };
    if (reason) body.reason = reason;
    if (acknowledgeBalance) body.acknowledge_balance = true;
    const data = unwrap(await apiService.post<unknown>('/account/deletion', body));
    return isRecord(data) ? readText(data.scheduled_for) : null;
  },
  async cancel(): Promise<void> {
    await apiService.post<unknown>('/account/deletion/cancel');
  },
};
