/**
 * UI-R17 round 2 (docs/design/screens/driver-earnings.md §3): the chart's past / today / future
 * days, the trips grouped by day with server totals, the strike status line, the link tiles, the
 * trip row, and the screen's pull to refresh, refresh banner, period switch (dimmed, cached 60 s),
 * empty and end-of-list states.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { apiClient } from '../../../src/services/api';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { toDriverEarnings } from '../../../src/features/stats/api';
import { addDays, localClock, localDateOf, resolveToday, utcOffsetMinutes } from '../../../src/features/stats/earningsDates';
import { chartReadout, chartSlots, clampSelectable, defaultSelection } from '../../../src/features/stats/chartModel';
import { buildTripItems, tripRowText } from '../../../src/features/stats/tripItems';
import { strikeLine } from '../../../src/features/stats/strikeLine';
import { EarningsChart } from '../../../src/features/stats/components/EarningsChart';
import { EarningsLinkTiles } from '../../../src/features/stats/components/EarningsLinkTiles';
import { EarningsTripRow } from '../../../src/features/stats/components/EarningsTripRow';
import { StaleOpacityProvider, useStaleOpacity } from '../../../src/features/stats/components/StaleFade';
import DriverEarningsScreen from '../../../src/features/stats/screens/DriverEarningsScreen';
import type { EarningsDay, EarningsRide } from '../../../src/features/stats/types';
import { envelope, rawWallet } from '../../../test-utils/walletFixtures';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useIsFocused: () => true,
}));

const day = (date: string, earnings = 0, trips = 0): EarningsDay => ({ date, trips, grossFares: earnings, earnings });

const ride = (overrides: Partial<EarningsRide> = {}): EarningsRide => ({
  id: 1,
  rideCode: 'RH-1',
  pickupAddress: null,
  dropoffAddress: null,
  vehicleType: 'car',
  completedAt: '2026-10-20T04:07:00Z',
  distanceKm: 1.1,
  durationMinutes: 6,
  quotedDistanceKm: 5.2,
  quotedDurationMinutes: 12,
  fareLocked: true,
  totalFare: 150,
  platformCommission: 30,
  driverEarnings: 120,
  paymentMethod: 'cash',
  commissionRate: 20,
  commissionAmount: 30,
  bookingFee: 0,
  ...overrides,
});

describe('earnings dates (§3.1 day classes, §3.3 local dates)', () => {
  it('reads the UTC offset from `from`', () => {
    expect(utcOffsetMinutes('2026-10-19T00:00:00+05:00')).toBe(300);
    expect(utcOffsetMinutes('2026-10-19T00:00:00-03:30')).toBe(-210);
    expect(utcOffsetMinutes('2026-10-19T00:00:00Z')).toBe(0);
    expect(utcOffsetMinutes('2026-10-19')).toBeNull();
    expect(utcOffsetMinutes(null)).toBeNull();
  });

  it('BE-125 `today` wins; else the device clock shifted by the offset; else unknown', () => {
    // 20:30 UTC on the 19th is already the 20th in Pakistan.
    const now = Date.UTC(2026, 9, 19, 20, 30);
    expect(resolveToday('2026-10-21', '2026-10-19T00:00:00+05:00', now)).toBe('2026-10-21');
    expect(resolveToday(null, '2026-10-19T00:00:00+05:00', now)).toBe('2026-10-20');
    expect(resolveToday(null, '2026-10-19', now)).toBeNull();
  });

  it('shifts timestamps into the server day and clock', () => {
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(localDateOf('2026-10-19T20:30:00Z', 300)).toBe('2026-10-20');
    expect(localClock('2026-10-19T16:07:00Z', 300)).toBe('9:07 PM');
    expect(localDateOf(null, 300)).toBeNull();
  });

  it('maps BE-125 `today` from the payload, only as a plain date', () => {
    expect(toDriverEarnings({ today: '2026-10-20' }, 'week').today).toBe('2026-10-20');
    expect(toDriverEarnings({ today: '2026-10-20T00:00:00+05:00' }, 'week').today).toBeNull();
    expect(toDriverEarnings({}, 'week').today).toBeNull();
  });
});

describe('chart model (§3.1)', () => {
  const week = [day('2026-10-19', 400, 3), day('2026-10-20', 0, 0), day('2026-10-21'), day('2026-10-22')];

  it('splits past, today and future; future days never get a bar', () => {
    const slots = chartSlots(week, 'week', '2026-10-20');
    expect(slots.map((s) => s.cls)).toEqual(['past', 'today', 'future', 'future']);
    expect(slots.map((s) => s.ratio)).toEqual([1, 0, 0, 0]);
    expect(slots.map((s) => s.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu']);
    // Without a known today every day counts as past (old behaviour).
    expect(chartSlots(week, 'week', null).every((s) => s.cls === 'past')).toBe(true);
  });

  it('month labels: day 1, every 5th and today, dropping a 5th day within 2 days of today', () => {
    const month = Array.from({ length: 31 }, (_, i) => day(`2026-10-${String(i + 1).padStart(2, '0')}`));
    const labels = chartSlots(month, 'month', '2026-10-21').filter((s) => s.label).map((s) => s.label);
    expect(labels).toEqual(['1', '5', '10', '15', '21', '25', '30']);
    // Day 1 always keeps its label, even when today is the 2nd or 3rd; only 5th days are dropped.
    const early = (today: string) => chartSlots(month, 'month', today).filter((s) => s.label).map((s) => s.label);
    expect(early('2026-10-02').slice(0, 3)).toEqual(['1', '2', '5']);
    expect(early('2026-10-03').slice(0, 3)).toEqual(['1', '3', '10']);
  });

  it('selects today when it earned, else the best day so far, and never a future day', () => {
    const slots = chartSlots(week, 'week', '2026-10-20');
    expect(defaultSelection(slots)).toBe(0);
    expect(defaultSelection(chartSlots([day('2026-10-19', 100, 1), day('2026-10-20', 50, 1)], 'week', '2026-10-20'))).toBe(1);
    expect(defaultSelection(chartSlots([day('2026-10-19'), day('2026-10-20'), day('2026-10-21')], 'week', '2026-10-20'))).toBe(1);
    expect(clampSelectable(3, slots)).toBe(1);
    expect(chartReadout(slots[1], 'PKR')).toMatchObject({ date: 'Today', amount: 'Rs 0', trips: 'No trips' });
    expect(chartReadout(slots[0], 'PKR')).toMatchObject({ date: 'Mon, 19 Oct', amount: 'Rs 400', trips: '3 trips' });
  });
});

describe('trips list (§3.3)', () => {
  const series = [day('2026-10-18', 500, 4), day('2026-10-19', 1048, 10), day('2026-10-20', 120, 1)];
  const rides = [
    ride({ id: 1, completedAt: '2026-10-20T04:07:00Z' }),
    ride({ id: 2, completedAt: '2026-10-19T15:00:00Z' }),
    ride({ id: 3, completedAt: null }),
    ride({ id: 4, completedAt: '2026-10-16T10:00:00Z' }),
  ];

  it('groups by server day with "Today" / "Yesterday" headers and the totals from `series`', () => {
    const items = buildTripItems({ rides, series, period: 'week', currency: 'PKR', offset: 300, today: '2026-10-20', hasMore: false });
    expect(items.map((i) => i.key)).toEqual(['day-2026-10-20', 'ride-1', 'day-2026-10-19', 'ride-2', 'ride-3', 'day-2026-10-16', 'ride-4']);
    const headers = items.filter((i) => i.kind === 'day');
    expect(headers.map((h) => (h.kind === 'day' ? [h.label, h.totals, h.first] : null))).toEqual([
      ['Today', 'Rs 120 · 1 trip', true],
      ['Yesterday', 'Rs 1,048 · 10 trips', false],
      // Not in `series`: no totals rather than a sum made in the app.
      ['Fri, 16 Oct', null, false],
    ]);
    const segments = items.filter((i) => i.kind === 'ride').map((i) => (i.kind === 'ride' ? [i.ride.id, i.first, i.last] : null));
    expect(segments).toEqual([
      [1, true, true],
      [2, true, false],
      [3, false, true],
      [4, true, true],
    ]);
  });

  it('Today has no headers; with more pages the last loaded row keeps square corners', () => {
    const items = buildTripItems({ rides: rides.slice(0, 2), series, period: 'day', currency: 'PKR', offset: 300, today: '2026-10-20', hasMore: true });
    expect(items.every((i) => i.kind === 'ride')).toBe(true);
    expect(items[items.length - 1]).toMatchObject({ last: false });
  });

  it('a row: route, time · distance, "Fare · Commission" (+ fee), net; never Quoted / Locked / Yesterday', () => {
    const text = tripRowText(
      ride({ pickupAddress: 'Gulberg, Lahore', dropoffAddress: 'Liberty Market, Lahore', completedAt: '2026-10-19T16:07:00Z', bookingFee: 10 }),
      'PKR',
      300,
    );
    expect(text).toMatchObject({
      title: 'Gulberg → Liberty Market',
      meta: '9:07 PM · 1.1 km',
      split: 'Fare Rs 150 · Commission Rs 30 · Fee Rs 10',
      net: 'Rs 120',
    });
    expect(JSON.stringify(text)).not.toMatch(/Quoted|Locked|Yesterday/);
    expect(text.a11y).toBe('Gulberg → Liberty Market, 9:07 PM, fare Rs 150, commission Rs 30, you keep Rs 120');
    // Older rides without the BE-84 amount use the stored platform commission.
    expect(tripRowText(ride({ commissionAmount: null, platformCommission: 45 }), 'PKR', 300).split).toBe('Fare Rs 150 · Commission Rs 45');
  });
});

describe('strike status line (§3.2)', () => {
  const strikes = { activeCount: 0, reviewThreshold: 3, windowDays: 30, underReview: false, strikes: [] };
  it('only the server states, icon + colour + words', () => {
    expect(strikeLine(null)).toEqual({ text: 'Cancellations and reports', tone: 'textSecondary', icon: null });
    expect(strikeLine(strikes)).toEqual({ text: 'None active', tone: 'success', icon: 'checkMark' });
    expect(strikeLine({ ...strikes, activeCount: 2 })).toEqual({ text: '2 of 3 active', tone: 'warning', icon: 'warning' });
    expect(strikeLine({ ...strikes, activeCount: 3, underReview: true })).toEqual({ text: 'Account under review', tone: 'danger', icon: 'alertTriangle' });
  });
});

const themed = async (node: React.ReactElement) => {
  const view = render(<ThemeProvider>{node}</ThemeProvider>);
  // ThemeProvider holds its children until the stored appearance is read (T-601).
  await act(async () => {});
  return view;
};

describe('EarningsChart (§3.1)', () => {
  const week = [day('2026-10-19', 400, 3), day('2026-10-20', 0, 0), day('2026-10-21'), day('2026-10-22')];
  const renderChart = (stale = false) =>
    themed(<EarningsChart series={week} period="week" currency="PKR" today="2026-10-20" caption="19 – 25 Oct" stale={stale} />);
  const plot = () => screen.getByTestId('earnings-chart-plot');
  const layout = () => fireEvent(plot(), 'layout', { nativeEvent: { layout: { width: 400, height: 141, x: 0, y: 0 } } });

  it('draws a bar for a past earning day, a dot for today at zero, nothing for future days, and marks today', async () => {
    await renderChart();
    expect(screen.getByTestId('earnings-bar-2026-10-19-fill')).toBeTruthy();
    expect(screen.getByTestId('earnings-bar-2026-10-20-zero')).toBeTruthy();
    expect(screen.queryByTestId('earnings-bar-2026-10-21-fill')).toBeNull();
    expect(screen.queryByTestId('earnings-bar-2026-10-21-zero')).toBeNull();
    expect(within(screen.getByTestId('earnings-bar-2026-10-20')).getByTestId('earnings-chart-today')).toBeTruthy();
    expect(screen.getByTestId('earnings-chart-amount')).toHaveTextContent('Rs 400');
    expect(screen.getByTestId('earnings-chart-date')).toHaveTextContent('Mon, 19 Oct');
    expect(plot().props.accessibilityRole).toBe('adjustable');
    expect(plot().props.accessibilityLabel).toBe('Earnings per day, 19 – 25 Oct');
  });

  it('a tap selects the day under the finger and a drag into the future clamps to today', async () => {
    await renderChart();
    layout();
    fireEvent(plot(), 'responderGrant', { nativeEvent: { locationX: 150 } });
    expect(screen.getByTestId('earnings-chart-date')).toHaveTextContent('Today');
    fireEvent(plot(), 'responderMove', { nativeEvent: { locationX: 390 } });
    expect(screen.getByTestId('earnings-chart-date')).toHaveTextContent('Today');
    fireEvent(plot(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(screen.getByTestId('earnings-chart-selected').props.accessibilityLabel).toBe('Today: Rs 0, No trips');
    fireEvent(plot(), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(screen.getByTestId('earnings-chart-date')).toHaveTextContent('Mon, 19 Oct');
  });

  it('stale: not interactive and announced as disabled', async () => {
    await renderChart(true);
    expect(plot().props.accessibilityState).toEqual({ disabled: true });
    expect(plot().props.onStartShouldSetResponder()).toBe(false);
  });
});

/** The screen's stale context around a lone row (§3.6: rows read the flag from context). */
function StaleHost({ stale, children }: React.PropsWithChildren<{ stale: boolean }>) {
  const opacity = useStaleOpacity(stale);
  return (
    <StaleOpacityProvider value={opacity} stale={stale}>
      {children}
    </StaleOpacityProvider>
  );
}

describe('EarningsLinkTiles and EarningsTripRow', () => {
  it('Weekly statements first, then Strikes with the server status; each opens its screen', async () => {
    const onOpenStatements = jest.fn();
    const onOpenStrikes = jest.fn();
    await themed(
      <EarningsLinkTiles
        strikes={{ activeCount: 1, reviewThreshold: 3, windowDays: 30, underReview: false, strikes: [] }}
        onOpenStatements={onOpenStatements}
        onOpenStrikes={onOpenStrikes}
      />,
    );
    const tiles = screen.getAllByRole('button');
    expect(tiles.map((tile) => tile.props.accessibilityLabel)).toEqual([
      'Weekly statements, Fares, commission, payments',
      'Strikes, 1 of 3 active',
    ]);
    fireEvent.press(screen.getByTestId('earnings-statements'));
    fireEvent.press(screen.getByTestId('earnings-strikes'));
    expect(onOpenStatements).toHaveBeenCalledTimes(1);
    expect(onOpenStrikes).toHaveBeenCalledTimes(1);
  });

  it('a trip row opens its ride, and is disabled while stale', async () => {
    const onOpen = jest.fn();
    const item = ride({ id: 9 });
    const text = tripRowText(item, 'PKR', 300);
    const { rerender } = await themed(
      <StaleHost stale={false}>
        <EarningsTripRow ride={item} text={text} first last onOpen={onOpen} />
      </StaleHost>,
    );
    expect(screen.getByTestId('earnings-ride-9-net')).toHaveTextContent('Rs 120');
    expect(screen.getByTestId('earnings-ride-9-split')).toHaveTextContent('Fare Rs 150 · Commission Rs 30');
    fireEvent.press(screen.getByTestId('earnings-ride-9'));
    expect(onOpen).toHaveBeenCalledWith(9);
    rerender(
      <ThemeProvider>
        <StaleHost stale>
          <EarningsTripRow ride={item} text={text} first last onOpen={onOpen} />
        </StaleHost>
      </ThemeProvider>,
    );
    fireEvent.press(screen.getByTestId('earnings-ride-9'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('earnings-ride-9').props.accessibilityState).toMatchObject({ disabled: true });
  });
});

const rawEarnings = (period: string, overrides: Record<string, unknown> = {}) => ({
  period,
  timezone: 'Asia/Karachi',
  from: period === 'day' ? '2026-10-20T00:00:00+05:00' : '2026-10-19T00:00:00+05:00',
  to: '2026-10-25T23:59:59+05:00',
  today: '2026-10-20',
  currency: 'PKR',
  totals: { trips: 1, gross_fares: 150, commission: 30, earnings: 120, distance_km: 1.1, duration_minutes: 6 },
  series: [
    { date: '2026-10-19', trips: 0, gross_fares: 0, earnings: 0 },
    { date: '2026-10-20', trips: 1, gross_fares: 150, earnings: 120 },
    { date: '2026-10-21', trips: 0, gross_fares: 0, earnings: 0 },
  ],
  rides: [{ id: 7, completed_at: '2026-10-20T04:07:00Z', distance_km: 1.1, total_fare: 150, platform_commission: 30, driver_earnings: 120 }],
  pagination: { current_page: 1, last_page: 1, per_page: 20, total: 1 },
  ...overrides,
});

const rawStrikes = { active_count: 0, review_threshold: 3, window_days: 30, under_review: false, strikes: [] };

describe('DriverEarningsScreen round 2', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mockNavigate.mockClear();
    mock.onGet('/wallet').reply(200, envelope(rawWallet()));
    mock.onGet('/driver/strikes').reply(200, envelope(rawStrikes));
  });
  afterEach(() => mock.restore());

  const show = () => render(<ThemeProvider><DriverEarningsScreen /></ThemeProvider>);
  const gets = (url: string) => mock.history.get.filter((request) => request.url === url);
  const pull = async () => {
    await act(async () => {
      screen.getByTestId('earnings-rides').props.refreshControl.props.onRefresh();
    });
  };

  it('the strikes tile reads GET /driver/strikes; a pull refreshes earnings, wallet and strikes once each', async () => {
    mock.onGet('/driver/earnings').reply(200, envelope(rawEarnings('day')));
    show();
    await waitFor(() => expect(screen.getByTestId('earnings-strikes-status')).toHaveTextContent('None active'));
    const before = { earnings: gets('/driver/earnings').length, wallet: gets('/wallet').length, strikes: gets('/driver/strikes').length };
    await pull();
    expect(gets('/driver/earnings').length - before.earnings).toBe(1);
    expect(gets('/wallet').length - before.wallet).toBe(1);
    expect(gets('/driver/strikes').length - before.strikes).toBe(1);
  });

  it('a failed refresh keeps the numbers and shows the warning Banner with Retry', async () => {
    mock.onGet('/driver/earnings').replyOnce(200, envelope(rawEarnings('day')));
    mock.onGet('/driver/earnings').replyOnce(500, {});
    mock.onGet('/driver/earnings').reply(200, envelope(rawEarnings('day')));
    show();
    await waitFor(() => expect(screen.getByTestId('earnings-ride-7')).toBeTruthy());
    await pull();
    expect(screen.getByTestId('earnings-refresh-error')).toHaveTextContent(/Couldn't refresh\. Showing your last numbers\./);
    expect(screen.getByTestId('earnings-total')).toHaveTextContent('Rs 120');
    await act(async () => {
      fireEvent.press(screen.getByTestId('earnings-refresh-retry'));
    });
    await waitFor(() => expect(screen.queryByTestId('earnings-refresh-error')).toBeNull());
  });

  it('a period switch dims the old period and blocks its rows until the new one lands; back within 60 s does not refetch', async () => {
    let answerWeek: (value: [number, unknown]) => void = () => undefined;
    mock.onGet('/driver/earnings').reply((config) => {
      const { period } = config.params as { period: string };
      if (period === 'week') return new Promise((resolve) => (answerWeek = resolve));
      return [200, envelope(rawEarnings('day'))];
    });
    show();
    await waitFor(() => expect(screen.getByTestId('earnings-ride-7')).toBeTruthy());
    fireEvent.press(screen.getByRole('radio', { name: 'Period, This week' }));
    await waitFor(() => expect(gets('/driver/earnings').some((r) => (r.params as { period: string }).period === 'week')).toBe(true));
    // Old (day) content stays, dimmed and not tappable.
    expect(screen.getByTestId('earnings-ride-7').props.accessibilityState).toMatchObject({ disabled: true });
    await act(async () => {
      answerWeek([200, envelope(rawEarnings('week', { rides: [{ id: 8, completed_at: '2026-10-19T10:00:00Z', total_fare: 200, driver_earnings: 160 }] }))]);
    });
    await waitFor(() => expect(screen.getByTestId('earnings-ride-8')).toBeTruthy());
    expect(screen.getByTestId('earnings-ride-8').props.accessibilityState).toMatchObject({ disabled: false });
    expect(screen.getByTestId('earnings-chart')).toBeTruthy();
    expect(screen.getByTestId('earnings-day-2026-10-19')).toHaveTextContent(/Yesterday/);

    const dayReads = gets('/driver/earnings').filter((r) => (r.params as { period: string }).period === 'day').length;
    fireEvent.press(screen.getByRole('radio', { name: 'Period, Today' }));
    await waitFor(() => expect(screen.getByTestId('earnings-ride-7')).toBeTruthy());
    expect(gets('/driver/earnings').filter((r) => (r.params as { period: string }).period === 'day').length).toBe(dayReads);
  });

  it('a failed switch keeps the old period dimmed under a "Couldn\'t load" Banner', async () => {
    mock.onGet('/driver/earnings').reply((config) =>
      (config.params as { period: string }).period === 'month' ? [500, {}] : [200, envelope(rawEarnings('day'))],
    );
    show();
    await waitFor(() => expect(screen.getByTestId('earnings-ride-7')).toBeTruthy());
    fireEvent.press(screen.getByRole('radio', { name: 'Period, This month' }));
    await waitFor(() => expect(screen.getByTestId('earnings-refresh-error')).toHaveTextContent(/Couldn't load This month\./));
    expect(screen.getByTestId('earnings-ride-7').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('an empty period shows the compact empty card with "Go to Drive" (a tab switch only)', async () => {
    mock.onGet('/driver/earnings').reply(
      200,
      envelope(rawEarnings('day', { totals: { trips: 0, earnings: 0 }, rides: [], pagination: { current_page: 1, last_page: 1, total: 0 } })),
    );
    show();
    fireEvent.press(await screen.findByTestId('earnings-empty-action'));
    expect(mockNavigate).toHaveBeenCalledWith('Drive');
    expect(screen.getByText('No trips today')).toBeTruthy();
  });

  it('end of list: "That\'s every trip …" only once more than one page was loaded', async () => {
    mock.onGet('/driver/earnings').reply((config) => {
      const { page } = config.params as { page: number };
      return page === 1
        ? [200, envelope(rawEarnings('day', { pagination: { current_page: 1, last_page: 2, total: 2 } }))]
        : [200, envelope(rawEarnings('day', { rides: [{ id: 9, completed_at: '2026-10-20T03:00:00Z' }], pagination: { current_page: 2, last_page: 2, total: 2 } }))];
    });
    show();
    await waitFor(() => expect(screen.getByTestId('earnings-ride-7')).toBeTruthy());
    expect(screen.queryByTestId('earnings-end')).toBeNull();
    await act(async () => {
      screen.getByTestId('earnings-rides').props.onEndReached();
    });
    await waitFor(() => expect(screen.getByTestId('earnings-ride-9')).toBeTruthy());
    expect(screen.getByTestId('earnings-end')).toHaveTextContent("That's every trip today.");
  });
});
