/**
 * Passenger Home sheet arithmetic (UI-R20b, passenger-home § Services v2 V1). Pure numbers from
 * tokens, no React: unit tested in `__tests__/features/passengerHome/homeFirstViewUIR20b.test.tsx`.
 *
 * peek = handle area (24) + the measured header + the measured peek group.
 * - Header (pinned at `full`): greeting (22) + tagline (20) + 12 + "Where to?" (56) + 12 = 122;
 *   compact height (no tagline) 102; live ride (greeting + 12; "Return" moves to the body) 34.
 * - Peek group (top of the body): chips (32) + 12 = 44, plus the service row (72) + 12 while it
 *   shows = 128; live: "Return" (56) + 8 + status (20) + 12 + chips + 12 = 140.
 * iPhone 17: 274 with the cards, 190 without; SE: 254 / 170; live 198.
 */
import { componentTokens, space, textStyles } from '../../theme';

/** Header kinds: with the tagline (or the offline line), greeting only (compact height), live ride. */
export type HomeHeaderKind = 'tagline' | 'compact' | 'live';

/** "Where to?" hero height (V4). */
export const WHERE_TO_HEIGHT = componentTokens.home.whereToHeight;

/** The live ride block in the body: "Return to your ride" + 8 + its status line + 12. */
export const HOME_LIVE_BLOCK = componentTokens.button.height.lg + space[2] + textStyles.bodySmall.lineHeight + space[3];

/** The chip row and its 12 gap (V1 block 4). */
export const HOME_CHIPS_BLOCK = componentTokens.chip.height + space[3];

/** The service row and its 12 gap at 1.0× text (V1 block 5). */
export const HOME_SERVICE_ROW_ESTIMATE = componentTokens.serviceCard.minHeight + space[3];

/** First-frame header heights at 1.0× text, used until the header has been measured. */
export const HOME_HEADER_ESTIMATE: Record<HomeHeaderKind, number> = {
  tagline: textStyles.title.lineHeight + textStyles.bodySmall.lineHeight + space[3] + WHERE_TO_HEIGHT + space[3],
  compact: textStyles.title.lineHeight + space[3] + WHERE_TO_HEIGHT + space[3],
  live: textStyles.title.lineHeight + space[3],
};

/** First-frame peek group heights: with the service row, without it, and with a live ride. */
export const HOME_PEEK_GROUP_ESTIMATE = {
  services: HOME_CHIPS_BLOCK + HOME_SERVICE_ROW_ESTIMATE,
  plain: HOME_CHIPS_BLOCK,
  live: HOME_LIVE_BLOCK + HOME_CHIPS_BLOCK,
} as const;

/** `half` is at least peek + 180 (the compact rides ErrorState fits at `half` on iPhone SE). */
export const HOME_HALF_EXTRA = 180;

/** V1 formula: handle area + measured header + measured peek group. */
export const homePeekHeight = ({ headerHeight, peekGroupHeight }: { headerHeight: number; peekGroupHeight: number }): number =>
  Math.round(componentTokens.sheet.contentTop + headerHeight + peekGroupHeight);

/** `half` floor for the Home sheet: peek + 180 (the kit caps it at `full`). */
export const homeHalfMinHeight = (peek: number): number => peek + HOME_HALF_EXTRA;

/** Compact height (iPhone SE, window < 700): the tagline is hidden. */
export const isCompactHeight = (windowHeight: number): boolean => windowHeight < componentTokens.home.compactWindowHeight;

/**
 * The tagline slot (V3), first match wins: a live ride shows nothing; offline shows the offline
 * line (even on a compact screen); a compact screen shows nothing; otherwise the tagline.
 */
export type TaglineSlot = 'none' | 'offline' | 'tagline';
export const taglineSlot = ({ live, offline, compact }: { live: boolean; offline: boolean; compact: boolean }): TaglineSlot =>
  live ? 'none' : offline ? 'offline' : compact ? 'none' : 'tagline';

/** The header kind for a slot (the measured height is kept per kind). */
export const headerKindFor = (live: boolean, slot: TaglineSlot): HomeHeaderKind => (live ? 'live' : slot === 'none' ? 'compact' : 'tagline');
