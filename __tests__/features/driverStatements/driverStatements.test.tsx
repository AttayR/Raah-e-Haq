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
import WeeklyStatementScreen from '../../../src/features/driver-statements/screens/WeeklyStatementScreen';
import DriverStrikesScreen, { strikeKindLabel } from '../../../src/features/driver-statements/screens/DriverStrikesScreen';
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
        strikes: [{ id: 7, kind: 'overcharge_report', status: 'active', counts: true, counts_until: '2026-11-14T12:00:00+00:00', created_at: '2026-10-15T12:00:00+00:00' }],
      }),
    );
    render(<DriverStrikesScreen />);
    await waitFor(() => expect(screen.getByTestId('strikes-under-review')).toBeTruthy());
    screen.getByText('3 of 3 active strikes in the last 30 days');
    screen.getByText('Fare report upheld');
    expect(screen.queryByTestId('strike-7-reason')).toBeNull();
    expect(screen.getByTestId('strike-7-status')).toBeTruthy();
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
