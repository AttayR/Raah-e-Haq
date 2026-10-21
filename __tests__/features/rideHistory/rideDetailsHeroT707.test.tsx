/**
 * T-707 (QA 2026-10-21 bug 5): the driver's ride details hero paired the driver's net (Rs 190)
 * with "Cash (collected by you)" while the rider paid Rs 237 in cash. The hero now shows the cash
 * collected (the rider's total) on the cash line and the net as its own "You keep" line, from the
 * BE-84 split (`driver_net`), else the stored `driver_earnings`.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { setLocale } from '../../../src/i18n';
import '../../../src/i18n/copy-ur-Latn';
import { toRide } from '../../../src/features/ride-history/api';
import { driverKeepOf, rideAmountText, summaryAmountText } from '../../../src/features/ride-history/format';
import { SummaryCard } from '../../../src/features/ride-history/components/RideDetailsSections';
import type { Ride, RideViewer } from '../../../src/features/ride-history/types';
import { makeRide } from '../../../test-utils/rideFixtures';

/** The QA ride: Rs 237 cash, 19.83% commission Rs 47, the driver keeps Rs 190 (fake local values). */
const qaRide = (overrides: Record<string, unknown> = {}): Ride =>
  toRide(
    makeRide({
      id: 537,
      status: 'completed',
      payment_method: 'cash',
      payment_status: 'paid',
      total_fare: 237,
      fare: 237,
      commission_rate: 19.83,
      commission_amount: 47,
      driver_net: 190,
      driver_earnings: 190,
      ...overrides,
    } as Parameters<typeof makeRide>[0]),
  ) as Ride;

const renderSummary = (ride: Ride, viewer: RideViewer) =>
  render(
    <ThemeProvider>
      <SummaryCard ride={ride} viewer={viewer} />
    </ThemeProvider>,
  );

afterEach(() => setLocale('en'));

describe('T-707 driver ride details hero', () => {
  it('shows the cash the rider paid on the cash line, and what the driver keeps separately', async () => {
    renderSummary(qaRide(), 'driver');
    expect(await screen.findByTestId('ride-details-amount')).toHaveTextContent('Rs 237');
    expect(screen.getByText('Cash (collected by you) · Paid')).toBeTruthy();
    expect(screen.getByTestId('ride-details-you-keep')).toHaveTextContent(/^You keep/);
    expect(screen.getByTestId('ride-details-you-keep-amount')).toHaveTextContent('Rs 190');
    expect(screen.getByTestId('ride-details-you-keep').props.accessibilityLabel).toBe('You keep, Rs 190');
  });

  it('the BE-84 driver_net wins over a stored driver_earnings; without either there is no "You keep"', () => {
    expect(driverKeepOf(qaRide({ driver_net: 185, driver_earnings: 190 }), 'driver')).toBe(185);
    expect(driverKeepOf(qaRide({ fare: undefined, commission_amount: undefined, driver_net: undefined }), 'driver')).toBe(190);
    expect(
      driverKeepOf(qaRide({ fare: undefined, commission_amount: undefined, driver_net: undefined, driver_earnings: null }), 'driver'),
    ).toBeNull();
  });

  it('the passenger sees the same total and no "You keep"; unfinished and cancelled rides have none', async () => {
    expect(driverKeepOf(qaRide(), 'passenger')).toBeNull();
    expect(driverKeepOf(qaRide({ status: 'started' }), 'driver')).toBeNull();
    expect(driverKeepOf(qaRide({ status: 'cancelled' }), 'driver')).toBeNull();
    renderSummary(qaRide(), 'passenger');
    expect(await screen.findByTestId('ride-details-amount')).toHaveTextContent('Rs 237');
    expect(screen.queryByTestId('ride-details-you-keep')).toBeNull();
  });

  it('lists still show the driver their earnings; only the details hero changed', () => {
    expect(rideAmountText(qaRide(), 'driver')).toBe('Rs 190');
    expect(summaryAmountText(qaRide(), 'driver')).toBe('Rs 237');
    expect(summaryAmountText(qaRide({ status: 'cancelled' }), 'driver')).toBe('No charge');
  });

  it('Roman Urdu', async () => {
    setLocale('ur-Latn');
    renderSummary(qaRide(), 'driver');
    expect(await screen.findByTestId('ride-details-you-keep')).toHaveTextContent(/^Aap ko milenge/);
  });
});
