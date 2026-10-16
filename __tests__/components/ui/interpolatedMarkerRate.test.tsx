/**
 * T-535 (PERF-13): the live vehicle marker commits at most ~30 frames a second, skips frames
 * that would move it under 0.5 m and turn it under 1°, still lands exactly on the target, and
 * stops its frame loop while its screen is blurred or the app is in the background.
 *
 * Jest's fake requestAnimationFrame fires every 16 ms (60 fps), so before T-535 the hook
 * committed about 60 times per animated second here. Time is advanced one frame per `act` so
 * React renders every commit (one `act` batches all of them into a single render).
 */
import React from 'react';
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';
import { act, render, renderHook, screen } from '@testing-library/react-native';
import { NavigationContext } from '@react-navigation/native';
import { LightTheme, type AppTheme } from '../../../src/theme';
import {
  MARKER_FRAME_MS,
  useInterpolatedMarker,
  type InterpolatedMarkerOptions,
} from '../../../src/components/ui/ride/useInterpolatedMarker';
import { VehicleMarker } from '../../../src/components/ui/VehicleMarker';
import { distanceMeters, type LatLng } from '../../../src/components/ui/ride/vehicleMotion';

const mockTheme: AppTheme = LightTheme;
jest.mock('../../../src/app/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: mockTheme, scheme: 'system', setScheme: jest.fn() }),
}));

const M_PER_DEG_LAT = 111_195;
const ORIGIN = { latitude: 31.5, longitude: 74.3 };
const at = (north: number, east = 0): LatLng => ({
  latitude: ORIGIN.latitude + north / M_PER_DEG_LAT,
  longitude: ORIGIN.longitude + east / (M_PER_DEG_LAT * Math.cos((ORIGIN.latitude * Math.PI) / 180)),
});

const FRAME_MS = 16;
const advance = async (ms: number) => {
  for (let left = ms; left > 0; left -= FRAME_MS) {
    await act(async () => {
      jest.advanceTimersByTime(Math.min(FRAME_MS, left));
    });
  }
};

type Props = { coordinate: LatLng; paused?: boolean };

/** Renders the hook and counts the commits (renders after the first). */
const renderMarker = (initial: Props) => {
  let renders = 0;
  const hook = renderHook(
    ({ coordinate, paused }: Props) => {
      renders += 1;
      const options: InterpolatedMarkerOptions = { animate: true, expectedIntervalMs: 4000, paused };
      return useInterpolatedMarker(coordinate, options);
    },
    { initialProps: initial },
  );
  return { ...hook, commits: () => renders };
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  (AppState as { currentState: AppStateStatus }).currentState = 'active';
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useInterpolatedMarker commit rate (T-535)', () => {
  it('commits at most ~30 frames a second while driving, and lands on the target', async () => {
    const marker = renderMarker({ coordinate: at(0) });
    await advance(4000);
    marker.rerender({ coordinate: at(0, 100) });
    const before = marker.commits();
    await advance(1000);
    const perSecond = marker.commits() - before;
    expect(perSecond).toBeLessThanOrEqual(Math.ceil(1000 / MARKER_FRAME_MS) + 1);
    // Still smooth: about 30 steps, not a few jumps.
    expect(perSecond).toBeGreaterThanOrEqual(25);
    await advance(3100);
    expect(distanceMeters(marker.result.current.coordinate, at(0, 100))).toBeLessThan(0.01);
    expect(marker.result.current.rotation).toBeCloseTo(90, 0);
  });

  it('keeps a steady ~30 fps (≤ 30) when 60 Hz frames jitter between 14 and 18 ms', async () => {
    // Pairs of frames add up to 32 ms: a strict 33 ms gate would work only every third frame.
    const gaps = [15, 17, 16, 16, 18, 14];
    let i = 0;
    jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(cb => {
      const gap = gaps[i % gaps.length];
      i += 1;
      return setTimeout(() => cb(Date.now()), gap) as unknown as number;
    });
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(id => clearTimeout(id));
    const marker = renderMarker({ coordinate: at(0) });
    await advance(4000);
    marker.rerender({ coordinate: at(0, 100) });
    await advance(200);
    const before = marker.commits();
    await advance(1000);
    const perSecond = marker.commits() - before;
    expect(perSecond).toBeGreaterThanOrEqual(28);
    expect(perSecond).toBeLessThanOrEqual(Math.ceil(1000 / MARKER_FRAME_MS) + 1);
    await advance(3000);
    expect(distanceMeters(marker.result.current.coordinate, at(0, 100))).toBeLessThan(0.01);
  });

  it('skips frames that move under 0.5 m: a slow crawl commits a few times, not every frame', async () => {
    const marker = renderMarker({ coordinate: at(0) });
    await advance(4000);
    // 4 m in 4 s = 1 m/s: ~0.03 m per 30 fps frame.
    marker.rerender({ coordinate: at(4) });
    const before = marker.commits();
    await advance(4100);
    const commits = marker.commits() - before;
    // ~8 half-metre steps (+ the effect's own render and the last frame), far below 120.
    expect(commits).toBeLessThanOrEqual(12);
    expect(distanceMeters(marker.result.current.coordinate, at(4))).toBeLessThan(0.01);
  });

  it('stops the frame loop while paused and resumes from the clock', async () => {
    const marker = renderMarker({ coordinate: at(0) });
    await advance(4000);
    marker.rerender({ coordinate: at(0, 100) });
    await advance(1000);
    const frames = jest.spyOn(globalThis, 'requestAnimationFrame');
    marker.rerender({ coordinate: at(0, 100), paused: true });
    const shown = marker.result.current.coordinate;
    const before = marker.commits();
    await advance(2000);
    // Nothing scheduled, nothing committed, the marker stays where it was.
    expect(frames).not.toHaveBeenCalled();
    expect(marker.commits()).toBe(before);
    expect(marker.result.current.coordinate).toEqual(shown);
    // Back on screen 3 s into a 4 s move: it continues near 75 % and finishes.
    marker.rerender({ coordinate: at(0, 100), paused: false });
    await advance(40);
    expect(distanceMeters(marker.result.current.coordinate, at(0, 75))).toBeLessThan(3);
    await advance(1100);
    expect(distanceMeters(marker.result.current.coordinate, at(0, 100))).toBeLessThan(0.01);
  });

  it('a position that arrives while paused is placed at once when the move is a jump', async () => {
    const marker = renderMarker({ coordinate: at(0), paused: true });
    marker.rerender({ coordinate: at(800), paused: true });
    expect(distanceMeters(marker.result.current.coordinate, at(800))).toBeLessThan(0.01);
  });
});

type MarkerProps = { coordinate: LatLng; rotation: number };
const markerProps = () => screen.getByTestId('vm').props as MarkerProps;

describe('VehicleMarker pauses off screen (T-535)', () => {
  it('stops animating when the app goes to the background and resumes in the foreground', async () => {
    let onAppState: ((state: AppStateStatus) => void) | null = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      onAppState = handler as (state: AppStateStatus) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    const { rerender } = render(<VehicleMarker testID="vm" coordinate={at(0)} updateIntervalMs={4000} />);
    await advance(4000);
    rerender(<VehicleMarker testID="vm" coordinate={at(0, 100)} updateIntervalMs={4000} />);
    await advance(500);
    await act(async () => {
      onAppState?.('background');
    });
    const shown = markerProps().coordinate;
    await advance(2000);
    expect(markerProps().coordinate).toEqual(shown);
    await act(async () => {
      onAppState?.('active');
    });
    await advance(2000);
    expect(distanceMeters(markerProps().coordinate, at(0, 100))).toBeLessThan(0.01);
  });

  it('stops animating while its screen is blurred', async () => {
    const listeners: Record<string, Array<() => void>> = { focus: [], blur: [] };
    let focused = true;
    const navigation = {
      isFocused: () => focused,
      addListener: (type: 'focus' | 'blur', cb: () => void) => {
        listeners[type].push(cb);
        return () => {
          listeners[type] = listeners[type].filter(fn => fn !== cb);
        };
      },
    } as unknown as React.ContextType<typeof NavigationContext>;
    const ui = (coordinate: LatLng) => (
      <NavigationContext.Provider value={navigation}>
        <VehicleMarker testID="vm" coordinate={coordinate} updateIntervalMs={4000} />
      </NavigationContext.Provider>
    );
    const { rerender } = render(ui(at(0)));
    await advance(4000);
    rerender(ui(at(0, 100)));
    await advance(500);
    await act(async () => {
      focused = false;
      listeners.blur.forEach(fn => fn());
    });
    const shown = markerProps().coordinate;
    await advance(2000);
    expect(markerProps().coordinate).toEqual(shown);
    await act(async () => {
      focused = true;
      listeners.focus.forEach(fn => fn());
    });
    await advance(2000);
    expect(distanceMeters(markerProps().coordinate, at(0, 100))).toBeLessThan(0.01);
  });
});
