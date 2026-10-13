import { firstFieldMessages, toApiError } from '../../core/api/errors';
import { t } from '../../i18n';
import { RATING_CODES } from './api';
import type { RaterRole, RatingConfig, RatingTag } from './types';

/**
 * The tags offered for `stars` (BE-07): positive from `positive_min_stars` up, negative up to
 * `negative_max_stars` (so 4 stars shows both). No stars yet: no tags.
 */
export const tagsForStars = (config: RatingConfig | null, role: RaterRole, stars: number): RatingTag[] => {
  if (!config || stars < 1) return [];
  const bands = config.tags[role];
  const tags: RatingTag[] = [];
  if (stars >= config.positiveMinStars) tags.push(...bands.positive);
  if (stars <= config.negativeMaxStars) tags.push(...bands.negative);
  const seen = new Set<string>();
  return tags.filter((tag) => {
    if (seen.has(tag.key)) return false;
    seen.add(tag.key);
    return true;
  });
};

/** Keeps only selected keys that the current band still offers (a star change can drop some). */
export const keepAllowedTags = (selected: ReadonlyArray<string>, allowed: ReadonlyArray<RatingTag>): string[] => {
  const keys = new Set(allowed.map((tag) => tag.key));
  return selected.filter((key) => keys.has(key));
};

/** Adds or removes `key`; adding past `maxTags` is a no-op. */
export const toggleTag = (selected: ReadonlyArray<string>, key: string, maxTags: number): string[] => {
  if (selected.includes(key)) return selected.filter((k) => k !== key);
  if (selected.length >= maxTags) return [...selected];
  return [...selected, key];
};

/** Labels of `keys` for the rater's role, in order; a key the server no longer lists is left out. */
export const tagLabels = (config: RatingConfig | null, role: RaterRole, keys: ReadonlyArray<string>): string[] => {
  if (!config) return [];
  const bands = config.tags[role];
  const byKey = new Map([...bands.positive, ...bands.negative].map((tag) => [tag.key, tag.label]));
  return keys.map((key) => byKey.get(key)).filter((label): label is string => !!label);
};

/**
 * What a failed POST /rides/{id}/rate means for the sheet:
 * - `stale`: 409 ALREADY_RATED or 422 RATING_WINDOW_CLOSED. Close quietly and re-read the ride.
 * - `message`: anything else, shown inline with a retry (validation shows the first field message).
 */
export type RateFailure = { kind: 'stale' } | { kind: 'message'; message: string };

export const classifyRateFailure = (error: unknown): RateFailure => {
  const apiError = toApiError(error);
  if (apiError.code === RATING_CODES.alreadyRated || apiError.code === RATING_CODES.windowClosed) {
    return { kind: 'stale' };
  }
  if (apiError.code === RATING_CODES.notCompleted) return { kind: 'message', message: t('rating.errorNotCompleted') };
  if (apiError.code === RATING_CODES.notParticipant) return { kind: 'message', message: t('rating.errorNotParticipant') };
  if (apiError.kind === 'validation') {
    const fields = firstFieldMessages(apiError.fieldErrors);
    const first = fields.stars ?? fields.tags ?? fields.comment ?? Object.values(fields)[0];
    return { kind: 'message', message: first ?? apiError.message };
  }
  if (apiError.kind === 'unknown') return { kind: 'message', message: t('rating.errorGeneric') };
  return { kind: 'message', message: apiError.message };
};
