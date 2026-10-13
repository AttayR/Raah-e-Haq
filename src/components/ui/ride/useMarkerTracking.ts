import { useEffect, useState } from 'react';

/** How long a marker re-renders its custom view before it is frozen (icon fonts load first). */
export const MARKER_SETTLE_MS = 1000;

/**
 * `tracksViewChanges` for a custom marker view. Google Maps on iOS snapshots marker views, so a
 * view is tracked briefly after mount and whenever `lookKey` changes (theme, label, muted state)
 * and then frozen for performance. `always` keeps tracking (animated markers such as the pulse).
 */
export function useMarkerTracking(lookKey: string, always = false): boolean {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    setTracks(true);
    if (always) {
      return;
    }
    const timer = setTimeout(() => setTracks(false), MARKER_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [always, lookKey]);
  return tracks;
}
