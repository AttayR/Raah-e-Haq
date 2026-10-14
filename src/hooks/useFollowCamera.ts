import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Details, LatLng, Region } from 'react-native-maps';

/**
 * Follow-me camera for a map that shows the user's own moving marker (T-524, QA t-517: the
 * driver's Drive map centred once and then let the car drive off screen). Same pattern as the
 * DriverRide camera: the map follows the point until the user pans or zooms it themselves
 * (Google Maps reports `isGesture`; our own animations are not gestures), and `recentre` (the
 * locate button) centres again and resumes following.
 */

/** 4 decimals ≈ 11 m: the camera follows real moves, not GPS jitter. */
const FOLLOW_DECIMALS = 4;

/** How long a follow step animates (ms). */
export const FOLLOW_ANIMATION_MS = 500;

/** The follow key: the point rounded to ~11 m, or null without a point. */
export const followKeyOf = (point: LatLng | null): string | null =>
  point ? `${point.latitude.toFixed(FOLLOW_DECIMALS)},${point.longitude.toFixed(FOLLOW_DECIMALS)}` : null;

export interface FollowCameraMap {
  animateToRegion: (region: Region, duration?: number) => void;
}

export interface FollowCameraOptions {
  /** The point to keep centred (the user's own position). */
  point: LatLng | null;
  /** False until the native map is ready. */
  ready: boolean;
  /** The region that centres the point (e.g. above a bottom sheet). Read at move time. */
  regionFor: (point: LatLng) => Region;
  /** False pauses following without counting as a pan (e.g. while something else owns the map). */
  enabled?: boolean;
}

export interface FollowCamera {
  /** True while the camera follows the point (no manual pan since the last recentre). */
  following: boolean;
  /** Pass to the map: a pan or zoom by the user stops following. */
  onRegionChangeComplete: (region: Region, details?: Details) => void;
  /** Centre now and follow again (the locate / recentre button). */
  recentre: () => void;
}

export const useFollowCamera = (
  mapRef: RefObject<FollowCameraMap | null>,
  { point, ready, regionFor, enabled = true }: FollowCameraOptions,
): FollowCamera => {
  const [following, setFollowing] = useState(true);
  const [recentreCount, setRecentreCount] = useState(0);
  const latest = useRef({ point, regionFor });
  latest.current = { point, regionFor };

  const key = ready && enabled && following ? followKeyOf(point) : null;

  useEffect(() => {
    const current = latest.current;
    if (key === null || !current.point) return;
    mapRef.current?.animateToRegion(current.regionFor(current.point), FOLLOW_ANIMATION_MS);
  }, [key, recentreCount, mapRef]);

  const onRegionChangeComplete = useCallback((_region: Region, details?: Details) => {
    if (details?.isGesture) setFollowing(false);
  }, []);

  const recentre = useCallback(() => {
    setFollowing(true);
    setRecentreCount((n) => n + 1);
  }, []);

  return { following, onRegionChangeComplete, recentre };
};
