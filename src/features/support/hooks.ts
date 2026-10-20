import { useCallback } from 'react';
import { SUPPORT_EMAIL } from '../../config/support';
import { CACHE_NAMES, CACHE_TTL } from '../../core/api/queryCache';
import { usePagedList, type PagedList } from '../../core/api/usePagedList';
import { useRemoteData, type RemoteData } from '../../core/api/useRemoteData';
import { t } from '../../i18n';
import { supportApi } from './api';
import type { SupportCategory, SupportContacts, SupportTicket, TicketPage } from './types';

const PUBLIC_SETTINGS_CACHE = { name: CACHE_NAMES.publicSettings, ttlMs: CACHE_TTL.publicSettings } as const;
const CATEGORIES_CACHE = { name: CACHE_NAMES.supportCategories, ttlMs: CACHE_TTL.supportCategories } as const;

/** Before GET /settings/public has ever answered: only the configured email (config/support.ts). */
export const OFFLINE_CONTACTS: SupportContacts = {
  supportPhone: null,
  supportEmail: SUPPORT_EMAIL,
  supportWhatsapp: null,
  supportHours: null,
  termsUrl: null,
  privacyUrl: null,
};

export interface SupportContactsState {
  /** The server's values; OFFLINE_CONTACTS while loading or when the read failed. */
  contacts: SupportContacts;
  /** The server answered (legal rows wait for this). */
  loaded: boolean;
  refresh: () => Promise<void>;
}

/**
 * GET /settings/public, once per session (shared cache: Account's Help group, the Help screen
 * and the account-status sheet read the same answer). No sign-in needed.
 */
export function useSupportContacts(enabled = true): SupportContactsState {
  const fetch = useCallback(() => supportApi.publicSettings(), []);
  const remote = useRemoteData<SupportContacts>({
    fetch,
    fallbackError: t('support.requestsFailed'),
    enabled,
    cache: PUBLIC_SETTINGS_CACHE,
  });
  return { contacts: remote.data ?? OFFLINE_CONTACTS, loaded: remote.data !== null, refresh: remote.refresh };
}

/** GET /support/categories (already filtered for the caller's role), cached for a day. */
export function useSupportCategories(enabled = true): RemoteData<SupportCategory[]> {
  const fetch = useCallback(() => supportApi.categories(), []);
  return useRemoteData<SupportCategory[]>({
    fetch,
    fallbackError: t('support.requestsFailed'),
    enabled,
    cache: CATEGORIES_CACHE,
  });
}

/**
 * Page 1 of GET /support/tickets for the Help screen (the 3 newest and the total for "See all").
 * Read again each time the screen comes back (a request just sent, a reply just read).
 */
export function useRecentTickets(enabled: boolean): RemoteData<TicketPage> {
  const fetch = useCallback(() => supportApi.tickets(1), []);
  return useRemoteData<TicketPage>({ fetch, fallbackError: t('support.requestsFailed'), enabled });
}

const ticketKey = (ticket: SupportTicket) => ticket.id;

/** All requests, 20 a page (SupportRequests). */
export function useTicketList(enabled: boolean): PagedList<SupportTicket> {
  const fetchPage = useCallback((page: number) => supportApi.tickets(page), []);
  return usePagedList({ fetchPage, keyOf: ticketKey, queryKey: 'all', fallbackError: t('support.requestsFailed'), enabled });
}
