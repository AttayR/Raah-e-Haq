/**
 * T-557 (BE-103): a locked fare (BE-82) charged the minutes and km quoted at booking, not the trip
 * as driven. BE-103 keeps those (`quoted_distance_km` decimal string, `quoted_duration_minutes`)
 * on rides and driver earnings rows (with `fare_locked`), so locked receipts name them, and the
 * driver side (trip complete, Earnings rows) labels a locked fare as well. Null quotes (rides
 * completed before BE-103) keep "(quoted at booking)".
 */
import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { DriverRideSummary } from '../../../src/components/driver/DriverRideSummary';
import { ReceiptCard } from '../../../src/features/ride-history/components/RideDetailsSections';
import { toRide } from '../../../src/features/ride-history/api';
import { toRideSummary } from '../../../src/features/driver-ride/steps';
import { toDriverEarnings } from '../../../src/features/stats/api';
import { earningsRideText } from '../../../src/features/stats/format';
import { makeRide } from '../../../test-utils/rideFixtures';

const breakdown = { base: 150, distance: 120, time: 54, stops: 0, min_fare_adjustment: 0, total: 324 };

const renderThemed = async (node: React.ReactElement) => {
  render(<ThemeProvider>{node}</ThemeProvider>);
  // ThemeProvider holds its children until the stored appearance is read (T-601).
  await act(async () => {});
};

describe('BE-103 quoted fields are read nullable', () => {
  it('ride: the decimal string and minutes, null when absent', () => {
    const ride = toRide({ id: 9, status: 'completed', quoted_distance_km: '5.24', quoted_duration_minutes: 18 });
    expect(ride).toMatchObject({ quotedDistanceKm: 5.24, quotedDurationMinutes: 18 });
    expect(toRide({ id: 10, status: 'completed', quoted_distance_km: null })).toMatchObject({
      quotedDistanceKm: null,
      quotedDurationMinutes: null,
    });
    expect(toRideSummary(makeRide({ fare_locked: true, quoted_distance_km: '5.24', quoted_duration_minutes: 18 }))).toMatchObject({
      fareLocked: true,
      quotedDistanceKm: 5.24,
      quotedDurationMinutes: 18,
    });
    expect(toRideSummary(makeRide({}))).toMatchObject({ fareLocked: false, quotedDistanceKm: null, quotedDurationMinutes: null });
  });

  it('earnings row: quoted km, minutes and fare_locked; older rows read null / false', () => {
    const data = toDriverEarnings(
      {
        rides: [
          { id: 7, total_fare: 300, distance_km: 0.4, quoted_distance_km: 5.24, quoted_duration_minutes: 18, fare_locked: true },
          { id: 8, total_fare: 200, distance_km: 3 },
        ],
      },
      'day',
    );
    expect(data.rides[0]).toMatchObject({ quotedDistanceKm: 5.24, quotedDurationMinutes: 18, fareLocked: true });
    expect(data.rides[1]).toMatchObject({ quotedDistanceKm: null, quotedDurationMinutes: null, fareLocked: false });
  });
});

describe('locked receipt labels (T-557)', () => {
  it('ride details receipt names the quoted minutes and km', async () => {
    const ride = toRide({
      id: 9,
      status: 'completed',
      total_fare: 324,
      fare_breakdown: breakdown,
      distance_km: 0.4,
      duration_minutes: 2,
      fare_locked: true,
      accepted_fare: 324,
      quoted_distance_km: '5.24',
      quoted_duration_minutes: 18,
    });
    if (!ride) throw new Error('ride did not parse');
    await renderThemed(<ReceiptCard ride={ride} viewer="driver" />);
    expect(screen.getByText('Time (quoted 18 min)')).toBeTruthy();
    expect(screen.getByText('Distance (quoted 5.2 km)')).toBeTruthy();
    expect(screen.queryByText('Time · 2 min')).toBeNull();
  });

  it('driver trip complete: a locked fare labels its lines as the quote, with or without BE-103', async () => {
    await renderThemed(
      <DriverRideSummary
        ride={makeRide({ status: 'completed', fare_breakdown: breakdown, fare_locked: true, quoted_distance_km: '5.24', quoted_duration_minutes: 18 })}
        onDone={() => undefined}
      />,
    );
    expect(screen.getByText('Distance (quoted 5.2 km)')).toBeTruthy();
    expect(screen.getByText('Time (quoted 18 min)')).toBeTruthy();
    screen.unmount();

    await renderThemed(
      <DriverRideSummary ride={makeRide({ status: 'completed', fare_breakdown: breakdown, fare_locked: true })} onDone={() => undefined} />,
    );
    expect(screen.getByText('Distance (quoted at booking)')).toBeTruthy();
    expect(screen.getByText('Time (quoted at booking)')).toBeTruthy();
    screen.unmount();

    // A metered ride keeps the plain labels.
    await renderThemed(<DriverRideSummary ride={makeRide({ status: 'completed', fare_breakdown: breakdown })} onDone={() => undefined} />);
    expect(screen.queryByText(/quoted/)).toBeNull();
  });

  it('driver Earnings row: a locked fare says so and shows the quoted km', () => {
    const money = (n: number) => `Rs ${n}`;
    const [locked, older, metered] = toDriverEarnings(
      {
        rides: [
          { id: 7, total_fare: 300, platform_commission: 60, distance_km: 0.4, quoted_distance_km: 5.24, fare_locked: true },
          { id: 8, total_fare: 300, platform_commission: 60, distance_km: 3, quoted_distance_km: null, fare_locked: true, commission_rate: 20, commission_amount: 60 },
          { id: 9, total_fare: 300, platform_commission: 60, distance_km: 3, quoted_distance_km: 5.24, fare_locked: false },
        ],
      },
      'day',
    ).rides;
    expect(earningsRideText(locked, money).subtitle).toBe('Quoted 5.2 km · Locked fare Rs 300 · commission Rs 60');
    expect(earningsRideText(older, money).subtitle).toBe('3 km · Locked fare Rs 300 · commission 20% = Rs 60');
    expect(earningsRideText(metered, money).subtitle).toBe('3 km · Fare Rs 300 · commission Rs 60');
  });
});
