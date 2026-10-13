import { apiService, unwrap } from '../../services/api';
import { isRecord, readId, readNumberOrNull, readText } from '../../core/api/read';
import type { RideMyRating } from '../../services/rideService';
import type {
  MyRating,
  RateRideBody,
  RatingConfig,
  RatingTag,
  RatingTagBands,
  RideRatingFields,
  RideRatingState,
} from './types';

/**
 * Ride rating (T-505, BE-07; docs/api/CONTRACT_NOTES.md), all through the shared axios client:
 * - GET  /rating-tags       -> data: { window_days, max_tags, max_comment_length,
 *                              positive_min_stars, negative_max_stars, tags: { passenger, driver } }
 * - POST /rides/{id}/rate   -> 201 data: { my_rating, can_rate: false }
 * - GET  /rides/{id}        -> the ride, read here only for `my_rating` / `can_rate`
 * Refusals arrive as ApiErrors with `error.code` (RATING_CODES); a 422 without a code is validation.
 */
export const RATING_CODES = {
  notParticipant: 'NOT_RIDE_PARTICIPANT',
  notCompleted: 'RIDE_NOT_COMPLETED',
  windowClosed: 'RATING_WINDOW_CLOSED',
  alreadyRated: 'ALREADY_RATED',
} as const;

/** The contract's values, used when the server leaves a number out. */
export const RATING_DEFAULTS = {
  windowDays: 7,
  maxTags: 5,
  maxCommentLength: 500,
  positiveMinStars: 4,
  negativeMaxStars: 4,
} as const;

const MIN_STARS = 1;
const MAX_STARS = 5;

const positiveInt = (value: unknown, fallback: number): number => readId(value) ?? fallback;

const toTag = (raw: unknown): RatingTag | null => {
  if (!isRecord(raw)) return null;
  const key = readText(raw.key);
  const label = readText(raw.label);
  return key && label ? { key, label } : null;
};

const toTagList = (raw: unknown): RatingTag[] => {
  const seen = new Set<string>();
  return (Array.isArray(raw) ? raw : [])
    .map(toTag)
    .filter((tag): tag is RatingTag => {
      if (!tag || seen.has(tag.key)) return false;
      seen.add(tag.key);
      return true;
    });
};

const toBands = (raw: unknown): RatingTagBands => {
  const data = isRecord(raw) ? raw : {};
  return { positive: toTagList(data.positive), negative: toTagList(data.negative) };
};

export const toRatingConfig = (raw: unknown): RatingConfig => {
  const data = isRecord(raw) ? raw : {};
  const tags = isRecord(data.tags) ? data.tags : {};
  return {
    windowDays: positiveInt(data.window_days, RATING_DEFAULTS.windowDays),
    maxTags: positiveInt(data.max_tags, RATING_DEFAULTS.maxTags),
    maxCommentLength: positiveInt(data.max_comment_length, RATING_DEFAULTS.maxCommentLength),
    positiveMinStars: positiveInt(data.positive_min_stars, RATING_DEFAULTS.positiveMinStars),
    negativeMaxStars: positiveInt(data.negative_max_stars, RATING_DEFAULTS.negativeMaxStars),
    tags: { passenger: toBands(tags.passenger), driver: toBands(tags.driver) },
  };
};

/** `my_rating`; null when absent or without usable stars. */
export const toMyRating = (raw: unknown): MyRating | null => {
  if (!isRecord(raw)) return null;
  const stars = readNumberOrNull(raw.stars);
  if (stars === null || !Number.isInteger(stars) || stars < MIN_STARS || stars > MAX_STARS) return null;
  const tags = (Array.isArray(raw.tags) ? raw.tags : []).filter((tag): tag is string => typeof tag === 'string' && tag !== '');
  return { stars, tags, comment: readText(raw.comment), createdAt: readText(raw.created_at) };
};

/** `my_rating` and `can_rate` off any ride object (or the rate answer). Missing = not ratable. */
export const toRideRatingState = (raw: unknown): RideRatingState => {
  const data = isRecord(raw) ? raw : {};
  const myRating = toMyRating(data.my_rating);
  return { myRating, canRate: data.can_rate === true && myRating === null };
};

/**
 * The POST body: `stars` as a JSON integer, `tags` only when some are chosen, `comment` trimmed
 * and only when not blank (the server stores blank as null anyway).
 */
export const toRateBody = (stars: number, tags: ReadonlyArray<string>, comment: string): RateRideBody => {
  const body: RateRideBody = { stars: Math.round(stars) };
  if (tags.length > 0) body.tags = [...tags];
  const text = comment.trim();
  if (text) body.comment = text;
  return body;
};

export const toRideRatingFields = (state: RideRatingState): RideRatingFields => {
  const my: RideMyRating | null = state.myRating
    ? { stars: state.myRating.stars, tags: [...state.myRating.tags], comment: state.myRating.comment, created_at: state.myRating.createdAt }
    : null;
  return { my_rating: my, can_rate: state.canRate };
};

/** After 409 / window closed with no fresh read: the ride can no longer be rated from here. */
export const NOT_RATABLE: RideRatingState = { myRating: null, canRate: false };

export const ratingApi = {
  async getTags(): Promise<RatingConfig> {
    return toRatingConfig(unwrap(await apiService.get<unknown>('/rating-tags')));
  },

  async rate(rideId: number, body: RateRideBody): Promise<RideRatingState> {
    return toRideRatingState(unwrap(await apiService.post<unknown>(`/rides/${rideId}/rate`, body)));
  },

  /** GET /rides/{id}, for the rating fields only (after a 409 / window closed). */
  async getRideRating(rideId: number): Promise<RideRatingState> {
    return toRideRatingState(unwrap(await apiService.get<unknown>(`/rides/${rideId}`)));
  },
};
