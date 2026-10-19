/**
 * Copy of the map count chip (T-586, map-vehicles.md §4), in the active language, read at render.
 * Pure: unit tested in `__tests__/features/nearbyVehicles/chipText.test.ts`.
 */
import { t } from '../../i18n';
import { isVehicleTypeKey } from '../../services/rideService';
import type { NearbyDriversStatus } from '../../hooks/useNearbyDrivers';
import type { NearbyChipCounts } from './selection';

export type NearbyChipDot = 'available' | 'none' | 'loading' | 'error';

export interface NearbyChipContent {
  /** The main text (always shown). */
  primary: string;
  /** "{online} online" on Choose ride; dropped first when the chip is too narrow. */
  secondary: string | null;
  dot: NearbyChipDot;
  /** What changed category (for announcements): not the numbers. */
  category: string;
}

/** `one` (1 car), `other` (7 cars) and `none` (No cars / koi gaari: plural in English, singular in Urdu). */
const tierNouns = (tier: string): { one: string; other: string; none: string } =>
  isVehicleTypeKey(tier)
    ? { one: t(`nearbyMap.tiers.${tier}.one`), other: t(`nearbyMap.tiers.${tier}.other`), none: t(`nearbyMap.tiers.${tier}.none`) }
    : { one: tier, other: tier, none: tier };

/**
 * `tier` null is Home (online drivers near you); a tier is Choose ride (that tier nearby, and the
 * total online). `failed`: the first read failed, or the shown list is 90 s old (§2.4).
 */
export const nearbyChipContent = (input: {
  status: NearbyDriversStatus;
  failed: boolean;
  tier: string | null | undefined;
  counts: NearbyChipCounts;
}): NearbyChipContent | null => {
  const { status, failed, tier, counts } = input;
  if (failed) return { primary: t('nearbyMap.failed'), secondary: null, dot: 'error', category: 'error' };
  if (status === 'idle') return null;
  const nouns = tier ? tierNouns(tier) : null;
  if (status === 'loading') {
    return {
      primary: nouns ? t('nearbyMap.tierLoading', { tiers: nouns.other }) : t('nearbyMap.homeLoading'),
      secondary: null,
      dot: 'loading',
      category: `loading:${tier ?? ''}`,
    };
  }
  const { n, online } = counts;
  const dot: NearbyChipDot = n > 0 ? 'available' : 'none';
  if (!nouns) {
    const primary = n === 0 ? t('nearbyMap.homeNone') : n === 1 ? t('nearbyMap.homeOnlineOne') : t('nearbyMap.homeOnline', { n });
    return { primary, secondary: null, dot, category: `home:${n > 0}` };
  }
  const params = { n, tier: nouns.one, tiers: nouns.other, noun: nouns.none };
  const primary = n === 0 ? t('nearbyMap.tierNone', params) : n === 1 ? t('nearbyMap.tierNearbyOne', params) : t('nearbyMap.tierNearby', params);
  // §4: "· {online} online" only when the server sent counts and someone is online.
  const secondary = online !== null && online > 0 ? t('nearbyMap.onlinePart', { n: online }) : null;
  return { primary, secondary, dot, category: `${tier}:${n > 0}` };
};
