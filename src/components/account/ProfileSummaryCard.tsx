import React from 'react';
import { I18nManager, StyleSheet, View } from 'react-native';
import type { User } from '../../services/api';
import { AppText, Avatar, Badge, Card, Icon } from '../ui';
import { displayRating } from '../ui/ride/RatingStars';
import { formatPkPhone } from '../../features/safety/rules';
import { t } from '../../i18n';
import { componentTokens, space } from '../../theme';

export type ProfileSummaryCardProps = {
  user: User | null;
  onPress: () => void;
  /**
   * The rating to show: GET /me/stats when it is already cached (M2 rating star, DESIGN_SYSTEM
   * §1.8), else the profile's own `rating` (BE-07). Undefined uses `user.rating`.
   */
  rating?: number | null;
  testID: string;
};

/** The one contact line: the formatted verified phone, else the email, else nothing. */
export const summaryContact = (user: User | null): string | null => {
  if (user?.phone) return formatPkPhone(user.phone);
  const email = user?.email?.trim();
  return email ? email : null;
};

/**
 * Account tab profile card, both roles (shared-settings §3): Avatar 56, name, formatted phone (or
 * email), the rating (star + number, or "New") from the profile itself (BE-07), and a pill only
 * while the account waits for approval. The whole card opens Profile. A driver whose new photo is
 * under review still shows the approved one (BE-94).
 */
export const ProfileSummaryCard = React.memo(function ProfileSummaryCard({ user, onPress, rating: ratingOverride, testID }: ProfileSummaryCardProps) {
  const fallback = user?.role === 'driver' ? t('account.fallbackNameDriver') : t('account.fallbackNameRider');
  const name = user?.name?.trim() || fallback;
  const contact = summaryContact(user);
  const rating = displayRating(ratingOverride === undefined ? user?.rating : ratingOverride);
  const ratingText = rating === null ? null : rating.toFixed(1);
  const pending = user?.status === 'pending';
  // BE-94: profile_image_url is always the approved photo, never one still under review.
  const photo = user?.profile_image_url ?? null;
  const label = [
    name,
    contact,
    ratingText ? t('account.ratedA11y', { rating: ratingText }) : user ? t('account.newA11y') : null,
    pending ? t('account.pendingApproval') : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Card onPress={onPress} accessibilityLabel={label} accessibilityHint={t('account.openProfileHint')} testID={testID}>
      <View style={styles.row}>
        <Avatar name={name} uri={photo} size={56} />
        <View style={styles.text}>
          <AppText variant="h3" numberOfLines={2}>
            {name}
          </AppText>
          {contact ? (
            <AppText variant="bodySmall" color="textSecondary" numberOfLines={1} ellipsizeMode="middle" testID={`${testID}-contact`}>
              {contact}
            </AppText>
          ) : null}
          {user ? (
            <View style={styles.rating} testID={`${testID}-rating`}>
              {ratingText ? (
                <>
                  <Icon name="star" size={componentTokens.ride.rating.display} color="ratingStar" />
                  <AppText variant="numeric" numberOfLines={1}>
                    {ratingText}
                  </AppText>
                </>
              ) : (
                <AppText variant="caption" color="textMuted" numberOfLines={1}>
                  {t('account.ratingNew')}
                </AppText>
              )}
            </View>
          ) : null}
          {pending ? (
            <View style={styles.badgeRow}>
              <Badge tone="warning" label={t('account.pendingApproval')} testID={`${testID}-status`} />
            </View>
          ) : null}
        </View>
        <View style={I18nManager.isRTL ? styles.flip : null}>
          <Icon name="chevronEnd" size={20} color="textMuted" />
        </View>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  text: { flex: 1, minWidth: 0, gap: space[1] },
  rating: { flexDirection: 'row', alignItems: 'center', gap: space[1], minHeight: space[5] },
  badgeRow: { flexDirection: 'row' },
  flip: { transform: [{ scaleX: -1 }] },
});
