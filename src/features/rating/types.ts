import type { RideMyRating } from '../../services/rideService';

/**
 * Ride rating (T-505, BE-07; docs/api/CONTRACT_NOTES.md "BE-07: ride rating"). App models mapped
 * from GET /rating-tags and the `my_rating` / `can_rate` fields every ride object carries.
 */

/** Who is rating: a passenger rates the driver, a driver rates the passenger. */
export type RaterRole = 'passenger' | 'driver';

export interface RatingTag {
  /** Sent to the server. */
  key: string;
  /** Shown to the user (from the server, never hardcoded). */
  label: string;
}

export interface RatingTagBands {
  positive: RatingTag[];
  negative: RatingTag[];
}

/** GET /rating-tags. `tags` is keyed by the rater's role. */
export interface RatingConfig {
  windowDays: number;
  maxTags: number;
  maxCommentLength: number;
  /** Positive tags show from this many stars up. */
  positiveMinStars: number;
  /** Negative tags show up to this many stars. */
  negativeMaxStars: number;
  tags: Record<RaterRole, RatingTagBands>;
}

/** The caller's own rating of a ride (`my_rating`). */
export interface MyRating {
  stars: number;
  tags: string[];
  comment: string | null;
  createdAt: string | null;
}

/** What a ride says about rating it: the caller's rating and whether they may still rate. */
export interface RideRatingState {
  myRating: MyRating | null;
  canRate: boolean;
}

/** POST /rides/{id}/rate body. `stars` is a JSON integer (the server refuses "5" and 5.0). */
export interface RateRideBody {
  stars: number;
  tags?: string[];
  comment?: string;
}

/** The rating state as RideResource fields, to patch a ride kept in Redux. */
export interface RideRatingFields {
  my_rating: RideMyRating | null;
  can_rate: boolean;
}
