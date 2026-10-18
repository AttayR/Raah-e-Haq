import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Card, Chip, Icon, MAX_STARS, ratingLabel } from '../../../components/ui';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import { NOT_RATABLE } from '../api';
import { tagLabels } from '../format';
import { useRatingConfig } from '../hooks';
import type { MyRating, RaterRole, RideRatingState } from '../types';
import { RateRideSheet } from './RateRideSheet';

type Props = {
  rideId: number;
  /** The signed-in user's side of the ride. */
  role: RaterRole;
  myRating: MyRating | null;
  canRate: boolean;
  /** The person being rated (first name), for the sheet. */
  personName: string | null;
  photoUri?: string | null;
  /** The ride's new rating state (after a rating, or the re-read after a 409 / window closed). */
  onChange: (state: RideRatingState) => void;
};

/** Five read-only stars for a given rating (§5.22 colours). */
function Stars({ value }: { value: number }) {
  return (
    <View style={styles.stars} accessible accessibilityLabel={t('rating.yourRatingA11y', { n: value })} testID="ride-rating-stars">
      {Array.from({ length: MAX_STARS }, (_, i) => (
        <Icon key={i} name={i < value ? 'star' : 'starOutline'} size={20} color={i < value ? 'ratingStar' : 'borderStrong'} />
      ))}
      <AppText variant="bodySmall" color="textSecondary" style={styles.starsLabel}>
        {ratingLabel(value)}
      </AppText>
    </View>
  );
}

/**
 * Ride details, both roles (T-505): "Your rating" (stars, tag labels from GET /rating-tags, the
 * comment) once `my_rating` exists, or "Rate this trip" while `can_rate`, which opens the same
 * rating sheet as the after-ride prompt. Nothing while neither applies.
 */
export function RideRatingSection({ rideId, role, myRating, canRate, personName, photoUri, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const hasTags = !!myRating && myRating.tags.length > 0;
  const { config } = useRatingConfig(hasTags);

  const apply = useCallback(
    (state: RideRatingState) => {
      setOpen(false);
      onChange(state);
    },
    [onChange],
  );
  const onStale = useCallback((state: RideRatingState | null) => apply(state ?? NOT_RATABLE), [apply]);

  let body: React.ReactElement | null = null;
  if (myRating) {
    const labels = tagLabels(config, role, myRating.tags);
    body = (
      <Card testID="ride-details-rating">
        <AppText variant="overline" color="textMuted" accessibilityRole="header" style={styles.title}>
          {t('rating.yourRating')}
        </AppText>
        <Stars value={myRating.stars} />
        {labels.length > 0 ? (
          <View style={styles.chips} testID="ride-rating-tags">
            {labels.map((label) => (
              <Chip key={label} label={label} />
            ))}
          </View>
        ) : null}
        {myRating.comment ? (
          <AppText variant="bodySmall" color="textSecondary" style={styles.comment} selectable testID="ride-rating-comment">
            {myRating.comment}
          </AppText>
        ) : null}
      </Card>
    );
  } else if (canRate) {
    body = (
      <Card testID="ride-details-rate">
        <AppText variant="overline" color="textMuted" accessibilityRole="header" style={styles.title}>
          {t('rating.yourRating')}
        </AppText>
        <Button
          label={t('rating.rateThisTrip')}
          variant="secondary"
          leadingIcon="starOutline"
          accessibilityHint={t('rating.rateHint')}
          onPress={() => setOpen(true)}
          testID="ride-details-rate-button"
        />
      </Card>
    );
  }

  // [T-565] The sheet stays mounted when the section turns into "Your rating" (or goes): it closes
  // through `visible` and slides out instead of unmounting a presented Modal.
  return (
    <>
      {body}
      <RateRideSheet
        visible={open && canRate && !myRating}
        rideId={rideId}
        role={role}
        personName={personName}
        photoUri={photoUri}
        onRated={apply}
        onStale={onStale}
        onSkip={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: space[2] },
  stars: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  starsLabel: { marginStart: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[3] },
  comment: { marginTop: space[3] },
});
