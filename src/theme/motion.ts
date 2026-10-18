/**
 * Motion tokens (DESIGN_SYSTEM §6). Durations are in ms.
 *
 * Easings are stored as data, not functions, so this module stays free of Reanimated and
 * can be read anywhere (including tests and non-animated code). Components turn a
 * descriptor into a worklet easing with Reanimated's `Easing`:
 *   `{ kind: 'out', curve: 'quad' }`  -> `Easing.out(Easing.quad)`
 *   `{ kind: 'bezier', x1, y1, x2, y2 }` -> `Easing.bezier(x1, y1, x2, y2)`
 *   `{ kind: 'linear' }`              -> `Easing.linear`
 */
export type EasingToken =
  | { kind: 'linear' }
  | { kind: 'out'; curve: 'quad' | 'cubic' }
  | { kind: 'bezier'; x1: number; y1: number; x2: number; y2: number };

export type TimingToken = { duration: number; easing: EasingToken };

export type SpringToken = { damping: number; stiffness: number; mass: number; overshootClamping: boolean };

const standard: EasingToken = { kind: 'bezier', x1: 0.2, y1: 0, x2: 0, y2: 1 };
const accelerate: EasingToken = { kind: 'bezier', x1: 0.3, y1: 0, x2: 1, y2: 1 };
const linear: EasingToken = { kind: 'linear' };

export const motion = {
  /** Press feedback, toggles. */
  instant: { duration: 100, easing: { kind: 'out', curve: 'quad' } },
  /** Fades, chip select, small reveals. */
  fast: { duration: 150, easing: { kind: 'out', curve: 'cubic' } },
  /** Content changes, card expand, toast in. */
  base: { duration: 250, easing: standard },
  /** Screen transitions, sheet content swaps. */
  slow: { duration: 350, easing: standard },
  /** Dismissals, toast out. */
  exit: { duration: 200, easing: accelerate },
} as const satisfies Record<string, TimingToken>;

export type MotionToken = keyof typeof motion;

/** Springs (§6.1, §6.2). */
export const springs = {
  /** Button release after the 0.98 press scale. */
  press: { damping: 18, stiffness: 300, mass: 1, overshootClamping: false },
  /** Bottom sheet snaps, gesture and programmatic. */
  sheet: { damping: 24, stiffness: 260, mass: 1, overshootClamping: false },
} as const satisfies Record<string, SpringToken>;

/** Pattern-level values from §6 so components share one source. */
export const motionPatterns = {
  pressScale: 0.98,
  listAppear: { duration: 250, easing: standard, translateY: 8, staggerMs: 30, maxStaggered: 8 },
  searchingPulse: {
    duration: 2000,
    easing: { kind: 'out', curve: 'quad' } as EasingToken,
    staggerMs: 666,
    rings: 3,
    scaleFrom: 1,
    scaleTo: 3.2,
    opacityFrom: 0.35,
    opacityTo: 0,
  },
  searchingProgressLoopMs: 1500,
  centerPinLift: { duration: 150, translateY: -8, shadowScale: 0.8 },
  /**
   * §6.7 driver marker. [T-517] `positionMs` is only the fallback: position interpolates over the
   * expected update interval (the gap between the last two updates, clamped to
   * `minPositionMs`..min(`maxPositionMs`, 2 × the expected interval)), linear, so a steadily driving vehicle never stops between
   * updates. Rotation eases to the heading with time constant `rotationMs / 3` (≈ settled in
   * `rotationMs`), always the shortest way round. Moves under `jitterMeters` are ignored; over
   * `teleportMeters` the marker jumps; within `snapMeters` of the route it drives along it.
   */
  driverMarker: {
    positionMs: 1000,
    positionEasing: linear,
    rotationMs: 300,
    minPositionMs: 300,
    maxPositionMs: 8000,
    jitterMeters: 3,
    teleportMeters: 500,
    snapMeters: 30,
  },
  incomingRequestCountdownMs: 15000,
  sheetContentSwap: { duration: 250, translateY: 8 },
  /**
   * [T-573] A modal sheet's destructive button (cancel, no-show) ignores taps for this long after
   * the sheet starts to rise: the `sheet` spring settles in ~0.33 s, and until then a tap aimed at
   * the button that opened it, or at "Keep", can land on the destructive button moving past.
   */
  destructiveArmMs: 350,
  toast: {
    in: { duration: 250, easing: standard, translateY: -16 },
    out: { duration: 200, easing: accelerate, translateY: -8 },
    visibleMs: 3000,
    visibleWithActionMs: 4000,
  },
  skeletonShimmer: { duration: 1200, easing: linear, bandWidthRatio: 0.4 },
  routeDrawOn: { duration: 600, easing: { kind: 'out', curve: 'cubic' } as EasingToken },
} as const;

/** Reduced-motion substitutes (§6, last paragraph). */
export const reducedMotion = {
  pressScale: 1,
  sheetSnap: { duration: 200, easing: standard },
  listAppear: { duration: 150, translateY: 0 },
  searchingHalo: { rings: 2, opacity: 0.2 },
  shimmer: false,
  routeDrawOnMs: 0,
  markerInterpolationMs: 0,
} as const;
