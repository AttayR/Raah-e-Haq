import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Avatar, Icon } from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, space } from '../../../theme';
import { RatingForm, type RatingFormState } from './RatingForm';

type Props = {
  /** The person rated (first name, or the role's fallback). */
  name: string;
  photoUri?: string | null;
  /** "How was your ride with {name}?" (the host picks the role's and the parcel's wording). */
  title: string;
  /** The inline form while the ride can be rated, else null. */
  form: RatingFormState | null;
  /** The stars already given (`my_rating`), shown read-only when there is no form. */
  myStars: number | null;
  /** "You rated this trip". */
  ratedLabel: string;
};

/**
 * The receipt's rating block, one for both roles (passenger-trip-complete PR2 #5 / #5',
 * driver-trip-complete DC1 #6): Avatar 56, the question in `h3` and the inline RatingForm; once
 * rated, the stars read-only. Nothing when neither applies. The submit is the receipt's footer.
 */
export function ReceiptRatingBlock({ name, photoUri, title, form, myStars, ratedLabel }: Props) {
  if (form) {
    return (
      <View style={styles.rating} testID="receipt-rating">
        <Avatar name={name} uri={photoUri ?? null} size={componentTokens.ride.person.avatar} />
        <AppText variant="h3" align="center" numberOfLines={2} accessibilityRole="header">
          {title}
        </AppText>
        <View style={styles.ratingForm}>
          <RatingForm form={form} tagVariant="outline" />
        </View>
      </View>
    );
  }
  if (myStars === null) return null;
  return (
    <View style={styles.rated} accessible accessibilityLabel={t('rating.yourRatingA11y', { n: myStars })} testID="receipt-rated">
      <View style={styles.starsRow}>
        {Array.from({ length: 5 }, (_, i) => (
          <Icon key={i} name={i < myStars ? 'star' : 'starOutline'} size={24} color={i < myStars ? 'ratingStar' : 'borderStrong'} />
        ))}
      </View>
      <AppText variant="bodySmall" color="textSecondary" align="center">
        {ratedLabel}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  rating: { alignItems: 'center', gap: space[3] },
  ratingForm: { alignSelf: 'stretch', marginTop: space[1] },
  rated: { alignItems: 'center', gap: space[2] },
  starsRow: { flexDirection: 'row', gap: space[1] },
});
