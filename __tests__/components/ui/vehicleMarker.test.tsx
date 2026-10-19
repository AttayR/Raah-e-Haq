/**
 * T-517 / T-586: VehicleMarker (the assigned vehicle) draws the react-native-svg art for the
 * vehicle type on its halo, sits flat and rotates to the heading, drives smoothly between updates
 * (along the route when on it), and jumps with Reduce Motion. CarMarker stays an alias. Nearby
 * vehicles have their own layer (`__tests__/features/nearbyVehicles`).
 */
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { DarkTheme, LightTheme, type AppTheme } from '../../../src/theme';
import { VehicleMarker, VehicleMarkerGlyph } from '../../../src/components/ui/VehicleMarker';
import { CarMarker } from '../../../src/components/ui/CarMarker';
import { vehicleMarkerKind } from '../../../src/components/ui/ride/vehicleGlyphs';
import { distanceMeters } from '../../../src/components/ui/ride/vehicleMotion';

let mockTheme: AppTheme = LightTheme;
jest.mock('../../../src/app/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: mockTheme, scheme: 'system', setScheme: jest.fn() }),
}));

const M_PER_DEG_LAT = 111_195;
const ORIGIN = { latitude: 31.5, longitude: 74.3 };
const at = (north: number, east = 0) => ({
  latitude: ORIGIN.latitude + north / M_PER_DEG_LAT,
  longitude: ORIGIN.longitude + east / (M_PER_DEG_LAT * Math.cos((ORIGIN.latitude * Math.PI) / 180)),
});

type MarkerProps = { coordinate: { latitude: number; longitude: number }; rotation: number; flat: boolean };
const markerProps = (id = 'vm') => screen.getByTestId(id).props as MarkerProps;

/** Lets the reduced-motion query resolve. */
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};
const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  mockTheme = LightTheme;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('vehicle art', () => {
  it('maps backend vehicle types to glyphs; unknown and missing draw the car (§1.1)', () => {
    expect(vehicleMarkerKind('bike')).toBe('bike');
    expect(vehicleMarkerKind('parcel')).toBe('bikeParcel');
    expect(vehicleMarkerKind('rickshaw')).toBe('rickshaw');
    expect(vehicleMarkerKind(' Rickshaw ')).toBe('rickshaw');
    expect(vehicleMarkerKind('car')).toBe('car');
    expect(vehicleMarkerKind('car_ac')).toBe('carAc');
    expect(vehicleMarkerKind('van')).toBe('van');
    expect(vehicleMarkerKind('helicopter')).toBe('car');
    expect(vehicleMarkerKind(null)).toBe('car');
    expect(vehicleMarkerKind(undefined)).toBe('car');
  });

  it('the glyph is 40pt nearby and a 64pt halo view when assigned (§1.2, §1.6)', () => {
    const { rerender } = render(<VehicleMarkerGlyph vehicleType="bike" testID="g" />);
    expect(screen.getByTestId('g').props).toMatchObject({ width: 40, height: 40 });
    expect(screen.queryByTestId('g-halo')).toBeNull();
    mockTheme = DarkTheme;
    rerender(<VehicleMarkerGlyph vehicleType="rickshaw" assigned testID="g" />);
    expect(screen.getByTestId('g').props).toMatchObject({ width: 64, height: 64 });
    expect(screen.getByTestId('g-halo')).toBeTruthy();
  });
});

describe('VehicleMarker', () => {
  it('is flat, centred, rotated to the server heading, and carries the booked type', async () => {
    render(<VehicleMarker testID="vm" coordinate={at(0)} heading={135} vehicleType="rickshaw" title="Your driver" />);
    await flush();
    expect(markerProps()).toMatchObject({ flat: true, rotation: 135, anchor: { x: 0.5, y: 0.5 }, title: 'Your driver', zIndex: 4 });
    // The assigned look: 64pt view with the halo (§1.6).
    expect(screen.getByTestId('vm-glyph').props).toMatchObject({ width: 64, height: 64 });
    expect(screen.getByTestId('vm-glyph-halo')).toBeTruthy();
  });

  it('CarMarker is an alias of VehicleMarker', () => {
    expect(CarMarker).toBe(VehicleMarker);
  });

  it('drives linearly over the update interval and turns to the direction of travel', async () => {
    jest.useFakeTimers();
    const { rerender } = render(<VehicleMarker testID="vm" coordinate={at(0)} updateIntervalMs={4000} />);
    await flush();
    // The next update arrives one poll later: it is animated over that gap.
    await advance(4000);
    rerender(<VehicleMarker testID="vm" coordinate={at(0, 100)} updateIntervalMs={4000} />);
    await advance(2000);
    const mid = markerProps();
    // Halfway in time = halfway in distance (linear), within a frame.
    expect(distanceMeters(mid.coordinate, at(0, 50))).toBeLessThan(3);
    expect(mid.rotation).toBeCloseTo(90, 0);
    await advance(2100);
    expect(distanceMeters(markerProps().coordinate, at(0, 100))).toBeLessThan(0.01);
  });

  it('ignores a GPS wobble under ~3 m (no move, no spin)', async () => {
    jest.useFakeTimers();
    const { rerender } = render(<VehicleMarker testID="vm" coordinate={at(0)} heading={0} />);
    await flush();
    rerender(<VehicleMarker testID="vm" coordinate={at(0, 2)} />);
    await advance(1500);
    expect(distanceMeters(markerProps().coordinate, at(0))).toBeLessThan(0.01);
    expect(markerProps().rotation).toBe(0);
  });

  it('follows the route round a corner instead of cutting it', async () => {
    jest.useFakeTimers();
    const road = [at(0), at(100), at(100, 100)];
    const { rerender } = render(<VehicleMarker testID="vm" coordinate={at(50, 4)} route={road} updateIntervalMs={4000} />);
    await flush();
    // Snapped onto the road on placement.
    expect(distanceMeters(markerProps().coordinate, at(50))).toBeLessThan(0.5);
    await advance(4000);
    rerender(<VehicleMarker testID="vm" coordinate={at(103, 50)} route={road} updateIntervalMs={4000} />);
    // 100 m along the road of the 100 m total (50 north + 50 east): half time ≈ the corner.
    await advance(2000);
    expect(distanceMeters(markerProps().coordinate, at(100))).toBeLessThan(4);
    await advance(2100);
    const end = markerProps();
    expect(distanceMeters(end.coordinate, at(100, 50))).toBeLessThan(0.5);
    expect(end.rotation).toBeCloseTo(90, 0);
  });

  it('a move after a standstill catches up within ~2 intervals instead of trailing', async () => {
    jest.useFakeTimers();
    const { rerender } = render(<VehicleMarker testID="vm" coordinate={at(0)} updateIntervalMs={1000} />);
    await flush();
    // 30 s parked (no new position), then it drives 100 m.
    await advance(30_000);
    rerender(<VehicleMarker testID="vm" coordinate={at(0, 100)} updateIntervalMs={1000} />);
    await advance(2050);
    expect(distanceMeters(markerProps().coordinate, at(0, 100))).toBeLessThan(0.01);
  });

  it('teleports over ~500 m', async () => {
    jest.useFakeTimers();
    const { rerender } = render(<VehicleMarker testID="vm" coordinate={at(0)} />);
    await flush();
    rerender(<VehicleMarker testID="vm" coordinate={at(800)} />);
    await advance(16);
    expect(distanceMeters(markerProps().coordinate, at(800))).toBeLessThan(0.01);
  });

  it('Reduce Motion: jumps to the new position and heading at once', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { rerender } = render(<VehicleMarker testID="vm" coordinate={at(0)} />);
    await flush();
    rerender(<VehicleMarker testID="vm" coordinate={at(0, 100)} />);
    expect(distanceMeters(markerProps().coordinate, at(0, 100))).toBeLessThan(0.01);
    expect(markerProps().rotation).toBeCloseTo(90, 0);
  });

  it('stops its animation frame on unmount', async () => {
    jest.useFakeTimers();
    const cancel = jest.spyOn(globalThis, 'cancelAnimationFrame');
    const frames = jest.spyOn(globalThis, 'requestAnimationFrame');
    const { rerender, unmount } = render(<VehicleMarker testID="vm" coordinate={at(0)} />);
    await flush();
    await advance(4000);
    rerender(<VehicleMarker testID="vm" coordinate={at(0, 100)} />);
    await advance(16);
    unmount();
    expect(cancel).toHaveBeenCalled();
    const requested = frames.mock.calls.length;
    await advance(1000);
    expect(frames.mock.calls.length).toBe(requested);
  });
});
