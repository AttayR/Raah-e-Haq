/**
 * T-586 part 2 (map-vehicles.md §2.2, §2.4, D7): the assigned vehicle fades in when it appears,
 * and a move over 500 m, faster than 40 m/s, or the first after a long pause relocates with a
 * crossfade (out 150 ms at the old point, in 250 ms at the new one) instead of a hard jump.
 * Reduced motion and off-screen placement stay instant.
 */
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { isImplausibleMove, useInterpolatedMarker } from '../../../src/components/ui/ride/useInterpolatedMarker';
import { distanceMeters, type LatLng } from '../../../src/components/ui/ride/vehicleMotion';

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

type Props = { coordinate: LatLng; paused?: boolean; animate?: boolean };
const renderMarker = (initial: Props) =>
  renderHook(({ coordinate, paused, animate = true }: Props) => useInterpolatedMarker(coordinate, { animate, expectedIntervalMs: 4000, paused }), {
    initialProps: initial,
  });

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  (AppState as { currentState: AppStateStatus }).currentState = 'active';
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('assigned marker appear and relocation (D7)', () => {
  it('appears with a 250 ms fade in', async () => {
    const m = renderMarker({ coordinate: at(0) });
    expect(m.result.current.opacity).toBeLessThan(0.1);
    await advance(100);
    const mid = m.result.current.opacity;
    expect(mid).toBeGreaterThan(0.1);
    expect(mid).toBeLessThan(1);
    await advance(250);
    expect(m.result.current.opacity).toBe(1);
  });

  it('crossfades a move over 500 m: fades out at the old point, then fades in at the new one', async () => {
    const m = renderMarker({ coordinate: at(0) });
    await advance(4000);
    m.rerender({ coordinate: at(800) });
    await advance(80);
    // Still at the old point, fading out; never sliding across blocks.
    expect(distanceMeters(m.result.current.coordinate, at(0))).toBeLessThan(0.01);
    expect(m.result.current.opacity).toBeLessThan(1);
    await advance(120);
    expect(distanceMeters(m.result.current.coordinate, at(800))).toBeLessThan(0.01);
    expect(m.result.current.opacity).toBeLessThan(1);
    await advance(300);
    expect(m.result.current.opacity).toBe(1);
    expect(distanceMeters(m.result.current.coordinate, at(800))).toBeLessThan(0.01);
  });

  it('crossfades an implausibly fast move (over 40 m/s) under 500 m', async () => {
    expect(isImplausibleMove(at(0), at(400), 4000)).toBe(true); // 100 m/s
    expect(isImplausibleMove(at(0), at(100), 4000)).toBe(false); // 25 m/s
    expect(isImplausibleMove(at(0), at(400), null)).toBe(false);
    expect(isImplausibleMove(at(0), at(600), null)).toBe(true);
    const m = renderMarker({ coordinate: at(0) });
    await advance(4000);
    m.rerender({ coordinate: at(400) });
    await advance(200);
    // Placed at the new point within the fade, not half-way along a slide.
    expect(distanceMeters(m.result.current.coordinate, at(400))).toBeLessThan(0.01);
    await advance(300);
    expect(m.result.current.opacity).toBe(1);
  });

  it('the first move after a pause over 30 s crossfades instead of a long slide', async () => {
    const m = renderMarker({ coordinate: at(0) });
    await advance(400);
    m.rerender({ coordinate: at(0), paused: true });
    await advance(31_000);
    m.rerender({ coordinate: at(0), paused: false });
    m.rerender({ coordinate: at(300) });
    await advance(200);
    expect(distanceMeters(m.result.current.coordinate, at(300))).toBeLessThan(0.01);
    await advance(300);
    expect(m.result.current.opacity).toBe(1);
  });

  it('a normal drive keeps full opacity and slides', async () => {
    const m = renderMarker({ coordinate: at(0) });
    await advance(4000);
    m.rerender({ coordinate: at(0, 100) });
    await advance(2000);
    expect(m.result.current.opacity).toBe(1);
    expect(distanceMeters(m.result.current.coordinate, at(0, 50))).toBeLessThan(3);
  });

  it('reduced motion (animate off) and off screen: placed at once, fully visible', async () => {
    const reduced = renderMarker({ coordinate: at(0), animate: false });
    expect(reduced.result.current.opacity).toBe(1);
    reduced.rerender({ coordinate: at(800), animate: false });
    expect(distanceMeters(reduced.result.current.coordinate, at(800))).toBeLessThan(0.01);
    expect(reduced.result.current.opacity).toBe(1);
    const hidden = renderMarker({ coordinate: at(0), paused: true });
    expect(hidden.result.current.opacity).toBe(1);
    hidden.rerender({ coordinate: at(800), paused: true });
    expect(distanceMeters(hidden.result.current.coordinate, at(800))).toBeLessThan(0.01);
    expect(hidden.result.current.opacity).toBe(1);
  });
});
