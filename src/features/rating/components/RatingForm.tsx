import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Chip, RatingInput, TextField } from '../../../components/ui';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import { RATING_DEFAULTS, toRateBody } from '../api';
import { keepAllowedTags, tagsForStars, toggleTag } from '../format';
import { useRateRide, useRatingConfig, type RatingConfigStatus } from '../hooks';
import type { RaterRole, RatingConfig, RideRatingState } from '../types';

export type RatingFormOptions = {
  rideId: number;
  /** The signed-in user's side: a passenger rates the driver, a driver rates the passenger. */
  role: RaterRole;
  /** BE-107 / T-569: the parcel tags (`parcel_tags[role]`). */
  parcel?: boolean;
  /** Load the tags (GET /rating-tags, cached for the session) once this is true. */
  enabled?: boolean;
  /** 201: the ride's new rating state. */
  onRated: (state: RideRatingState) => void;
  /** 409 / window closed: the ride was re-read (null when that failed). */
  onStale: (state: RideRatingState | null) => void;
  /** Called on every failed submit that is not stale (the message is in `error`). */
  onFailed?: () => void;
};

export type RatingFormState = {
  stars: number;
  setStars: (next: number) => void;
  selected: string[];
  toggle: (key: string) => void;
  comment: string;
  setComment: (next: string) => void;
  config: RatingConfig | null;
  status: RatingConfigStatus;
  reload: () => void;
  /** POST /rides/{id}/rate with the chosen stars, tags and comment (no-op without a star). */
  submit: () => void;
  submitting: boolean;
  error: string | null;
  maxTags: number;
  maxComment: number;
  /** The tags offered for the chosen star band. */
  offered: ReturnType<typeof tagsForStars>;
};

/**
 * One rating behaviour (T-505, BE-07; passenger-trip-complete PR7): stars, the tags of the chosen
 * band (up to `max_tags`, from GET /rating-tags), an optional comment, and the submit with its
 * stale / 409 handling. Used inline in the trip receipt and by RateRideSheet (Activity, ride
 * details, the driver's prompt), so the two never drift apart.
 */
export function useRatingForm({ rideId, role, parcel = false, enabled = true, onRated, onStale, onFailed }: RatingFormOptions): RatingFormState {
  const { config, status, reload } = useRatingConfig(enabled);
  const [stars, setStarsState] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const { submit: send, submitting, error } = useRateRide({ rideId, onRated, onStale, onFailed });

  const offered = useMemo(() => tagsForStars(config, role, stars, parcel), [config, role, stars, parcel]);
  const maxTags = config?.maxTags ?? RATING_DEFAULTS.maxTags;
  const maxComment = config?.maxCommentLength ?? RATING_DEFAULTS.maxCommentLength;

  const setStars = useCallback(
    (next: number) => {
      setStarsState(next);
      // Tags of a band the new star count no longer offers are dropped (the server refuses them).
      setSelected((current) => keepAllowedTags(current, tagsForStars(config, role, next, parcel)));
    },
    [config, role, parcel],
  );
  const toggle = useCallback((key: string) => setSelected((current) => toggleTag(current, key, maxTags)), [maxTags]);
  const submit = useCallback(() => {
    if (stars < 1 || submitting) return;
    send(toRateBody(stars, keepAllowedTags(selected, offered), comment));
  }, [comment, offered, selected, send, stars, submitting]);

  return { stars, setStars, selected, toggle, comment, setComment, config, status, reload, submit, submitting, error, maxTags, maxComment, offered };
}

const tagsTitle = (config: RatingConfig, stars: number): string => {
  const good = stars >= config.positiveMinStars;
  const bad = stars <= config.negativeMaxStars;
  if (good && bad) return t('rating.tagsMixed');
  return good ? t('rating.tagsGood') : t('rating.tagsBad');
};

/**
 * The rating form's body (kit RatingInput, tag Chips, comment TextField); the host draws the
 * person and the submit action (the sheet footer, or the trip receipt's footer).
 */
export function RatingForm({
  form,
  tagVariant = 'filled',
  testID = 'rate-ride',
}: {
  form: RatingFormState;
  /** [UI-R12] The trip receipt's tags are `outline` chips (PR2 block 5). */
  tagVariant?: 'filled' | 'outline';
  testID?: string;
}) {
  const { stars, setStars, selected, toggle, comment, setComment, config, status, reload, submitting, maxTags, maxComment, offered } = form;
  const atMax = selected.length >= maxTags;
  return (
    <View style={styles.body}>
      {/* PR2: stars → 8 → "Tap a star to rate", then the chosen star's word in the same line. */}
      <RatingInput value={stars} onChange={setStars} disabled={submitting} emptyLabel={t('rating.starsHint')} testID={`${testID}-stars`} />

      {stars >= 1 && config && offered.length > 0 ? (
        <View style={styles.section} testID={`${testID}-tags`}>
          <View style={styles.sectionTitle}>
            <AppText variant="bodyStrong">{tagsTitle(config, stars)}</AppText>
            <AppText variant="caption" color="textMuted">
              {t('rating.tagsLimit', { n: maxTags })}
            </AppText>
          </View>
          <View style={styles.chips}>
            {offered.map((tag) => {
              const on = selected.includes(tag.key);
              return (
                <Chip
                  key={tag.key}
                  label={tag.label}
                  selected={on}
                  variant={tagVariant}
                  disabled={submitting || (!on && atMax)}
                  onPress={() => toggle(tag.key)}
                  testID={`${testID}-tag-${tag.key}`}
                />
              );
            })}
          </View>
        </View>
      ) : null}
      {stars >= 1 && status === 'failed' && !config ? (
        <View style={styles.section} testID={`${testID}-tags-failed`}>
          <AppText variant="bodySmall" color="textSecondary">
            {t('rating.tagsLoadFailed')}
          </AppText>
          <Button label={t('rating.retry')} variant="outline" size="sm" fullWidth={false} onPress={reload} testID={`${testID}-tags-retry`} />
        </View>
      ) : null}

      {stars >= 1 ? (
        <TextField
          label={t('rating.commentLabel')}
          placeholder={t('rating.commentPlaceholder')}
          value={comment}
          onChangeText={setComment}
          multiline
          maxLength={maxComment}
          disabled={submitting}
          helper={t('rating.commentCount', { n: comment.length, max: maxComment })}
          helperAlign="end"
          testID={`${testID}-comment`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[4] },
  section: { gap: space[2] },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
