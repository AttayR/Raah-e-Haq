import { radius } from './radii';
import { space } from './spacing';

/**
 * Component-level tokens (DESIGN_SYSTEM v1.1: §3.3 button radius, §5.2 header, §5.3 tab bar,
 * §5.5 IconButton). Components read their fixed dimensions from here so the v1.1 deltas live in
 * one place and the kit gallery can list them.
 */
export const componentTokens = {
  /** §5.4 [v1.1]: every button is a pill. */
  button: {
    radius: radius.pill,
    height: { lg: 56, md: 48, sm: 36 },
    paddingHorizontal: { lg: space[6], md: space[5], sm: space[4] },
    iconSize: { lg: 24, md: 20, sm: 16 },
    iconGap: { lg: space[2], md: space[2], sm: 6 },
  },
  /** §5.2 [v1.1]: one Header, three variants (standard, large, overlay). */
  header: {
    /** Bar height below the top inset (standard and large). */
    barHeight: 56,
    /** Leading back IconButton x, so the glyph's optical edge sits at 16. */
    backButtonStart: space[1],
    /** Standard title start, left-aligned on both platforms. */
    titleStart: 56,
    /** Large title: x = 16, 4 below the bar. */
    largeTitleStart: space[4],
    largeTitleTop: space[1],
    /** Bottom hairline fades in once content scrolls this far. */
    hairlineScrollThreshold: 4,
    /** Overlay variant: floating back/close at x=16, y = insets.top + 8. */
    overlayControlStart: space[4],
    overlayControlTopOffset: space[2],
  },
  /** §5.3 [v1.1]: custom tab bar with an active indicator pill. */
  tabBar: {
    /** Height above the bottom inset. */
    height: 60,
    itemMinWidth: 64,
    iconSize: 24,
    /** Indicator pill: 56x32 when active, animates from 32 wide. */
    indicatorWidth: 56,
    indicatorWidthFrom: 32,
    indicatorHeight: 32,
    indicatorRadius: radius.pill,
    /** Gap between the indicator and the label, and the label's bottom padding. */
    labelGap: space[1],
    bottomPadding: 6,
    /** Badge anchor relative to the indicator's top-end corner. */
    badgeOffsetX: space[1],
    badgeOffsetY: -space[1],
  },
  /** §5.5: 44 target, 40 visual circle; floating (map) is 48 visual with a 28 glyph. */
  iconButton: {
    target: 44,
    visual: 40,
    floatingVisual: 48,
    floatingIconSize: 28,
  },
  /** §5.6 TextField (UI-R2). */
  textField: {
    height: 52,
    searchHeight: 40,
    /** [UI-R2] clear button inside the 40pt search pill: 32 visual + 6 slop = 44 target. */
    searchClearVisual: 32,
    multilineMinHeight: 96,
    multilineMaxLines: 5,
    paddingHorizontal: space[4],
    labelGap: 6,
    helperGap: space[1],
    leadingIconSize: 20,
    helperIconSize: 16,
    /** Trailing slot (clear, show/hide password): a full 44pt target. */
    trailingSlot: 44,
    /** Fixed `+92` prefix block for the phone variant. */
    phonePrefixWidth: 56,
    disabledOpacity: 0.5,
  },
  /** §5.6 OTP variant: 6 boxes, 48×56, 8 gap. */
  otp: { length: 6, boxWidth: 48, boxHeight: 56, gap: space[2] },
  /** §5.10 SegmentedControl. */
  segmented: { segmentMinHeight: 44, trackPadding: space[1], thumbRadius: radius.sm, minimumFontScale: 0.85 },
  /** §5.11 Chip: 32 visual, padding 12, a 16 leading glyph. */
  chip: { height: 32, paddingHorizontal: space[3], iconSize: 16 },
  /** §5.12 Badge. */
  badge: { countMin: 18, countPaddingHorizontal: 6, countCap: 99, dot: 8, dotRing: 2, statusHeight: 24 },
  /** Checkbox / Radio: 24 control, 2pt `borderStrong` boundary (§1.4), row ≥ 44. */
  selectionControl: { size: 24, radioDot: 12, checkRadius: radius.xs, glyph: 16 },
  /** Shared state values. */
  state: { disabledOpacity: 0.4 },
} as const;

export type ComponentTokens = typeof componentTokens;
