import React from 'react';
import { StyleSheet } from 'react-native';
import { Banner } from '../../../components/ui';
import { t } from '../../../i18n';
import type { PhotoReview } from '../review';

/**
 * The driver's photo review state under the Profile identity (T-504); nothing when approved. A
 * rejected photo is replaced from the avatar's camera badge right above it.
 */
export function PhotoReviewBanner({ review }: { review: PhotoReview }) {
  if (!review) return null;
  if (review.status === 'pending') {
    return (
      <Banner
        tone="info"
        icon="pending"
        title={t('profilePhoto.reviewTitle')}
        text={t('profilePhoto.reviewBody')}
        style={styles.banner}
        testID="photo-review-pending"
      />
    );
  }
  const reason = review.reason ? ` ${t('profilePhoto.rejectedReason', { reason: review.reason })}` : '';
  return (
    <Banner
      tone="danger"
      title={t('profilePhoto.rejectedTitle')}
      text={`${t('profilePhoto.rejectedBody')}${reason}`}
      style={styles.banner}
      testID="photo-review-rejected"
    />
  );
}

const styles = StyleSheet.create({ banner: { alignSelf: 'stretch' } });
