/**
 * T-517: VehicleMarker picks the top-down art by vehicle type and map style, sits flat and
 * rotates to the heading, drives smoothly between updates (along the route when on it), and
 * jumps with Reduce Motion. CarMarker stays an alias.
 */
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { DarkTheme, LightTheme, type AppTheme } from '../../../src/theme';
import { VehicleMarker, VehicleMarkerGlyph } from '../../../src/components/ui/VehicleMarker';
import { CarMarker } from '../../../src/components/ui/CarMarker';
import {
  VEHICLE_MARKER_KINDS,
  vehicleMarkerKind,
  vehicleMarkerSource,
} from '../../../src/components/ui/ride/vehicleAssets';
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
  it('maps backend vehicle types to art; van, unknown and missing draw the car', () => {
    expect(vehicleMarkerKind('bike')).toBe('bike');
    expect(vehicleMarkerKind('rickshaw')).toBe('rickshaw');
    expect(vehicleMarkerKind(' Rickshaw ')).toBe('rickshaw');
    expect(vehicleMarkerKind('car')).toBe('car');
    expect(vehicleMarkerKind('van')).toBe('car');
    expect(vehicleMarkerKind('helicopter')).toBe('car');
    expect(vehicleMarkerKind(null)).toBe('car');
    expect(vehicleMarkerKind(undefined)).toBe('car');
  });

  it('has a distinct light and dark image per kind', () => {
    const sources = VEHICLE_MARKER_KINDS.flatMap(kind => [vehicleMarkerSource(kind, 'light'), vehicleMarkerSource(kind, 'dark')]);
    sources.forEach(source => expect(source).toBeTruthy());
    expect(new Set(sources.map(s => JSON.stringify(s))).size).toBe(sources.length);
  });

  it('the glyph shows the image for the type and the theme, 40pt, 60% when muted', () => {
    const { rerender } = render(<VehicleMarkerGlyph vehicleType="bike" testID="g" />);
    expect(screen.getByTestId('g').props.source).toEqual(vehicleMarkerSource('bike', 'light'));
    expect(StyleSheet.flatten(screen.getByTestId('g').props.style)).toMatchObject({ width: 40, height: 40 });
    mockTheme = DarkTheme;
    rerender(<VehicleMarkerGlyph vehicleType="rickshaw" muted testID="g" />);
    expect(screen.getByTestId('g').props.source).toEqual(vehicleMarkerSource('rickshaw', 'dark'));
    expect(StyleSheet.flatten(screen.getByTestId('g').props.style)).toMatchObject({ opacity: 0.6 });
  });
});

describe('VehicleMarker', () => {
  it('is flat, centred, rotated to the server heading, and carries the booked type', async () => {
    render(<VehicleMarker testID="vm" coordinate={at(0)} heading={135} vehicleType="rickshaw" title="Your driver" />);
    await flush();
    expect(markerProps()).toMatchObject({ flat: true, rotation: 135, anchor: { x: 0.5, y: 0.5 }, title: 'Your driver' });
    expect(screen.getByTestId('vm-glyph').props.source).toEqual(vehicleMarkerSource('rickshaw', 'light'));
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

  it('nearby (muted) drivers are not animated and sit below the assigned one', async () => {
    const { rerender } = render(<VehicleMarker testID="vm" coordinate={at(0)} muted vehicleType="bike" />);
    await flush();
    expect(screen.getByTestId('vm').props.zIndex).toBe(0);
    rerender(<VehicleMarker testID="vm" coordinate={at(0, 100)} muted vehicleType="bike" />);
    expect(distanceMeters(markerProps().coordinate, at(0, 100))).toBeLessThan(0.01);
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
