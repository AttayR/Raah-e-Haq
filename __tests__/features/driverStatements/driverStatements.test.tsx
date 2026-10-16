/**
 * T-521: Earnings → Weekly statements (GET /driver/statements, BE-84) with a week picker that
 * stops at this week, and Earnings → Strikes (GET /driver/strikes, BE-82/BE-85) with the "under
 * review" banner; an overcharge strike is date, kind and status only.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { apiClient } from '../../../src/services/api';
import { calendarDate, shiftDate, toDriverStrikes, toWeeklyStatement } from '../../../src/features/driver-statements/api';
import { nextIsCurrent } from '../../../src/features/driver-statements/hooks';
import WeeklyStatementScreen, { statementLineKey } from '../../../src/features/driver-statements/screens/WeeklyStatementScreen';
import DriverStrikesScreen, { strikeDate, strikeKindLabel } from '../../../src/features/driver-statements/screens/DriverStrikesScreen';
import { envelope } from '../../../test-utils/rideFixtures';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useIsFocused: () => true,
}));

const week = (overrides: Record<string, unknown> = {}) => ({
  week: '2026-W42',
  timezone: 'Asia/Karachi',
  from: '2026-10-12T00:00:00+05:00',
  to: '2026-10-18T23:59:59+05:00',
  currency: 'PKR',
  rides: { count: 2, gross_fares: 400, cash_collected: 400, booking_fees: 0, commission: 50, platform_total: 50, driver_net: 350 },
  by_vehicle_type: [{ vehicle_type: 'car', commission_rate: 12.5, rides: 2, gross_fares: 400, commission: 50, driver_net: 350 }],
  ledger: { commission_due: 50, commission_paid: 10, topups: 0, payouts: 0, other: 0, net_change: -40 },
  balance: { opening: -24, closing: -64 },
  commission_owed: { start_of_week: 24, end_of_week: 64, now: 64 },
  reconciled: true,
  ...overrides,
});

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
});

describe('statement and strike readers', () => {
  it('maps the week', () => {
    const s = toWeeklyStatement(week());
    expect(s.rides).toMatchObject({ count: 2, grossFares: 400, commission: 50, driverNet: 350 });
    expect(s.byVehicleType[0]).toEqual({ vehicleType: 'car', commissionRate: 12.5, rides: 2, grossFares: 400, commission: 50, driverNet: 350 });
    expect(s.owed).toEqual({ startOfWeek: 24, endOfWeek: 64, now: 64 });
    expect(s.ledger.netChange).toBe(-40);
    expect(s.reconciled).toBe(true);
  });

  it('week arithmetic on calendar dates, across a year end', () => {
    expect(calendarDate('2026-10-12T00:00:00+05:00')).toBe('2026-10-12');
    expect(shiftDate('2026-10-12', -7)).toBe('2026-10-05');
    expect(shiftDate('2026-12-28', 7)).toBe('2027-01-04');
    expect(nextIsCurrent('2026-W41', '2026-W42')).toBe(true);
    expect(nextIsCurrent('2026-W40', '2026-W42')).toBe(false);
    expect(nextIsCurrent('2026-W53', '2027-W01')).toBe(true);
  });

  it('an overcharge strike never keeps a reason or ride', () => {
    const data = toDriverStrikes({
      active_count: 2,
      review_threshold: 3,
      window_days: 30,
      under_review: false,
      strikes: [
        { id: 7, kind: 'overcharge_report', reason: 'Passenger reported…', ride: { id: 12 }, status: 'active', counts: true, counts_until: '2026-11-14T12:00:00+00:00', created_at: '2026-10-15T12:00:00+00:00' },
        { id: 8, kind: 'driver_cancel', reason: 'Cancelled after accepting', status: 'voided', counts: false, created_at: '2026-10-14T12:00:00+00:00' },
      ],
    });
    expect(data.strikes[0].reason).toBeNull();
    expect(JSON.stringify(data.strikes[0])).not.toContain('ride');
    expect(data.strikes[1]).toMatchObject({ reason: 'Cancelled after accepting', status: 'voided', counts: false });
    expect(strikeKindLabel('overcharge_report')).toBe('Fare report upheld');
    expect(strikeKindLabel('some_new_kind')).toBe('Some new kind');
  });

  it('BE-105: an AC strike is treated like an overcharge strike (no id, ride or reason; unique keys)', () => {
    const data = toDriverStrikes({
      strikes: [
        { id: 3, kind: 'ac_not_working', reason: 'Passenger said AC off', ride: { id: 12, ride_id: 'R-1' }, status: 'active', counts: true, counts_until: '2026-11-14', created_at: '2026-10-15' },
        { kind: 'ac_not_working', status: 'active', counts: true, counts_until: '2026-11-14', created_at: '2026-10-15' },
      ],
    });
    expect(data.strikes[0]).toEqual({
      key: 'ac_not_working-2026-10-15-0',
      kind: 'ac_not_working',
      status: 'active',
      counts: true,
      countsUntil: '2026-11-14',
      createdAt: '2026-10-15',
      reason: null,
    });
    expect(data.strikes[1].key).toBe('ac_not_working-2026-10-15-1');
    expect(JSON.stringify(data.strikes)).not.toContain('R-1');
    expect(strikeDate('2026-10-15')).toBe('15 Oct 2026');
    expect(strikeDate('2026-13-01')).toBe('');
    expect(strikeDate(null)).toBe('');
  });
});

describe('WeeklyStatementScreen', () => {
  it('opens on this week, goes back a week by date, and returns without `week`', async () => {
    mock.onGet('/driver/statements').reply((config) => {
      const w = config.params?.week;
      if (w === undefined) return [200, envelope(week())];
      if (w === '2026-10-05') {
        return [200, envelope(week({ week: '2026-W41', from: '2026-10-05T00:00:00+05:00', to: '2026-10-11T23:59:59+05:00', reconciled: false }))];
      }
      return [422, { message: 'Bad week', errors: { week: ['Bad week'] } }];
    });
    render(<WeeklyStatementScreen />);
    await waitFor(() => expect(screen.getByTestId('statement-rides')).toBeTruthy());
    expect(screen.getByTestId('statement-range').props.children).toBe('12 Oct – 18 Oct');
    expect(screen.getByTestId('statement-next').props.accessibilityState).toMatchObject({ disabled: true });
    screen.getByText('Your wallet matches your trips for this week.');
    expect(screen.getByTestId('statement-owed-now')).toBeTruthy();

    fireEvent.press(screen.getByTestId('statement-prev'));
    await waitFor(() => expect(screen.getByTestId('statement-range').props.children).toBe('5 Oct – 11 Oct'));
    expect(mock.history.get[1].params).toEqual({ week: '2026-10-05' });
    screen.getByText("Your wallet and trips don't match for this week. Contact support if this stays.");

    fireEvent.press(screen.getByTestId('statement-next'));
    await waitFor(() => expect(screen.getByTestId('statement-range').props.children).toBe('12 Oct – 18 Oct'));
    expect(mock.history.get[2].params).toBeUndefined();
  });

  it('[T-543] one vehicle type at several commission rates renders without a duplicate key', async () => {
    const lines = [
      { vehicle_type: 'car', commission_rate: 19.9, rides: 1, gross_fares: 402, commission: 80, driver_net: 322 },
      { vehicle_type: 'car', commission_rate: 19.91, rides: 2, gross_fares: 442, commission: 88, driver_net: 354 },
      { vehicle_type: 'car', commission_rate: 20, rides: 1, gross_fares: 485, commission: 97, driver_net: 388 },
    ];
    mock.onGet('/driver/statements').reply(200, envelope(week({ by_vehicle_type: lines })));
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<WeeklyStatementScreen />);
    await waitFor(() => expect(screen.getByTestId('statement-types')).toBeTruthy());
    expect(errors.mock.calls.some((call) => String(call[0]).includes('same key'))).toBe(false);
    errors.mockRestore();
    screen.getByText(/Car: 1 trip · 19\.9% commission/);
    screen.getByText(/Car: 2 trips · 19\.91% commission/);
    const keys = toWeeklyStatement(week({ by_vehicle_type: lines }))!.byVehicleType.map(statementLineKey);
    expect(new Set(keys).size).toBe(3);
  });

  it('shows the error with retry', async () => {
    mock.onGet('/driver/statements').networkErrorOnce();
    mock.onGet('/driver/statements').reply(200, envelope(week({ rides: { count: 0 } })));
    render(<WeeklyStatementScreen />);
    await waitFor(() => expect(screen.getByTestId('statement-error')).toBeTruthy());
    fireEvent.press(screen.getByText('Try again'));
    await waitFor(() => expect(screen.getByTestId('statement-empty')).toBeTruthy());
  });
});

describe('DriverStrikesScreen', () => {
  it('shows the under-review banner, the count against the threshold and each strike', async () => {
    mock.onGet('/driver/strikes').reply(
      200,
      envelope({
        active_count: 3,
        review_threshold: 3,
        window_days: 30,
        under_review: true,
        // BE-105 shape for passenger-report strikes: no id, ride or reason; dates only.
        strikes: [
          { kind: 'overcharge_report', status: 'active', counts: true, counts_until: '2026-11-14', created_at: '2026-10-15' },
          { kind: 'ac_not_working', status: 'active', counts: true, counts_until: '2026-11-14', created_at: '2026-10-15' },
          { kind: 'ac_not_working', status: 'active', counts: false, counts_until: '2026-10-01', created_at: '2026-09-01' },
          { id: 9, kind: 'driver_cancel', reason: 'Cancelled after accepting', status: 'active', counts: true, counts_until: '2026-11-13T12:00:00+05:00', created_at: '2026-10-14T12:00:00+05:00' },
        ],
      }),
    );
    render(<DriverStrikesScreen />);
    await waitFor(() => expect(screen.getByTestId('strikes-under-review')).toBeTruthy());
    screen.getByText('3 of 3 active strikes in the last 30 days');
    screen.getByText('Fare report upheld');
    expect(screen.getAllByText('AC not working (confirmed)')).toHaveLength(2);
    // Date-only strings read as that calendar date, without a time.
    expect(screen.getByTestId('strike-overcharge_report-2026-10-15-0-date')).toHaveTextContent('15 Oct 2026');
    expect(screen.getByTestId('strike-overcharge_report-2026-10-15-0-status')).toHaveTextContent('Counts until 14 Nov 2026');
    expect(screen.getByTestId('strike-ac_not_working-2026-10-15-1-status')).toHaveTextContent('Counts until 14 Nov 2026');
    expect(screen.getByTestId('strike-ac_not_working-2026-09-01-2-status')).toHaveTextContent('No longer counts');
    expect(screen.queryByTestId('strike-overcharge_report-2026-10-15-0-reason')).toBeNull();
    expect(screen.queryByTestId('strike-ac_not_working-2026-10-15-1-reason')).toBeNull();
    expect(screen.getByTestId('strike-9-reason')).toHaveTextContent('Cancelled after accepting');
  });

  it('empty and error states', async () => {
    mock.onGet('/driver/strikes').reply(200, envelope({ active_count: 0, review_threshold: 3, window_days: 30, under_review: false, strikes: [] }));
    const { unmount } = render(<DriverStrikesScreen />);
    await waitFor(() => expect(screen.getByTestId('strikes-empty')).toBeTruthy());
    expect(screen.queryByTestId('strikes-under-review')).toBeNull();
    unmount();

    mock.reset();
    mock.onGet('/driver/strikes').reply(403, { success: false, message: 'Drivers only' });
    render(<DriverStrikesScreen />);
    await waitFor(() => expect(screen.getByTestId('strikes-error')).toBeTruthy());
  });
});
