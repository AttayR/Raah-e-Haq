/**
 * T-524 (QA t-517): the driver's Drive map follows the driver's own marker after moves (it used
 * to centre once only), stops after a manual pan or zoom, and "locate me" resumes it.
 */
import { act, renderHook } from '@testing-library/react-native';
import type { LatLng, Region } from 'react-native-maps';
import { FOLLOW_ANIMATION_MS, followKeyOf, useFollowCamera } from '../../src/hooks/useFollowCamera';

const A = { latitude: 31.5204, longitude: 74.3587 };
const regionFor = (p: LatLng): Region => ({ ...p, latitudeDelta: 0.01, longitudeDelta: 0.01 });

const setup = (initial: { point: LatLng | null; ready: boolean }) => {
  const map = { animateToRegion: jest.fn() };
  const ref = { current: map };
  const hook = renderHook((props: { point: LatLng | null; ready: boolean }) => useFollowCamera(ref, { ...props, regionFor }), {
    initialProps: initial,
  });
  return { map, ...hook };
};

describe('followKeyOf', () => {
  it('ignores GPS jitter (~1 m) and changes with a real move (~20 m)', () => {
    expect(followKeyOf({ latitude: A.latitude + 0.00001, longitude: A.longitude })).toBe(followKeyOf(A));
    expect(followKeyOf({ latitude: A.latitude + 0.0002, longitude: A.longitude })).not.toBe(followKeyOf(A));
    expect(followKeyOf(null)).toBeNull();
  });
});

describe('useFollowCamera', () => {
  it('centres once the map is ready, then follows each move', () => {
    const { map, rerender } = setup({ point: A, ready: false });
    expect(map.animateToRegion).not.toHaveBeenCalled();
    rerender({ point: A, ready: true });
    expect(map.animateToRegion).toHaveBeenLastCalledWith(regionFor(A), FOLLOW_ANIMATION_MS);
    const moved = { latitude: A.latitude + 0.001, longitude: A.longitude };
    rerender({ point: moved, ready: true });
    expect(map.animateToRegion).toHaveBeenCalledTimes(2);
    expect(map.animateToRegion).toHaveBeenLastCalledWith(regionFor(moved), FOLLOW_ANIMATION_MS);
    // Jitter does not move the camera.
    rerender({ point: { latitude: moved.latitude + 0.00001, longitude: moved.longitude }, ready: true });
    expect(map.animateToRegion).toHaveBeenCalledTimes(2);
  });

  it('a manual pan stops following until recentre; our own animations do not', () => {
    const { map, result, rerender } = setup({ point: A, ready: true });
    act(() => result.current.onRegionChangeComplete(regionFor(A), { isGesture: false }));
    expect(result.current.following).toBe(true);

    act(() => result.current.onRegionChangeComplete(regionFor(A), { isGesture: true }));
    expect(result.current.following).toBe(false);
    rerender({ point: { latitude: A.latitude + 0.002, longitude: A.longitude }, ready: true });
    expect(map.animateToRegion).toHaveBeenCalledTimes(1);

    act(() => result.current.recentre());
    expect(result.current.following).toBe(true);
    expect(map.animateToRegion).toHaveBeenCalledTimes(2);
    // Recentre again without a move still centres (the locate button always works).
    act(() => result.current.recentre());
    expect(map.animateToRegion).toHaveBeenCalledTimes(3);
  });

  it('does nothing without a position', () => {
    const { map } = setup({ point: null, ready: true });
    expect(map.animateToRegion).not.toHaveBeenCalled();
  });
});
