import { useEffect, useState } from 'react';
import { motionPatterns } from '../../theme';
import type { NearbyDriversState } from '../../hooks/useNearbyDrivers';
import type { NearbyFreshness } from './nearbyMotion';

const N = motionPatterns.nearbyMarker;

/**
 * §2.4: how old the shown nearby list is. `stale` after 2 failed polls in a row or 30 s without a
 * successful read (markers dim to 0.5), `gone` after 90 s (markers fade out, the chip shows its
 * error). Pure, for tests.
 */
export const nearbyFreshness = (freshAt: number | null | undefined, failures: number | undefined, now: number): NearbyFreshness => {
  if (freshAt === null || freshAt === undefined) return 'fresh';
  const age = now - freshAt;
  if (age >= N.goneAfterMs) return 'gone';
  if (age >= N.staleAfterMs || (failures ?? 0) >= N.staleAfterFailures) return 'stale';
  return 'fresh';
};

/** The next age (ms from now) at which the level can change, or null when nothing is pending. */
const nextChangeIn = (freshAt: number | null | undefined, now: number): number | null => {
  if (freshAt === null || freshAt === undefined) return null;
  const age = now - freshAt;
  if (age < N.staleAfterMs) return N.staleAfterMs - age;
  if (age < N.goneAfterMs) return N.goneAfterMs - age;
  return null;
};

/**
 * The freshness of a useNearbyDrivers state, re-evaluated by one timer at the next threshold
 * (no polling), cleared on change and unmount.
 */
export const useNearbyFreshness = (state: Pick<NearbyDriversState, 'freshAt' | 'failures'>): NearbyFreshness => {
  const { freshAt, failures } = state;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const wait = nextChangeIn(freshAt, Date.now());
    if (wait === null) return undefined;
    const timer = setTimeout(() => setTick(n => n + 1), wait + 1);
    return () => clearTimeout(timer);
  }, [freshAt, tick]);
  return nearbyFreshness(freshAt, failures, Date.now());
};
