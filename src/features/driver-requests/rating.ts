/**
 * T-414: the passenger rating the driver sees on the request card and the ride panel.
 *
 * The server sends `passenger.rating` (users.rating, a `decimal:2` column, rounded to one
 * decimal). Nothing writes that column yet (BE-07 adds ratings) and it defaults to 0.00, so
 * every rider arrived as "★ 0.0". A rating is 1 to 5 stars: zero, a missing value or anything
 * outside 0 < r <= 5 means "not rated yet", and the card says "New rider" instead.
 */
export const MAX_RATING = 5;

export const riderRating = (value: unknown): number | null => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return n > 0 && n <= MAX_RATING ? n : null;
};
