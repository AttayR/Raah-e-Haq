import { useCallback, useState } from 'react';
import { CACHE_NAMES, CACHE_TTL } from '../../core/api/queryCache';
import { useRemoteData, type RemoteData } from '../../core/api/useRemoteData';
import { t } from '../../i18n';
import { calendarDate, shiftDate, statementsApi } from './api';
import type { DriverStrikes, WeeklyStatement } from './types';

export interface WeeklyStatementState extends RemoteData<WeeklyStatement> {
  /** False while this week is shown (the server refuses a future week). */
  canGoNext: boolean;
  /** False while nothing has loaded yet (no week to move from). */
  canGoPrev: boolean;
  prev: () => void;
  next: () => void;
}

/**
 * GET /driver/statements for one week. It opens on this week (no `week`: the server's own
 * "this week" in Pakistan time); prev / next ask for a date 7 days from the shown Monday, so the
 * app never computes ISO weeks or time zones itself. The first answer's week is "this week".
 */
export const useWeeklyStatement = (enabled: boolean): WeeklyStatementState => {
  // null = this week; otherwise a date inside the week to show.
  const [anchor, setAnchor] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState<string | null>(null);
  const fetch = useCallback(async () => {
    const statement = await statementsApi.getWeek(anchor);
    if (anchor === null) setCurrentWeek(statement.week);
    return statement;
  }, [anchor]);
  const remote = useRemoteData({ fetch, key: anchor ?? 'current', fallbackError: t('statements.loadFailed'), enabled });
  const monday = calendarDate(remote.data?.from ?? null);
  const showingCurrent = anchor === null || (remote.data !== null && remote.data.week === currentWeek);

  const prev = useCallback(() => {
    if (!monday) return;
    const date = shiftDate(monday, -7);
    if (date) setAnchor(date);
  }, [monday]);
  const shownWeek = remote.data?.week ?? null;
  const next = useCallback(() => {
    if (!monday || showingCurrent || !shownWeek) return;
    // Back to this week: ask without `week`, the same request the screen opened with.
    if (currentWeek && nextIsCurrent(shownWeek, currentWeek)) {
      setAnchor(null);
      return;
    }
    const date = shiftDate(monday, 7);
    if (date) setAnchor(date);
  }, [monday, showingCurrent, shownWeek, currentWeek]);

  return { ...remote, canGoNext: !showingCurrent && !!monday, canGoPrev: !!monday, prev, next };
};

/** True when the week after `shown` is `current` (ISO "2026-W41" → "2026-W42", across years too). */
export const nextIsCurrent = (shown: string, current: string): boolean => {
  const parse = (week: string) => {
    const match = /^(\d{4})-W(\d{2})$/.exec(week);
    return match ? { year: Number(match[1]), week: Number(match[2]) } : null;
  };
  const a = parse(shown);
  const b = parse(current);
  if (!a || !b) return false;
  if (a.year === b.year) return b.week - a.week === 1;
  // 52 or 53 weeks in a year: W52/W53 → W01 of the next year.
  return b.year - a.year === 1 && b.week === 1 && a.week >= 52;
};

/** GET /driver/strikes, read when the screen is focused. */
export const useDriverStrikes = (enabled: boolean): RemoteData<DriverStrikes> =>
  useRemoteData({ fetch: statementsApi.getStrikes, fallbackError: t('strikes.loadFailed'), enabled });

const STRIKES_SUMMARY_CACHE = { name: CACHE_NAMES.driverStrikes, ttlMs: CACHE_TTL.driverStrikes } as const;

/**
 * UI-R17 §3.2: the strikes summary on the Earnings tab, through the query cache (60 s): one
 * request on first focus, none on period switches, a fresh one on pull to refresh. Never polled.
 */
export const useStrikesSummary = (enabled: boolean): RemoteData<DriverStrikes> =>
  useRemoteData({ fetch: statementsApi.getStrikes, fallbackError: t('strikes.loadFailed'), enabled, cache: STRIKES_SUMMARY_CACHE });
