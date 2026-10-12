/**
 * T-506 (stats part) / T-507: GET /me/stats and GET /driver/earnings are mapped in one place;
 * passenger Home tiles stay hidden at zero rides and say "New" before a rating; driver tiles
 * hide untracked figures; the Earnings screen switches periods and shows its states.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { apiClient } from '../../../src/services/api';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { statsApi, toDriverEarnings, toMyStats } from '../../../src/features/stats/api';
import {
  barRatios,
  chartLabel,
  formatMinutes,
  periodCaption,
  toDriverTodayValues,
  toPassengerHomeStats,
} from '../../../src/features/stats/format';
import type { DriverStats, PassengerStats } from '../../../src/features/stats/types';
import { StatGrid } from '../../../src/features/passenger-home/components/StatGrid';
import DriverEarningsScreen from '../../../src/features/stats/screens/DriverEarningsScreen';
import { envelope } from '../../../test-utils/walletFixtures';

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

describe('driver Today values (T-507)', () => {
  it('dashes while loading, hides untracked tiles, formats when tracked', () => {
    expect(toDriverTodayValues(null)).toEqual({ earnings: null, trips: null, rating: null });
    const base = toMyStats({ role: 'driver', earnings_today: 1250, trips_today: 2, rating: null }) as DriverStats;
    expect(toDriverTodayValues(base)).toEqual({ earnings: 'Rs 1,250', trips: '2', rating: 'New' });
    expect(toDriverTodayValues({ ...base, onlineMinutesToday: 65, acceptanceRate: 92.4 })).toMatchObject({
      onlineTime: '1 h 05 min',
      acceptance: '92%',
    });
    expect(formatMinutes(45)).toBe('45 min');
  });
});

describe('GET /driver/earnings mapping and format', () => {
  it('maps totals, series, rides and the pagination inside data', () => {
    const earnings = toDriverEarnings(rawEarnings('week'), 'week');
    expect(earnings.totals).toEqual({ trips: 2, grossFares: 400, commission: 80, earnings: 320, distanceKm: 5, durationMinutes: 30 });
    expect(earnings.series).toHaveLength(2);
    expect(earnings.rides[0]).toMatchObject({ id: 7, rideCode: 'RH-TEST7', driverEarnings: 240, platformCommission: 60 });
    expect(earnings).toMatchObject({ page: 1, lastPage: 1, total: 1 });
  });

  it('labels periods and bars from calendar dates', () => {
    expect(periodCaption('week', '2026-10-12T00:00:00+05:00', '2026-10-18T23:59:59+05:00')).toBe('12 Oct – 18 Oct');
    expect(periodCaption('day', '2026-10-12T00:00:00+05:00', null)).toBe('Mon, 12 Oct');
    expect(periodCaption('month', '2026-10-01T00:00:00+05:00', null)).toBe('October 2026');
    expect(chartLabel('2026-10-12', 'week', 0)).toBe('Mon');
    expect(chartLabel('2026-10-10', 'month', 9)).toBe('10');
    expect(chartLabel('2026-10-11', 'month', 10)).toBe('');
    expect(barRatios(toDriverEarnings(rawEarnings('week'), 'week').series)).toEqual([0, 1]);
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
    expect(screen.getByTestId('earnings-commission').props.children).toBe('Rs 80');
    expect(screen.getByTestId('earnings-chart')).toBeTruthy();
    // The busiest day is selected first.
    expect(screen.getByTestId('earnings-chart-selected').props.children).toBe('Tue, 13 Oct: Rs 320 · 2 trips');
    fireEvent.press(screen.getByTestId('earnings-bar-2026-10-12'));
    expect(screen.getByTestId('earnings-chart-selected').props.children).toBe('Mon, 12 Oct: Rs 0 · 0 trips');
    expect(screen.getByText('Rs 240')).toBeTruthy();
  });

  it('a ride row opens its RideDetails (T-501)', async () => {
    mock.onGet('/driver/earnings').reply(200, envelope(rawEarnings('day')));
    showEarnings();
    fireEvent.press(await screen.findByTestId('earnings-ride-7'));
    expect(mockNavigate).toHaveBeenCalledWith('RideDetails', { rideId: 7 });
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
