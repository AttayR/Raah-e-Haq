import { useCallback, useRef, useState } from 'react';
import { confirm } from '../../core/dialog';
import { toApiError } from '../../core/api/errors';
import { usePagedList, type PagedList } from '../../core/api/usePagedList';
import { useRemoteData, type RemoteData } from '../../core/api/useRemoteData';
import { toast } from '../../core/toast';
import { walletApi } from './api';
import { WALLET_COPY } from './copy';
import type { Settlement, SettlementRequest, TransactionFilter, Wallet, WalletTransaction } from './types';

/** GET /wallet for the Wallet screen; refreshed each time the screen is focused. */
export const useWallet = (enabled: boolean): RemoteData<Wallet> =>
  useRemoteData({ fetch: walletApi.getWallet, fallbackError: WALLET_COPY.loadFailed, enabled });

const transactionKey = (item: WalletTransaction) => item.id;
const settlementKey = (item: Settlement) => item.id;

/** GET /wallet/transactions, newest first, one page at a time; a filter change restarts it. */
export const useWalletTransactions = (filter: TransactionFilter, enabled: boolean): PagedList<WalletTransaction> => {
  const fetchPage = useCallback((page: number) => walletApi.listTransactions({ page, filter }), [filter]);
  return usePagedList({
    fetchPage,
    keyOf: transactionKey,
    queryKey: filter,
    fallbackError: WALLET_COPY.transactionsFailed,
    enabled,
  });
};

/** GET /wallet/settlements (driver): every report with its status and review note. */
export const useSettlements = (enabled: boolean): PagedList<Settlement> => {
  const fetchPage = useCallback((page: number) => walletApi.listSettlements({ page }), []);
  return usePagedList({
    fetchPage,
    keyOf: settlementKey,
    queryKey: 'all',
    fallbackError: WALLET_COPY.settlementsFailed,
    enabled,
  });
};

/** GET /wallet/transactions/{id}; shows the row passed from the list while it loads. */
export const useTransactionDetail = (id: number, initial: WalletTransaction | null): RemoteData<WalletTransaction | null> => {
  const fetch = useCallback(() => walletApi.getTransaction(id), [id]);
  const remote = useRemoteData<WalletTransaction | null>({
    fetch,
    key: String(id),
    fallbackError: WALLET_COPY.detailFailed,
  });
  return { ...remote, data: remote.data ?? initial };
};

/**
 * Cancels a pending report after a confirmation. Resolves the cancelled settlement, or null
 * when the person kept it or the server refused (a toast says why).
 */
export const useCancelSettlement = () => {
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const inFlight = useRef(false);

  const cancel = useCallback(async (settlement: Settlement): Promise<Settlement | null> => {
    // Themed kit Dialog (UI-R3): destructive confirm, "Keep request" cancels.
    const confirmed = await confirm({
      title: WALLET_COPY.cancelRequestTitle,
      body: WALLET_COPY.cancelRequestBody,
      confirmLabel: WALLET_COPY.cancelRequestConfirm,
      cancelLabel: WALLET_COPY.keepRequest,
      destructive: true,
    });
    if (!confirmed || inFlight.current) {
      return null;
    }
    inFlight.current = true;
    setCancellingId(settlement.id);
    try {
      const cancelled = await walletApi.cancelSettlement(settlement.id);
      toast.success(WALLET_COPY.cancelled);
      return cancelled ?? { ...settlement, status: 'cancelled' };
    } catch (cause: unknown) {
      const apiError = toApiError(cause);
      // 409 SETTLEMENT_NOT_PENDING / 429 carry server text written for people.
      const known = apiError.kind === 'conflict' || apiError.kind === 'rate_limited' || apiError.kind === 'not_found';
      toast.error(known ? apiError.message : WALLET_COPY.cancelFailed);
      return null;
    } finally {
      inFlight.current = false;
      setCancellingId(null);
    }
  }, []);

  return { cancel, cancellingId };
};

/** POST /wallet/settlements; the caller maps the thrown ApiError onto the form. */
export const submitSettlement = (request: SettlementRequest): Promise<Settlement | null> =>
  walletApi.createSettlement(request);
