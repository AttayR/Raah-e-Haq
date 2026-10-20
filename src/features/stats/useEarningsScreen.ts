import { useCallback, useMemo, useRef, useState } from 'react';
import { useStrikesSummary } from '../driver-statements/hooks';
import { useWallet } from '../wallet/hooks';
import { resolveToday, utcOffsetMinutes } from './earningsDates';
import { useDriverEarnings } from './hooks';
import { buildTripItems, type TripListItem } from './tripItems';
import type { DriverEarnings, EarningsPeriod } from './types';

/**
 * Everything the Earnings tab shows (UI-R17 round 2, driver-earnings.md §3.4–§3.6), read only
 * while the tab is focused: the selected period (cached 60 s per period), the wallet and the
 * strikes summary (cached 60 s). No polling: focus, a period switch and pull to refresh are the
 * only triggers.
 */
export function useEarningsScreen(period: EarningsPeriod, focused: boolean) {
  const earnings = useDriverEarnings(period, focused);
  const wallet = useWallet(focused);
  const strikes = useStrikesSummary(focused);

  // §3.6: a period switch keeps the last period's content (dimmed) until the new one lands, and
  // keeps it dimmed when the new one fails: never undimmed under the new period's label.
  const lastData = useRef<DriverEarnings | null>(null);
  if (earnings.data) lastData.current = earnings.data;
  const stale = !earnings.data && lastData.current !== null && earnings.status !== 'ready';
  const data = earnings.data ?? (stale ? lastData.current : null);
  const periodFailed = stale && earnings.status === 'failed';
  const rides = useMemo(() => (earnings.data ? earnings.rides : data?.rides ?? []), [earnings.data, earnings.rides, data]);
  const hasMore = !!earnings.data && earnings.hasMore;

  const dates = useMemo(
    () => (data ? { today: resolveToday(data.today, data.from), offset: utcOffsetMinutes(data.from) } : { today: null, offset: null }),
    [data],
  );
  const items = useMemo<TripListItem[]>(
    () =>
      data
        ? buildTripItems({
            rides,
            series: data.series,
            period: data.period,
            currency: data.currency,
            offset: dates.offset,
            today: dates.today,
            hasMore,
          })
        : [],
    [data, rides, dates, hasMore],
  );

  // §3.4: one pull refreshes the period's page 1, the wallet and the strikes, each once.
  const [pulling, setPulling] = useState(false);
  const inFlight = useRef(false);
  const { refresh: refreshEarnings } = earnings;
  const { refresh: refreshWallet } = wallet;
  const { refresh: refreshStrikes } = strikes;
  const onRefresh = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPulling(true);
    Promise.all([refreshEarnings(), refreshWallet(), refreshStrikes()]).finally(() => {
      inFlight.current = false;
      setPulling(false);
    });
  }, [refreshEarnings, refreshWallet, refreshStrikes]);

  /** Every page is loaded and there was more than one (§3.5 end of list). */
  const ended = !!earnings.data && !earnings.hasMore && earnings.data.lastPage > 1 && rides.length > 0;
  /** A refresh failed over data still on screen (not a period switch). */
  const refreshFailed = !!earnings.data && earnings.status === 'failed' && !!earnings.error;

  return {
    earnings,
    wallet,
    strikes,
    data,
    stale,
    periodFailed,
    refreshFailed,
    rides,
    items,
    today: dates.today,
    pulling,
    onRefresh,
    ended,
  };
}
