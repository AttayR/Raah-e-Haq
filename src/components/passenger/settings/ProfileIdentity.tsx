import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { User } from '../../../services/api';
import { AppText, Badge } from '../../ui';
import { ProfilePhotoEditor } from '../../../features/profile-photo';
import { space } from '../../../theme';
import { PASSENGER_SETTINGS_COPY as COPY, accountStatusBadge } from './copy';
import { formatMonthYear } from './format';

/**
 * Profile identity block (shared-profile §1): Avatar 96 (photo or initials), name, "Rider" and
 * "Member since {month year}" when the server sends `created_at`. Tapping the avatar changes the
 * photo (T-504, POST /profile/avatar) or removes it (BE-94, DELETE /profile/avatar); the result
 * reaches every avatar through the store.
 */
export function ProfileIdentity({ user }: { user: User | null }) {
  const name = user?.name?.trim() || COPY.passengerFallbackName;
  const since = formatMonthYear(user?.created_at);
  const meta = since ? `${COPY.roleLabel} · ${COPY.memberSince} ${since}` : COPY.roleLabel;
  const badge = accountStatusBadge(user?.status);

  return (
    <View style={styles.container} testID="passenger-profile-identity">
      <ProfilePhotoEditor name={name} uri={user?.profile_image_url} canRemove testID="passenger-profile-photo" />
      <View style={styles.text}>
        <AppText variant="h2" align="center" numberOfLines={2} accessibilityRole="header">
          {name}
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" align="center" testID="passenger-profile-meta">
          {meta}
        </AppText>
      </View>
      {badge ? <Badge tone={badge.tone} label={badge.label} testID="passenger-profile-status" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: space[3], paddingTop: space[2] },
  text: { alignItems: 'center', gap: space[1], alignSelf: 'stretch' },
});
