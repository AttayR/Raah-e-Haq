/**
 * T-586 (map-vehicles.md §2.7, §3): the nearby layer renders at most 15 markers of the selected
 * tier, runs one shared ticker for all of them (not one loop per marker), goes idle when nothing
 * moves, and stops on unmount.
 */
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { LightTheme, type AppTheme } from '../../../src/theme';
import { NearbyVehicleMarkers } from '../../../src/features/nearby-vehicles';
import type { NearbyDriver } from '../../../src/services/rideService';
import * as nearbyMotion from '../../../src/features/nearby-vehicles/nearbyMotion';

const mockTheme: AppTheme = LightTheme;
jest.mock('../../../src/app/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: mockTheme, scheme: 'system', setScheme: jest.fn() }),
}));

const driver = (i: number, over: Partial<NearbyDriver> = {}): NearbyDriver => ({
  id: `d${i}`,
  vehicle_type: i % 2 ? 'bike' : 'car',
  distance_km: i / 10,
  estimated_arrival_min: 3,
  location: { latitude: 31.5 + i * 0.003, longitude: 74.3 },
  heading: (i * 30) % 360,
  ...over,
});

const advance = async (ms: number, step = 16) => {
  for (let left = ms; left > 0; left -= step) {
    await act(async () => {
      jest.advanceTimersByTime(Math.min(step, left));
    });
  }
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const markers = () => screen.queryAllByTestId(/^nearby-driver-d\d+$/);

describe('NearbyVehicleMarkers', () => {
  it('draws at most 15 (nearest first) and only the selected tier (§3)', async () => {
    const drivers = Array.from({ length: 30 }, (_, i) => driver(i));
    const { rerender } = render(<NearbyVehicleMarkers drivers={drivers} />);
    await advance(500);
    expect(markers()).toHaveLength(15);
    expect(screen.getByTestId('nearby-driver-d0')).toBeTruthy();
    expect(screen.queryByTestId('nearby-driver-d20')).toBeNull();
    rerender(<NearbyVehicleMarkers drivers={drivers} tier="bike" />);
    await advance(500);
    const ids = markers().map(m => m.props.testID as string);
    expect(ids).toHaveLength(15);
    expect(ids.every(id => Number(id.replace('nearby-driver-d', '')) % 2 === 1)).toBe(true);
  });

  it('one shared ticker for every marker, ≤ 15 ticks a second, idle once settled (§2.7)', async () => {
    // Each tick computes the whole layer once (one batched update), whatever the marker count.
    const ticks = jest.spyOn(nearbyMotion, 'advanceNearbyLayer');
    const drivers = Array.from({ length: 15 }, (_, i) => driver(i));
    const { rerender } = render(<NearbyVehicleMarkers drivers={drivers} />);
    await advance(1000);
    expect(markers().every(m => m.props.opacity === 1)).toBe(true);
    // The fade-in (≤ 390 ms with the stagger) took at most ~15 ticks/s plus the immediate first one.
    expect(ticks.mock.calls.length).toBeLessThanOrEqual(1 + Math.ceil(1000 / 66));
    const settled = ticks.mock.calls.length;
    await advance(2000);
    expect(ticks.mock.calls.length).toBe(settled);

    // A poll that moves all 15 by 150 m: still one loop at ≤ 15 ticks a second.
    rerender(<NearbyVehicleMarkers drivers={drivers.map(d => ({ ...d, location: { ...d.location, latitude: d.location.latitude + 0.00135 } }))} />);
    const before = ticks.mock.calls.length;
    await advance(1000);
    expect(ticks.mock.calls.length - before).toBeLessThanOrEqual(1 + Math.ceil(1000 / 66));
  });

  it('stops its ticker on unmount', async () => {
    const ticks = jest.spyOn(nearbyMotion, 'advanceNearbyLayer');
    const { unmount } = render(<NearbyVehicleMarkers drivers={[driver(0), driver(2)]} />);
    await advance(48);
    unmount();
    const done = ticks.mock.calls.length;
    await advance(1000);
    expect(ticks.mock.calls.length).toBe(done);
  });

  it('stale data dims the markers to 0.5 (§2.4)', async () => {
    const { rerender } = render(<NearbyVehicleMarkers drivers={[driver(0)]} />);
    await advance(500);
    rerender(<NearbyVehicleMarkers drivers={[driver(0)]} freshness="stale" />);
    await advance(400);
    expect(screen.getByTestId('nearby-driver-d0').props.opacity).toBeCloseTo(0.5, 5);
  });
});
