import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Card, Icon, Skeleton } from '../../../components/ui';
import { displayRating } from '../../../components/ui/ride/RatingStars';
import { t } from '../../../i18n';
import { radius, space, textStyles } from '../../../theme';
import { formatCount, formatDistance } from '../../../utils/format';

export type ProfileStatValues = {
  /** null: not rated yet ("New"). */
  rating: number | null;
  trips: number;
  distanceKm: number;
};

/** "412" from 412.3 km, "3.4" under 10 km, "0" for none (the unit is drawn on its own). */
export const distanceValue = (km: number): string => {
  if (!(km > 0)) return '0';
  const text = formatDistance(km);
  const unit = ` ${t('profile.km')}`;
  return text.endsWith(unit) ? text.slice(0, -unit.length) : text;
};

type Props = {
  /** null while loading (skeleton bars) or after a failure with nothing cached (`failed`). */
  values: ProfileStatValues | null;
  failed: boolean;
  testID: string;
};

/**
 * Profile stats strip (shared-profile §P3), both roles: one card with Rating / Trips / Distance
 * from GET /me/stats, split by hairline rules. Never earnings (they live in Earnings / Activity).
 * Loading keeps the 78 height with skeleton bars; a failure with nothing cached swaps the strip
 * for one line saying how to retry.
 */
export const ProfileStats = React.memo(function ProfileStats({ values, failed, testID }: Props) {
  const { theme } = useAppTheme();
  if (!values && failed) {
    return (
      <AppText variant="caption" color="textSecondary" testID={`${testID}-error`}>
        {t('profile.statsFailed')}
      </AppText>
    );
  }
  const rating = values ? displayRating(values.rating) : null;
  const rule = <View style={[styles.rule, { backgroundColor: theme.colors.border, width: theme.borderWidth.hairline }]} />;
  const loading = !values;
  return (
    <Card style={styles.card} testID={testID}>
      <View style={styles.row} accessibilityLabel={loading ? t('profile.statsLoadingA11y') : undefined}>
        <Cell
          label={t('profile.statRating')}
          a11y={rating === null ? t('profile.statRatingNewA11y') : t('profile.statRatingA11y', { rating: rating.toFixed(1) })}
          loading={loading}
          testID={`${testID}-rating`}
        >
          {rating === null ? (
            <AppText variant="title" color="textSecondary" numberOfLines={1}>
              {t('account.ratingNew')}
            </AppText>
          ) : (
            <View style={styles.inline}>
              <Icon name="star" size={20} color="ratingStar" />
              <Value text={rating.toFixed(1)} />
            </View>
          )}
        </Cell>
        {rule}
        <Cell
          label={t('profile.statTrips')}
          a11y={values ? t('profile.statTripsA11y', { count: formatCount(values.trips) }) : ''}
          loading={loading}
          testID={`${testID}-trips`}
        >
          <Value text={values ? formatCount(values.trips) : ''} />
        </Cell>
        {rule}
        <Cell
          label={t('profile.statDistance')}
          a11y={values ? t('profile.statDistanceA11y', { km: distanceValue(values.distanceKm) }) : ''}
          loading={loading}
          testID={`${testID}-distance`}
        >
          <View style={styles.inline}>
            <Value text={values ? distanceValue(values.distanceKm) : ''} />
            <AppText variant="bodySmall" color="textSecondary">
              {t('profile.km')}
            </AppText>
          </View>
        </Cell>
      </View>
    </Card>
  );
});

function Value({ text }: { text: string }) {
  return (
    <AppText variant="numericL" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
      {text}
    </AppText>
  );
}

function Cell({
  label,
  a11y,
  loading,
  testID,
  children,
}: React.PropsWithChildren<{ label: string; a11y: string; loading: boolean; testID: string }>) {
  return (
    <View style={styles.cell} accessible={!loading} accessibilityLabel={loading ? undefined : a11y} testID={testID}>
      <View style={styles.value}>{loading ? <Skeleton width={space[12]} height={space[5]} style={styles.bar} /> : children}</View>
      <AppText variant="caption" color="textSecondary" align="center" numberOfLines={2}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: space[4], paddingHorizontal: space[2] },
  row: { flexDirection: 'row', alignItems: 'center' },
  cell: { flex: 1, alignItems: 'center', gap: space[1] / 2 },
  value: { minHeight: textStyles.numericL.lineHeight, justifyContent: 'center', alignItems: 'center' },
  inline: { flexDirection: 'row', alignItems: 'baseline', gap: space[1] },
  rule: { height: space[10], alignSelf: 'center' },
  bar: { borderRadius: radius.sm },
});
