import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Avatar, BottomSheet, Button, Chip, RatingInput, TextField } from '../../../components/ui';
import { toast } from '../../../core/toast';
import { useKeyboardVisible } from '../../../hooks/useKeyboardVisible';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import { RATING_DEFAULTS, toRateBody } from '../api';
import { keepAllowedTags, tagsForStars, toggleTag } from '../format';
import { useRateRide, useRatingConfig } from '../hooks';
import type { RaterRole, RatingConfig, RideRatingState } from '../types';

export type RateRideSheetProps = {
  visible: boolean;
  rideId: number;
  /** The signed-in user's side: a passenger rates the driver, a driver rates the passenger. */
  role: RaterRole;
  /** The person being rated (first name from the ride card); null shows "Your driver" / "Your passenger". */
  personName: string | null;
  photoUri?: string | null;
  /** 201: the ride's new rating state. The host updates the ride and closes the sheet. */
  onRated: (state: RideRatingState) => void;
  /** 409 / window closed: the ride was re-read (null when that failed). The host closes quietly. */
  onStale: (state: RideRatingState | null) => void;
  /** Skip, the scrim, Android back or a drag down. */
  onSkip: () => void;
};

const tagsTitle = (config: RatingConfig, stars: number): string => {
  const good = stars >= config.positiveMinStars;
  const bad = stars <= config.negativeMaxStars;
  if (good && bad) return t('rating.tagsMixed');
  return good ? t('rating.tagsGood') : t('rating.tagsBad');
};

/**
 * The after-ride rating sheet (T-505, BE-07), both roles, like Uber/Careem: the other person
 * (avatar + name), five stars (kit RatingInput), the tags for the chosen star band as chips (up
 * to `max_tags`, labels from GET /rating-tags), an optional comment, then Submit and Skip.
 * `stars` is sent as a JSON integer. A 409 / window-closed answer closes the sheet quietly
 * (the host re-reads the ride); other failures show inline above Submit, which retries.
 */
export function RateRideSheet({ visible, rideId, role, personName, photoUri, onRated, onStale, onSkip }: RateRideSheetProps) {
  const { config, status, reload } = useRatingConfig(visible);
  // [T-519] While the comment is being typed the header shrinks to the name, so the comment box
  // and Submit / Skip stay visible above the keyboard (the kit grows the sheet and scrolls to it).
  const keyboardUp = useKeyboardVisible();
  const [stars, setStars] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const handleRated = useCallback(
    (state: RideRatingState) => {
      toast.success(t('rating.thanks'));
      onRated(state);
    },
    [onRated],
  );
  const { submit, submitting, error } = useRateRide({ rideId, onRated: handleRated, onStale });

  const offered = useMemo(() => tagsForStars(config, role, stars), [config, role, stars]);
  const maxTags = config?.maxTags ?? RATING_DEFAULTS.maxTags;
  const maxComment = config?.maxCommentLength ?? RATING_DEFAULTS.maxCommentLength;
  const fallbackName = role === 'passenger' ? t('rating.yourDriver') : t('rating.yourPassenger');
  const name = personName || fallbackName;

  const onStars = useCallback(
    (next: number) => {
      setStars(next);
      // Tags of a band the new star count no longer offers are dropped (the server refuses them).
      setSelected((current) => keepAllowedTags(current, tagsForStars(config, role, next)));
    },
    [config, role],
  );

  const onSubmit = () => {
    if (stars < 1 || submitting) return;
    submit(toRateBody(stars, keepAllowedTags(selected, offered), comment));
  };

  const skip = () => {
    if (!submitting) onSkip();
  };

  const atMax = selected.length >= maxTags;

  return (
    <BottomSheet
      mode="modal"
      visible={visible}
      onClose={skip}
      accessibilityLabel={t('rating.sheetA11y')}
      testID="rate-ride-sheet"
      header={
        keyboardUp ? (
          <View style={[styles.header, styles.headerCompact]} testID="rate-ride-header-compact">
            <AppText variant="h3" align="center" numberOfLines={1} testID="rate-ride-name">
              {name}
            </AppText>
          </View>
        ) : (
          <View style={styles.header}>
            <Avatar name={name} uri={photoUri} size={56} testID="rate-ride-avatar" />
            <AppText variant="caption" color="textSecondary">
              {fallbackName}
            </AppText>
            <AppText variant="h3" align="center" numberOfLines={1} testID="rate-ride-name">
              {name}
            </AppText>
            <AppText variant="bodySmall" color="textSecondary" align="center" accessibilityRole="header">
              {t('rating.title')}
            </AppText>
          </View>
        )
      }
      footer={
        <View style={styles.footer}>
          {error ? (
            <AppText variant="bodySmall" color="danger" align="center" accessibilityLiveRegion="polite" testID="rate-ride-error">
              {error}
            </AppText>
          ) : null}
          <Button
            label={error ? t('rating.retry') : t('rating.submit')}
            size="lg"
            haptic="impactLight"
            onPress={onSubmit}
            disabled={stars < 1}
            loading={submitting}
            testID="rate-ride-submit"
          />
          <Button label={t('rating.skip')} variant="ghost" onPress={skip} disabled={submitting} testID="rate-ride-skip" />
        </View>
      }
    >
      <View style={styles.body}>
        <RatingInput value={stars} onChange={onStars} disabled={submitting} testID="rate-ride-stars" />
        {stars < 1 ? (
          <AppText variant="caption" color="textMuted" align="center">
            {t('rating.starsHint')}
          </AppText>
        ) : null}

        {stars >= 1 && config && offered.length > 0 ? (
          <View style={styles.section} testID="rate-ride-tags">
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
                    disabled={submitting || (!on && atMax)}
                    onPress={() => setSelected((current) => toggleTag(current, tag.key, maxTags))}
                    testID={`rate-ride-tag-${tag.key}`}
                  />
                );
              })}
            </View>
          </View>
        ) : null}
        {stars >= 1 && status === 'failed' && !config ? (
          <View style={styles.section} testID="rate-ride-tags-failed">
            <AppText variant="bodySmall" color="textSecondary">
              {t('rating.tagsLoadFailed')}
            </AppText>
            <Button label={t('rating.retry')} variant="outline" size="sm" fullWidth={false} onPress={reload} testID="rate-ride-tags-retry" />
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
            testID="rate-ride-comment"
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: space[1], paddingHorizontal: space[4], paddingBottom: space[3] },
  headerCompact: { paddingBottom: space[2] },
  body: { paddingHorizontal: space[4], gap: space[4], paddingBottom: space[2] },
  section: { gap: space[2] },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  footer: { paddingHorizontal: space[4], gap: space[2] },
});
