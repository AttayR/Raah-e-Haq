import { useCallback, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import type { Details, Region } from 'react-native-maps';
import { overlapSpreadMetersFor } from './selection';

/** A zoom change smaller than this (relative) keeps the spread, so a pan never re-renders the markers. */
const SPREAD_CHANGE_RATIO = 0.1;

/**
 * The overlap spread of stacked nearby vehicles, ~30 pt at the current zoom (T-586 design review).
 * Used inside the map component, so a zoom change re-renders only the map, not the screen. The
 * returned handlers are stable (PERF-12); `onRegionChangeComplete` forwards to the caller's first.
 */
export const useOverlapSpread = (onRegionChangeComplete: (region: Region, details?: Details) => void) => {
  const [latitudeDelta, setLatitudeDelta] = useState<number | null>(null);
  const [mapHeight, setMapHeight] = useState(0);
  const forward = useRef(onRegionChangeComplete);
  forward.current = onRegionChangeComplete;

  const onRegion = useCallback((region: Region, details?: Details) => {
    forward.current(region, details);
    const next = region.latitudeDelta;
    if (!(next > 0)) return;
    setLatitudeDelta(prev => (prev !== null && Math.abs(next - prev) / prev < SPREAD_CHANGE_RATIO ? prev : next));
  }, []);
  const onLayout = useCallback((e: LayoutChangeEvent) => setMapHeight(e.nativeEvent.layout.height), []);

  return { spreadMeters: overlapSpreadMetersFor(latitudeDelta, mapHeight), onRegionChangeComplete: onRegion, onLayout };
};
