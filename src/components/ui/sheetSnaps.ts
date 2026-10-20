import { componentTokens } from '../../theme';

/**
 * Snap points of a BottomSheet (DESIGN_SYSTEM §5.14, §8.3):
 * - `peek`: content-defined collapsed height (`peekHeight`, e.g. 170 passenger Home, 201 Drive).
 * - `content`: the sheet's natural height (handle + header + body + footer), for pickers,
 *   confirmations and the incoming request; capped at `full`.
 * - `half`: 50% of the container (the window on a full-screen map), or `halfMinHeight` when that
 *   is taller (UI-R20: passenger Home keeps its compact rides error visible at `half` on SE).
 * - `full`: container − top inset − 8; never more than 88% on short screens (iPhone SE).
 */
export type SheetSnap = 'peek' | 'half' | 'full' | 'content';

export type SnapInput = {
  containerHeight: number;
  topInset: number;
  peekHeight?: number;
  contentHeight?: number;
  /** [UI-R20] `half` is never lower than this (still capped at `full`). */
  halfMinHeight?: number;
  /**
   * [UI-R3] Floor for every snap: handle area 24 + header + sticky footer block, so the footer is
   * never drawn over the header (a `peek` below it resolves to it).
   */
  minHeight?: number;
};

const s = componentTokens.sheet;

/** Highest height a sheet may take in this container. */
export const fullHeight = ({ containerHeight, topInset }: Pick<SnapInput, 'containerHeight' | 'topInset'>): number => {
  const full = containerHeight - topInset - s.fullTopGap;
  return containerHeight < s.smallScreenHeight ? Math.min(full, containerHeight * s.smallScreenMaxRatio) : full;
};

/** Height in points of one snap point; `null` while it cannot be known yet (content unmeasured). */
export const snapHeight = (snap: SheetSnap, input: SnapInput): number | null => {
  const max = fullHeight(input);
  switch (snap) {
    case 'full':
      return max;
    case 'half':
      return Math.min(Math.max(input.containerHeight * s.halfRatio, input.halfMinHeight ?? 0), max);
    case 'peek':
      return input.peekHeight !== undefined ? Math.min(input.peekHeight, max) : snapHeight('content', input);
    case 'content':
      return input.contentHeight !== undefined && input.contentHeight > 0 ? Math.min(input.contentHeight, max) : null;
  }
};

export type ResolvedSnap = { snap: SheetSnap; height: number };

/** True when both lists name the same snaps at the same heights. */
export const sameSnaps = (a: readonly ResolvedSnap[], b: readonly ResolvedSnap[]): boolean =>
  a.length === b.length && a.every((r, i) => r.snap === b[i].snap && r.height === b[i].height);

/** The requested snap points as heights, lowest first, without duplicates or unknowns. */
export const resolveSnaps = (snaps: readonly SheetSnap[], input: SnapInput): ResolvedSnap[] => {
  const resolved: ResolvedSnap[] = [];
  const max = fullHeight(input);
  const floor = Math.min(input.minHeight ?? 0, max);
  snaps.forEach(snap => {
    const raw = snapHeight(snap, input);
    const height = raw === null ? null : Math.max(raw, floor);
    if (height !== null && !resolved.some(r => Math.abs(r.height - height) < 1)) {
      resolved.push({ snap, height });
    }
  });
  return resolved.sort((a, b) => a.height - b.height);
};

/**
 * Where a drag released at `height` (points visible) with `velocityY` (points/s, positive = down)
 * settles: the snap nearest to the projected height. For a modal sheet, `close` when it was pulled
 * well below its lowest snap or flicked down past it.
 */
export const releaseTarget = (
  height: number,
  velocityY: number,
  snaps: readonly ResolvedSnap[],
  closable: boolean,
): ResolvedSnap | 'close' => {
  'worklet';
  const projected = height - velocityY * s.velocityProjection;
  const lowest = snaps[0];
  if (closable && lowest) {
    const pulledFar = height < lowest.height - s.closeDistance;
    const flicked = velocityY > s.closeVelocity && projected < lowest.height;
    if (pulledFar || flicked) {
      return 'close';
    }
  }
  let best = snaps[0];
  snaps.forEach(candidate => {
    if (Math.abs(candidate.height - projected) < Math.abs(best.height - projected)) {
      best = candidate;
    }
  });
  return best;
};

/**
 * [UI-R12] Where an opening sheet starts (points from the container top): the bottom edge, or
 * `openFrom` points up when it takes over from another sheet of that height (clamped to the
 * container). It then springs to its snap from there.
 */
export const openingTop = (containerHeight: number, openFrom?: number | null): number =>
  containerHeight - Math.max(0, Math.min(openFrom ?? 0, containerHeight));
