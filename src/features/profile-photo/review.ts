import type { User } from '../../services/api';

/**
 * A driver's profile photo review (BE-94): the signed-in profile (GET /profile, POST and DELETE
 * /profile/avatar) carries `profile_image_review`, `pending_profile_image_url` and
 * `profile_image_rejection_reason`. Passengers keep seeing the approved `profile_image_url` until
 * an admin approves the new one. Null when the photo is approved or there is no review.
 */
export type PhotoReview =
  | { status: 'pending'; pendingUri: string | null }
  | { status: 'rejected'; reason: string | null }
  | null;

const present = (value: string | null | undefined): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

export const toPhotoReview = (
  user: Pick<User, 'profile_image_review' | 'pending_profile_image_url' | 'profile_image_rejection_reason'> | null | undefined,
): PhotoReview => {
  if (user?.profile_image_review === 'pending') {
    return { status: 'pending', pendingUri: present(user.pending_profile_image_url) };
  }
  if (user?.profile_image_review === 'rejected') {
    return { status: 'rejected', reason: present(user.profile_image_rejection_reason) };
  }
  return null;
};

/**
 * The photo the driver sees on their own Profile: the one waiting for review when there is one
 * (labelled "Under review"), else the approved one.
 */
export const ownPhotoUri = (user: Pick<User, 'profile_image_url'> | null | undefined, review: PhotoReview): string | null =>
  (review?.status === 'pending' ? review.pendingUri : null) ?? present(user?.profile_image_url);
