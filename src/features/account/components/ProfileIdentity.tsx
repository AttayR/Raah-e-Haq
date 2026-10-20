import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { User } from '../../../services/api';
import { AppText, Badge } from '../../../components/ui';
import { formatMonthYear } from '../../../components/passenger/settings/format';
import { ownPhotoUri, PhotoReviewBanner, ProfilePhotoEditor, toPhotoReview } from '../../profile-photo';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import type { AccountRole } from '../navigation';

/** "Rider · Member since Mar 2026"; only the role word without a date. */
export const profileMeta = (role: AccountRole, createdAt: string | null | undefined): string => {
  const word = role === 'driver' ? t('profile.roleDriver') : t('profile.roleRider');
  const since = formatMonthYear(createdAt);
  return since ? `${word} · ${t('profile.memberSince', { date: since })}` : word;
};

/**
 * Profile identity (shared-profile §P2.1), both roles: Avatar 96 with the camera badge (tap to
 * change, T-504; remove on the passenger side, BE-94), name, role and member-since line, the
 * "Pending approval" pill only while pending (no "Approved" pill), and a driver's photo-review
 * Banner (BE-94: a new photo waiting for review is labelled "Under review").
 */
export function ProfileIdentity({ user, role }: { user: User | null; role: AccountRole }) {
  const prefix = `${role}-profile`;
  const name = user?.name?.trim() || (role === 'driver' ? t('account.fallbackNameDriver') : t('account.fallbackNameRider'));
  const review = role === 'driver' ? toPhotoReview(user) : null;
  const uri = role === 'driver' ? ownPhotoUri(user, review) : user?.profile_image_url;

  return (
    <View style={styles.container} testID={`${prefix}-identity`}>
      <ProfilePhotoEditor
        name={name}
        uri={uri}
        canRemove={role === 'passenger'}
        underReview={review?.status === 'pending' && !!review.pendingUri}
        useServerMessage={role === 'driver'}
        testID={`${prefix}-photo`}
      />
      <View style={styles.text}>
        <AppText variant="h2" align="center" numberOfLines={2} accessibilityRole="header">
          {name}
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" align="center" testID={`${prefix}-meta`}>
          {profileMeta(role, user?.created_at)}
        </AppText>
      </View>
      {user?.status === 'pending' ? <Badge tone="warning" label={t('account.pendingApproval')} testID={`${prefix}-status`} /> : null}
      {role === 'driver' ? <PhotoReviewBanner review={review} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: space[3] },
  text: { alignItems: 'center', gap: space[1], alignSelf: 'stretch' },
});
