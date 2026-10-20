/**
 * T-506 (stats part) / T-507: GET /me/stats and GET /driver/earnings are mapped in one place;
 * passenger Home tiles stay hidden at zero rides and say "New" before a rating; driver tiles
 * hide untracked figures; the Earnings screen switches periods and shows its states.
 */
import { todayCells } from '../../../src/components/driver/drive/DriverTodayCard';
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { apiClient } from '../../../src/services/api';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { statsApi, toDriverEarnings, toMyStats } from '../../../src/features/stats/api';
import {
  shortPlace,
  formatMinutes,
  periodCaption,
  toPassengerHomeStats,
} from '../../../src/features/stats/format';
import type { DriverStats, PassengerStats } from '../../../src/features/stats/types';
import { chartSlots } from '../../../src/features/stats/chartModel';
import { tripRowText } from '../../../src/features/stats/tripItems';
import { StatGrid } from '../../../src/features/passenger-home/components/StatGrid';
import DriverEarningsScreen from '../../../src/features/stats/screens/DriverEarningsScreen';
import { envelope, rawWallet } from '../../../test-utils/walletFixtures';
import { isInside } from '../../../test-utils/tabRoot';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useIsFocused: () => true,
}));

const rawPassengerStats = (overrides: Record<string, unknown> = {}) => ({
  role: 'passenger',
  currency: 'PKR',
  total_rides: 48,
  total_distance_km: 312.4,
  total_spent: 15230,
  rating: null,
  member_since: '2025-01-02T08:00:00+00:00',
  ...overrides,
});

const rawEarnings = (period: string, overrides: Record<string, unknown> = {}) => ({
  period,
  timezone: 'Asia/Karachi',
  from: '2026-10-12T00:00:00+05:00',
  to: '2026-10-18T23:59:59+05:00',
  currency: 'PKR',
  totals: { trips: 2, gross_fares: 400, commission: 80, earnings: 320, distance_km: 5, duration_minutes: 30 },
  series: [
    { date: '2026-10-12', trips: 0, gross_fares: 0, earnings: 0 },
    { date: '2026-10-13', trips: 2, gross_fares: 400, earnings: 320 },
  ],
  rides: [
    {
      id: 7,
      ride_id: 'RH-TEST7',
      vehicle_type: 'car',
      completed_at: '2026-10-13T10:00:00+05:00',
      distance_km: 3,
      duration_minutes: 15,
      total_fare: 300,
      platform_commission: 60,
      driver_earnings: 240,
      payment_method: 'cash',
    },
  ],
  pagination: { current_page: 1, last_page: 1, per_page: 20, total: 1 },
  ...overrides,
});

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
});

describe('GET /me/stats mapping', () => {
  it('maps a passenger', () => {
    expect(toMyStats(rawPassengerStats())).toEqual({
      role: 'passenger',
      currency: 'PKR',
      totalRides: 48,
      totalDistanceKm: 312.4,
      totalSpent: 15230,
      rating: null,
      memberSince: '2025-01-02T08:00:00+00:00',
    });
  });

  it('maps a driver, keeping untracked figures null', () => {
    const stats = toMyStats({
      role: 'driver',
      currency: 'PKR',
      total_rides: 33,
      rating: 4.75,
      earnings_today: 400,
      trips_today: 2,
      commission_owed: 116,
      online_minutes_today: null,
      acceptance_rate: null,
    }) as DriverStats;
    expect(stats).toMatchObject({ role: 'driver', earningsToday: 400, tripsToday: 2, rating: 4.75, commissionOwed: 116 });
    expect(stats.onlineMinutesToday).toBeNull();
    expect(stats.acceptanceRate).toBeNull();
    expect(stats.earningsWeek).toBe(0);
  });

  it('calls GET /me/stats', async () => {
    mock.onGet('/me/stats').reply(200, envelope(rawPassengerStats({ total_rides: 3 })));
    expect((await statsApi.getMyStats()).totalRides).toBe(3);
  });
});

describe('passenger Home stats (T-506)', () => {
  it('renders the four tiles from the API, rating "New" before the first rating', async () => {
    const tiles = toPassengerHomeStats(toMyStats(rawPassengerStats()) as PassengerStats);
    render(
      <ThemeProvider>
        <StatGrid stats={tiles} />
      </ThemeProvider>,
    );
    expect(await screen.findByText('48')).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByText('312.4 km')).toBeTruthy();
    expect(screen.getByText('Rs 15,230')).toBeTruthy();
  });

  it('shows a rating with one decimal and hides the section with no rides', () => {
    expect(toPassengerHomeStats(toMyStats(rawPassengerStats({ rating: 4.756 })) as PassengerStats)[1].value).toBe('4.8');
    expect(toPassengerHomeStats(toMyStats(rawPassengerStats({ total_rides: 0 })) as PassengerStats)).toEqual([]);
    expect(toPassengerHomeStats(null)).toEqual([]);
  });
});

describe('driver Today cells (T-507, UI-R11 D4)', () => {
  it('trips, online time only when tracked, rating or New; none on a day with no trip yet', () => {
    const base = toMyStats({ role: 'driver', earnings_today: 1250, trips_today: 2, rating: null }) as DriverStats;
    expect(todayCells(base).map(c => [c.key, c.value])).toEqual([
      ['trips', '2'],
      ['rating', 'New'],
    ]);
    expect(todayCells({ ...base, onlineMinutesToday: 65, rating: 4.86 }).map(c => c.value)).toEqual(['2', '1 h 05 min', '4.9']);
    expect(todayCells({ ...base, tripsToday: 0 })).toEqual([]);
    expect(formatMinutes(45)).toBe('45 min');
  });
});

describe('GET /driver/earnings mapping and format', () => {
  it('maps totals, series, rides and the pagination inside data', () => {
    const earnings = toDriverEarnings(rawEarnings('week'), 'week');
    expect(earnings.totals).toEqual({
      trips: 2,
      grossFares: 400,
      commission: 80,
      earnings: 320,
      distanceKm: 5,
      durationMinutes: 30,
      // BE-123 / BE-124 not sent: null (no rate, no Online stat).
      commissionRate: null,
      commissionAmount: null,
      bookingFees: null,
      onlineMinutes: null,
    });
    expect(earnings.series).toHaveLength(2);
    expect(earnings.rides[0]).toMatchObject({ id: 7, rideCode: 'RH-TEST7', driverEarnings: 240, platformCommission: 60 });
    expect(earnings).toMatchObject({ page: 1, lastPage: 1, total: 1 });
  });

  it('labels periods and bars from calendar dates', () => {
    expect(periodCaption('week', '2026-10-12T00:00:00+05:00', '2026-10-18T23:59:59+05:00')).toBe('12 Oct – 18 Oct');
    expect(periodCaption('day', '2026-10-12T00:00:00+05:00', null)).toBe('Mon, 12 Oct');
    expect(periodCaption('month', '2026-10-01T00:00:00+05:00', null)).toBe('October 2026');
    const week = chartSlots(toDriverEarnings(rawEarnings('week'), 'week').series, 'week', null);
    expect(week.map((slot) => [slot.label, slot.ratio])).toEqual([
      ['Mon', 0],
      ['Tue', 1],
    ]);
    const day = (date: string) => ({ date, trips: 0, grossFares: 0, earnings: 0 });
    const month = chartSlots([day('2026-10-01'), day('2026-10-10'), day('2026-10-11')], 'month', null);
    expect(month.map((slot) => slot.label)).toEqual(['1', '10', '']);
  });

  it('T-514 / UI-R17 §3.3: a trip reads as its route (or its time), never as the raw ride code', () => {
    const [ride] = toDriverEarnings(rawEarnings('day'), 'day').rides;
    const noRoute = tripRowText(ride, 'PKR', 300);
    expect(noRoute.title).not.toContain('RH-TEST7');
    // No route: the time is the title and line 2 starts at the distance.
    expect(noRoute).toMatchObject({ title: '10:00 AM', meta: '3 km', split: 'Fare Rs 300 · Commission Rs 60', net: 'Rs 240' });

    const withRoute = tripRowText(
      { ...ride, pickupAddress: 'Liberty Market, Gulberg III, Lahore', dropoffAddress: 'Emporium Mall, Johar Town' },
      'PKR',
      300,
    );
    expect(withRoute).toMatchObject({ title: 'Liberty Market → Emporium Mall', meta: '10:00 AM · 3 km' });
    expect(shortPlace('  ')).toBeNull();
    expect(shortPlace(null)).toBeNull();
  });

  it('sends period, page and per_page', async () => {
    mock.onGet('/driver/earnings').reply(200, envelope(rawEarnings('month')));
    await statsApi.getDriverEarnings('month');
    expect(mock.history.get[0].params).toEqual({ period: 'month', page: 1, per_page: 20 });
  });
});

describe('DriverEarningsScreen', () => {
  const showEarnings = () =>
    render(
      <ThemeProvider>
        <DriverEarningsScreen />
      </ThemeProvider>,
    );

  it('loads today, switches to the week with a chart, and lists the rides', async () => {
    mock.onGet('/driver/earnings').reply((config) => {
      const { period } = config.params as { period: string };
      if (period === 'day') {
        return [200, envelope(rawEarnings('day', { totals: { trips: 0, earnings: 0 }, series: [{ date: '2026-10-12' }], rides: [] }))];
      }
      return [200, envelope(rawEarnings('week'))];
    });
    showEarnings();
    await waitFor(() => expect(screen.getByTestId('earnings-empty')).toBeTruthy());
    expect(screen.getByText('No trips today')).toBeTruthy();
    expect(screen.getByTestId('earnings-total').props.children).toBe('Rs 0');
    // No chart for a single day.
    expect(screen.queryByTestId('earnings-chart')).toBeNull();

    fireEvent.press(screen.getByRole('radio', { name: 'Period, This week' }));
    await waitFor(() => expect(screen.getByTestId('earnings-ride-7')).toBeTruthy());
    expect(screen.getByTestId('earnings-total').props.children).toBe('Rs 320');
    expect(screen.getByTestId('earnings-commission').props.children).toBe('\u2212 Rs 80');
    expect(screen.getByTestId('earnings-chart')).toBeTruthy();
    // The busiest day is selected first; the readout sits in the card header.
    expect(screen.getByTestId('earnings-chart-selected').props.accessibilityLabel).toBe('Tue, 13 Oct: Rs 320, 2 trips');
    fireEvent(screen.getByTestId('earnings-chart-plot'), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(screen.getByTestId('earnings-chart-selected').props.accessibilityLabel).toBe('Mon, 12 Oct: Rs 0, No trips');
    expect(screen.getByTestId('earnings-ride-7-net').props.children).toBe('Rs 240');
  });

  it('a ride row opens its RideDetails (T-501)', async () => {
    mock.onGet('/driver/earnings').reply(200, envelope(rawEarnings('day')));
    showEarnings();
    fireEvent.press(await screen.findByTestId('earnings-ride-7'));
    expect(mockNavigate).toHaveBeenCalledWith('RideDetails', { rideId: 7 });
    // T-514: the code is for the details screen only.
    expect(screen.queryByText('RH-TEST7')).toBeNull();
  });

  it('is a tab root (UI-R4): large "Earnings" title, no back; the owed card shows what is owed and opens Wallet', async () => {
    mock.onGet('/driver/earnings').reply(200, envelope(rawEarnings('day')));
    mock.onGet('/wallet').reply(200, envelope(rawWallet({ balance: -116, commission_owed: 116, amount_owed: 116 })));
    showEarnings();
    await waitFor(() => expect(screen.getByTestId('earnings-owed-amount').props.children).toBe('Rs 116'));
    expect(screen.getAllByText('Earnings').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('earnings-back')).toBeNull();
    fireEvent.press(screen.getByTestId('earnings-owed-wallet'));
    expect(mockNavigate).toHaveBeenCalledWith('Wallet');
  });

  it('UI-R15b: "Earnings" sits in the bar and the period segments stay pinned, while loading and once loaded', async () => {
    let reply: (value: [number, unknown]) => void = () => undefined;
    mock.onGet('/driver/earnings').reply(() => new Promise((resolve) => (reply = resolve)));
    mock.onGet('/wallet').reply(200, envelope(rawWallet()));
    showEarnings();
    expect(await screen.findByTestId('earnings-loading', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('earnings-title').props.children).toBe('Earnings');
    expect(screen.getByTestId('earnings-period')).toBeTruthy();

    reply([200, envelope(rawEarnings('day'))]);
    await waitFor(() => expect(screen.getByTestId('earnings-ride-7')).toBeTruthy());
    expect(screen.getByTestId('earnings-title').props.children).toBe('Earnings');
    expect(screen.getAllByText('Earnings')).toHaveLength(1);
    expect(isInside(screen.getByTestId('earnings-period'), 'earnings-rides')).toBe(false);
    expect(isInside(screen.getByTestId('earnings-total'), 'earnings-rides')).toBe(true);
    expect(screen.getByTestId('earnings-hairline', { includeHiddenElements: true })).toBeTruthy();
  });

  it('the owed card says the wallet could not load when GET /wallet fails, and a tap retries (never "loading" forever)', async () => {
    mockNavigate.mockClear();
    mock.onGet('/driver/earnings').reply(200, envelope(rawEarnings('day')));
    mock.onGet('/wallet').replyOnce(500, {});
    mock.onGet('/wallet').reply(200, envelope(rawWallet()));
    showEarnings();
    await waitFor(() => expect(screen.getByText("Couldn't load your wallet")).toBeTruthy());
    expect(screen.queryByTestId('earnings-owed-loading')).toBeNull();
    fireEvent.press(screen.getByTestId('earnings-wallet-retry'));
    await waitFor(() => expect(screen.getByText('Nothing owed')).toBeTruthy());
    expect(mockNavigate).not.toHaveBeenCalledWith('Wallet');
  });

  it('shows an error with retry', async () => {
    mock.onGet('/driver/earnings').replyOnce(500, {});
    mock.onGet('/driver/earnings').reply(200, envelope(rawEarnings('day')));
    showEarnings();
    await waitFor(() => expect(screen.getByTestId('earnings-error')).toBeTruthy());
    fireEvent.press(screen.getByTestId('earnings-error-retry'));
    await waitFor(() => expect(screen.getByTestId('earnings-hero')).toBeTruthy());
  });
});
