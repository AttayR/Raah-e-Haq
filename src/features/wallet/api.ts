import { apiService, unwrap } from '../../services/api';
import { isRecord, readId, readNumber, readNumberOrNull, readOneOf, readText } from '../../core/api/read';
import type { Pagination } from '../../core/api/types';
import type {
  Page,
  Settlement,
  SettlementRequest,
  SettlementStatus,
  TransactionFilter,
  TransactionRide,
  Wallet,
  WalletTransaction,
} from './types';

/**
 * Wallet ledger and driver settlements (BE-09, docs/api/CONTRACT_NOTES.md "BE-09 / BE-08"):
 * - GET    /wallet                      -> data: wallet summary (scoped to the token user)
 * - GET    /wallet/transactions         -> data: [T], pagination (page, per_page, direction, …)
 * - GET    /wallet/transactions/{id}    -> data: T (404 NOT_FOUND when not the caller's)
 * - GET    /wallet/settlements          -> data: [S], pagination (drivers; passengers 403)
 * - POST   /wallet/settlements          -> 201 data: S (pending)
 * - DELETE /wallet/settlements/{id}     -> data: S (cancelled)
 * All through the shared axios client; failures are ApiErrors.
 */

export const TRANSACTIONS_PAGE_SIZE = 20;
export const SETTLEMENTS_PAGE_SIZE = 20;

const STATUSES = ['active', 'suspended', 'blocked'] as const;
const DIRECTIONS = ['credit', 'debit', 'none'] as const;
const KINDS = ['commission_payment', 'payout'] as const;
const METHODS = ['cash', 'bank_transfer'] as const;
const SETTLEMENT_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;

const currencyOf = (value: unknown): string => readText(value) ?? 'PKR';

/** One settlement request; null without a usable id. */
export const toSettlement = (raw: unknown): Settlement | null => {
  if (!isRecord(raw)) return null;
  const id = readId(raw.id);
  if (id === null) return null;
  return {
    id,
    kind: readOneOf(raw.kind, KINDS, 'commission_payment'),
    amount: readNumber(raw.amount),
    currency: currencyOf(raw.currency),
    method: readOneOf(raw.method, METHODS, 'cash'),
    reference: readText(raw.reference),
    note: readText(raw.note),
    status: readOneOf(raw.status, SETTLEMENT_STATUSES, 'pending'),
    reviewNote: readText(raw.review_note),
    reviewedAt: readText(raw.reviewed_at),
    transactionId: readId(raw.transaction_id),
    createdAt: readText(raw.created_at) ?? '',
  };
};

const toList = <T>(raw: unknown, map: (item: unknown) => T | null): T[] =>
  (Array.isArray(raw) ? raw : []).map(map).filter((item): item is T => item !== null);

export const toWallet = (raw: unknown): Wallet => {
  const data = isRecord(raw) ? raw : {};
  const balance = readNumber(data.balance);
  return {
    balance,
    currency: currencyOf(data.currency),
    status: readOneOf(data.status, STATUSES, 'active'),
    // The contract defines it as max(0, -balance); read it, fall back to the rule.
    commissionOwed: Math.max(0, readNumberOrNull(data.commission_owed) ?? -balance),
    availableBalance: Math.max(0, readNumber(data.available_balance)),
    totalSpent: readNumber(data.total_spent),
    totalEarnings: readNumber(data.total_earnings),
    pendingSettlements: toList(data.pending_settlements, toSettlement),
    canSettleCommission: data.can_settle_commission === true,
    canRequestPayout: data.can_request_payout === true,
    updatedAt: readText(data.updated_at),
  };
};

const toRide = (raw: unknown): TransactionRide | null => {
  if (!isRecord(raw)) return null;
  const id = readId(raw.id);
  if (id === null) return null;
  return {
    id,
    rideCode: readText(raw.ride_id),
    status: readText(raw.status),
    vehicleType: readText(raw.vehicle_type),
    completedAt: readText(raw.completed_at),
  };
};

/** Readable fallback for an unknown type without a label: "adjustment_credit" -> "Adjustment credit". */
const humanise = (type: string): string => {
  const words = type.replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Transaction';
};

/** One ledger entry; null without a usable id. */
export const toTransaction = (raw: unknown): WalletTransaction | null => {
  if (!isRecord(raw)) return null;
  const id = readId(raw.id);
  if (id === null) return null;
  const type = readText(raw.type) ?? 'unknown';
  return {
    id,
    reference: readText(raw.reference),
    type,
    label: readText(raw.label) ?? humanise(type),
    direction: readOneOf(raw.direction, DIRECTIONS, 'none'),
    amount: Math.abs(readNumber(raw.amount)),
    grossAmount: readNumberOrNull(raw.gross_amount),
    fee: readNumberOrNull(raw.fee),
    netAmount: readNumberOrNull(raw.net_amount),
    balanceChange: readNumber(raw.balance_change),
    balanceAfter: readNumberOrNull(raw.balance_after),
    currency: currencyOf(raw.currency),
    status: readText(raw.status) ?? 'completed',
    paymentMethod: readText(raw.payment_method),
    description: readText(raw.description),
    ride: toRide(raw.ride),
    settlementId: readId(raw.settlement_id),
    reversesId: readId(raw.reverses_id),
    reversed: raw.reversed === true,
    createdAt: readText(raw.created_at) ?? '',
  };
};

export const toTransactionList = (raw: unknown): WalletTransaction[] => toList(raw, toTransaction);
export const toSettlementList = (raw: unknown): Settlement[] => toList(raw, toSettlement);

const toPage = <T>(items: T[], pagination: Pagination | undefined, page: number): Page<T> => ({
  items,
  page: pagination?.current_page ?? page,
  lastPage: pagination?.last_page ?? page,
  total: pagination?.total ?? items.length,
});

/** The POST body: snake_case, empty optional text left out. */
export const toSettlementBody = (request: SettlementRequest): Record<string, string | number> => {
  const body: Record<string, string | number> = {
    kind: request.kind ?? 'commission_payment',
    amount: request.amount,
    method: request.method,
  };
  const reference = request.reference?.trim();
  if (reference) body.reference = reference;
  const note = request.note?.trim();
  if (note) body.note = note;
  return body;
};

export interface TransactionQuery {
  page: number;
  filter?: TransactionFilter;
  perPage?: number;
}

export const walletApi = {
  async getWallet(): Promise<Wallet> {
    return toWallet(unwrap(await apiService.get<unknown>('/wallet')));
  },

  async listTransactions({ page, filter = 'all', perPage = TRANSACTIONS_PAGE_SIZE }: TransactionQuery): Promise<Page<WalletTransaction>> {
    const params: Record<string, string | number> = { page, per_page: perPage };
    if (filter !== 'all') params.direction = filter;
    const body = await apiService.get<unknown>('/wallet/transactions', { params });
    return toPage(toTransactionList(unwrap(body)), body.pagination, page);
  },

  async getTransaction(id: number): Promise<WalletTransaction | null> {
    return toTransaction(unwrap(await apiService.get<unknown>(`/wallet/transactions/${id}`)));
  },

  async listSettlements({ page, status, perPage = SETTLEMENTS_PAGE_SIZE }: { page: number; status?: SettlementStatus; perPage?: number }): Promise<Page<Settlement>> {
    const params: Record<string, string | number> = { page, per_page: perPage };
    if (status) params.status = status;
    const body = await apiService.get<unknown>('/wallet/settlements', { params });
    return toPage(toSettlementList(unwrap(body)), body.pagination, page);
  },

  async createSettlement(request: SettlementRequest): Promise<Settlement | null> {
    return toSettlement(unwrap(await apiService.post<unknown>('/wallet/settlements', toSettlementBody(request))));
  },

  async cancelSettlement(id: number): Promise<Settlement | null> {
    return toSettlement(unwrap(await apiService.delete<unknown>(`/wallet/settlements/${id}`)));
  },
};
