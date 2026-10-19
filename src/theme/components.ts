import { extra, navy, saffron } from './palette';
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
  /** iOS "Done" bar above a number pad / multiline keyboard (T-509, kit in T-545). */
  keyboardDoneBar: { buttonHeight: 32 },
  /** §5.10 SegmentedControl. */
  segmented: { segmentMinHeight: 44, trackPadding: space[1], thumbRadius: radius.sm, minimumFontScale: 0.85 },
  /** §5.11 Chip: 32 visual, padding 12, a 16 leading glyph. */
  chip: { height: 32, paddingHorizontal: space[3], iconSize: 16 },
  /** §5.12 Badge. */
  badge: { countMin: 18, countPaddingHorizontal: 6, countCap: 99, dot: 8, dotRing: 2, statusHeight: 24 },
  /** Checkbox / Radio: 24 control, 2pt `borderStrong` boundary (§1.4), row ≥ 44. */
  selectionControl: { size: 24, radioDot: 12, checkRadius: radius.xs, glyph: 16 },
  /** §5.9 Switch: kit-drawn 51×31 track, 27 thumb inset 2, in a 64-wide (×44) slot. */
  switch: { trackWidth: 51, trackHeight: 31, thumb: 27, inset: 2, slotWidth: 64 },
  /** Shared state values. */
  state: { disabledOpacity: 0.4 },
  /** §5.8 ListItem (UI-R3): row heights, leading sizes and divider insets. */
  listItem: {
    minHeight: { one: 56, two: 72 },
    tile: 40,
    tileIconSize: 24,
    /** Divider inset to the text start: 16 + 24 + 16 (plain icon), 16 + 40 + 16 (tile/avatar). */
    dividerInset: { none: space[4], icon: 56, tile: 72 },
  },
  /** §5.14 BottomSheet (UI-R3). */
  sheet: {
    radius: radius.xl,
    handleWidth: 36,
    handleHeight: 5,
    handleTop: space[2],
    /** Content starts 24 from the sheet top (handle area included). */
    contentTop: space[6],
    /** `half` = 50% of the container; `full` = container − top inset − 8. */
    halfRatio: 0.5,
    fullTopGap: space[2],
    /** iPhone SE and other short screens: the sheet never exceeds 88% (§3.2). */
    smallScreenMaxRatio: 0.88,
    smallScreenHeight: 700,
    /** A release this far past the lowest snap (or this fast downward) closes a modal sheet. */
    closeDistance: 80,
    closeVelocity: 1200,
    /** Fraction of the release velocity added when picking the nearest snap. */
    velocityProjection: 0.15,
    footerTopPadding: space[4],
  },
  /** §5.15 Dialog. */
  dialog: { maxWidth: 340, sideMargin: space[6], padding: space[6] },
  /** §5.16 Toast. */
  toast: { minHeight: 48, iconSize: 20, swipeDismissDistance: 20 },
  /** §5.19 / §5.20 EmptyState and ErrorState. */
  emptyState: {
    maxWidth: 280,
    circle: 96,
    glyph: 48,
    illustration: 120,
    topOffset: space[16],
    /** UI-R9: compact ErrorState for a section inside a sheet (48 circle, 24 glyph). */
    compactCircle: 48,
    compactGlyph: 24,
  },
  /** §5.18 Skeleton. */
  skeleton: {
    /** Text block height = line height − 6. */
    textInset: 6,
    /**
     * Placeholder heights that mirror real blocks at rest (1.0x font) so nothing jumps when data
     * arrives: wallet BalanceCard, EarningsHero, ride details cards, transaction detail card.
     */
    heights: { walletHero: 152, earningsHero: 132, rideHistoryRow: 114, activitySummary: 54, rideSummary: 120, rideRoute: 136, rideReceipt: 168, detailCard: 168 },
  },
  /** UI-R5 ride components (§5.21–5.31, §6.5/§6.7, §12.5). */
  ride: {
    /** §5.21 map pins: 20 pickup circle / drop-off square with a 4pt ring, 22 numbered stop. */
    pin: { size: 20, ring: 4, dropoffRadius: 4, dropoffInner: 6, stopSize: 22, stopRing: 2, labelGap: space[1], labelMaxWidth: 200 },
    /** §5.21 route: 5pt line over a 7pt casing. */
    route: { width: 5, casingWidth: 7 },
    /** §5.21 car marker: 40 badge, 2pt ring; nearby (muted) drivers at 60%. */
    carMarker: { size: 40, glyph: 24, ring: 2, mutedOpacity: 0.6 },
    /**
     * [T-586] Top-down vehicle marker (map-vehicles.md §1.2, §1.6): react-native-svg art on a 56-unit
     * viewBox (48-unit drawing grid + 4 margin), pivot at the centre. Nearby vehicles 40pt at full
     * opacity (stale 0.5); the assigned vehicle 48pt inside a 64pt view with a 56pt halo.
     * Shadow and halo opacities per map style.
     */
    vehicleMarker: {
      viewBox: 56,
      gridInset: 4,
      nearbySize: 40,
      assignedSize: 48,
      haloSize: 56,
      assignedViewSize: 64,
      nearbyOpacity: 1,
      staleOpacity: 0.5,
      /** Appear: scale 0.85 → 1 (§2.5). */
      appearScaleFrom: 0.85,
      haloRingWidth: 1,
      shadowOuterWidth: 7,
      shadowInnerWidth: 5,
      casingWidth: 4,
      shadowOuterOpacity: { light: 0.08, dark: 0.24 },
      shadowInnerOpacity: { light: 0.16, dark: 0.4 },
      haloFillOpacity: { light: 0.14, dark: 0.2 },
      haloRingOpacity: { light: 0.32, dark: 0.45 },
      zIndex: { nearby: 0, assigned: 4 },
    },
    /** [T-586] map count chip (map-vehicles.md §4): 32 min pill, 8 dot, 16 spinner. */
    nearbyChip: { minHeight: 32, dot: 8, spinner: 16, paddingHorizontal: space[3], gap: space[2] },
    /**
     * [T-587] reach strip on Finding a driver (passenger-finding-driver.md block 3a): 40 min,
     * 8/12 padding, 20 icon, 6 viewing dot. Numbers: old out 100, new in 150 with a 4 pt rise;
     * the dot breathes 1 → 0.4 → 1 over 2000 ms while someone is viewing.
     */
    reachStrip: {
      minHeight: 40,
      paddingVertical: space[2],
      paddingHorizontal: space[3],
      icon: 20,
      gap: space[2],
      dot: 6,
      dotGap: space[1],
      numberOutMs: 100,
      numberInMs: 150,
      numberRise: 4,
      breatheMs: 2000,
      breatheMinOpacity: 0.4,
    },
    /** §6.5 searching pulse: rings start at the pickup pin size; 2pt progress bar. */
    // [UI-R10] reduced motion: the bar is a static `primary` segment 30 % wide at the start.
    pulse: { ring: 20, progressHeight: 2, progressBandRatio: 0.35, reducedBandRatio: 0.3 },
    /** §5.23 address pair: 20pt rail, 10pt pickup/drop-off glyphs, 8pt stops, 2/3 dotted line. */
    addressPair: {
      railWidth: 20,
      pickup: 10,
      dropoff: 10,
      dropoffRadius: 2,
      stop: 8,
      dot: 2,
      dotGap: 3,
      rowMinHeight: { regular: 48, compact: 32 },
    },
    /** §5.25 vehicle option card. */
    vehicle: {
      minHeight: 72,
      tile: 56,
      tileRadius: radius.lg,
      glyph: 32,
      paddingVertical: space[2],
      paddingHorizontal: space[4],
      listGap: space[2],
      unavailableOpacity: 0.4,
      skeletonCount: 3,
    },
    /** §5.26 fare breakdown rows. */
    fare: { rowMinHeight: 32 },
    /** §5.27/§5.28/§12.5 person card. */
    person: { avatar: 56, plateHeight: 28, plateLetterSpacing: 0.5, actionHeight: 56, actionIcon: 24, actionGap: space[2] },
    /** UI-R15 ride details: the non-interactive static map at the top of the receipt. */
    /** `edgeTop` keeps the pins below the top edge (and the city label Google draws there). */
    staticMap: { height: 180, minDelta: 0.01, padding: 2.2, edgeTop: space[8], edge: space[4] },
    /** §5.24 progress: 4pt track, 4 segments 4 apart. */
    progress: { track: 4, segmentGap: space[1], timelineDot: 10 },
    /** §5.22 rating stars. */
    rating: { input: 40, inputGap: space[2], inputTarget: 48, display: 16, displayGap: 2 },
    /** §5.31 slide-to-confirm. */
    slide: {
      height: 64,
      knob: 56,
      inset: 4,
      glyph: 28,
      completeAt: 0.85,
      /** [UI-R5] After a confirm, the knob goes home if the screen has not switched to `loading` by then. */
      resetAfterMs: 600,
    },
  },
  /** §9 [v1.1] map floating controls: at most two, locate rides 16 above the sheet. */
  mapControls: { sheetGap: space[4], edge: space[4] },
  /** UI-R14 chat thread, Messages rows and notification rows (shared-chat-thread, shared-chat-list). */
  chat: {
    bubbleRadius: 18,
    bubbleTailRadius: 6,
    bubbleMaxWidth: '75%',
    /** Gap between bubbles of one run, and before a new run. */
    runGap: space[1],
    runBreak: space[4],
    pendingOpacity: 0.6,
    noteRadius: radius.md,
    dayPillHeight: 24,
    composerMinHeight: 40,
    composerRadius: 20,
    /** Text lines the composer grows to before it scrolls. */
    composerMaxLines: 5,
    sendButton: 40,
    /** The "{n}/1000" counter appears from this many characters. */
    counterFrom: 900,
    closedBarHeight: 56,
    /** Loading placeholder bubble (one line of body + padding). */
    skeletonBubbleHeight: 48,
    /** Header avatar, Messages row avatar. */
    headerAvatar: 32,
    rowAvatar: 48,
    /** Read receipt / failure glyphs under a bubble, and the safety note glyph. */
    metaIconSize: 16,
    sendIconSize: 20,
    closedIconSize: 20,
  },
  /** T-520 safety: the SOS sheet's round badge and the passenger's PIN digit tiles. */
  safety: { sheetBadge: 56, sheetBadgeGlyph: 28, pinDigitWidth: 36, pinDigitHeight: 48 },
  /**
   * UI-R7 (auth-registration): photo upload tile. Wide 120 (104 on small phones), dashed 1.5pt
   * `borderStrong` while empty; square tiles for a set of sides (vehicle photos); a floating 32
   * replace button 8 in from the top end once filled.
   */
  uploadTile: {
    height: 120,
    compactHeight: 104,
    squareMin: 96,
    border: 1.5,
    glyph: 28,
    squareGlyph: 24,
    action: 32,
    actionInset: space[2],
    thumb: 64,
  },
  /** UI-R7 registration wizard: segmented step progress (one 4pt segment per step) and choice cards. */
  wizard: {
    progressHeight: 4,
    progressGap: space[1],
    choiceMinHeight: 88,
    compactChoiceMinHeight: 76,
    choiceIconTile: 48,
    /** Window heights below this (iPhone SE: 667) use the compact choice cards and upload tiles. */
    compactWindowHeight: 700,
  },
  /**
   * UI-R6 auth (spec auth-login, auth-phone-otp): the logo badge (72, 56 on small phones; §4) on a
   * white circle in both themes (the artwork needs a light ground) and the space above it.
   */
  auth: {
    logoBadge: 72,
    logoBadgeCompact: 56,
    logo: 48,
    logoCompact: 36,
    topSpace: space[8],
    topSpaceCompact: space[4],
    /** Window heights below this (iPhone SE: 667) use the compact badge and an `h2` title. */
    compactWindowHeight: 700,
    /** Reserved height of the success glyph circle in the forgot-password sheet. */
    sentGlyph: 64,
  },
  /**
   * UI-R8 duotone illustration (§4: account status, permission prompts): a 128 `primarySoft`
   * disc with a 64 `onPrimarySoft` glyph inside a 160 box, plus an optional 48 saffron badge on the
   * bottom-end of the disc.
   */
  illustration: { textMaxWidth: 320, box: 160, disc: 128, glyph: 64, badge: 48, badgeGlyph: 28, badgeRing: 3, compactBox: 120, compactDisc: 96, compactGlyph: 48, compactBadge: 36, compactBadgeGlyph: 20, compactBadgeRing: 2 },
  /**
   * UI-R20 service tile (passenger-home § Services S2): 44 icon disc (28 glyph), 12 from the outer
   * edge to the content, 12 from the disc to the title, 12 between tiles in a row; 96 high at 1.0×.
   */
  serviceTile: { disc: 44, padding: space[3], gap: space[3], rowGap: space[3], height: 96 },
  /** UI-R8 denied state on the driver Drive sheet (shared-permissions): icon circle and glyph. */
  locationNeeded: { circle: 64, glyph: 32 },
  /**
   * UI-R8 splash (auth-splash). The colours are fixed in both modes (a brand moment) and must stay
   * in step with the native launch screens: ios SplashBackground.colorset + LaunchScreen.storyboard,
   * android res/values/colors.xml + drawable/splash_background.xml + drawable/splash_icon.xml
   * (__tests__/components/SplashScreen.test.tsx checks them).
   */
  splash: {
    background: navy[950],
    badgeFill: extra.white,
    wordmark: extra.white,
    badge: 96,
    logo: 64,
    /** Gap between the badge and the wordmark. */
    wordmarkGap: space[4],
    /** The progress bar shows only when bootstrap takes longer than this. */
    progressDelayMs: 800,
    progressFadeMs: 150,
    progressWidth: 120,
    progressHeight: 2,
    /** Width of the moving segment of the indeterminate bar. */
    progressSegment: 40,
    progressCycleMs: 1100,
    progressTrack: 'rgba(255,255,255,0.16)',
    progressBar: saffron[500],
    /** Bar bottom = insets.bottom + this. */
    progressBottom: space[8],
  },
} as const;

export type ComponentTokens = typeof componentTokens;
