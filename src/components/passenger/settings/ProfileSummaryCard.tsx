import React from 'react';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import type { User } from '../../../services/api';
import { AppText, Avatar, Badge, Card, Icon } from '../../ui';
import { space } from '../../../theme';
import { PASSENGER_SETTINGS_COPY, accountStatusBadge } from './copy';

export type ProfileSummaryCardProps = {
  user: User | null;
  onPress: () => void;
};

/**
 * Settings profile header (shared-settings §1): Avatar 56, name, phone or email, and the
 * account-status badge when there is one; the whole card opens the Profile view.
 * No rating here: the signed-in user payload has none (no invented stars).
 */
export function ProfileSummaryCard({ user, onPress }: ProfileSummaryCardProps) {
  const { theme } = useAppTheme();
  const name = user?.name?.trim() || PASSENGER_SETTINGS_COPY.passengerFallbackName;
  const contact = user?.phone || user?.email || null;
  const badge = accountStatusBadge(user?.status);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[name, contact, badge?.label].filter(Boolean).join(', ')}
      accessibilityHint={PASSENGER_SETTINGS_COPY.openProfileHint}
      testID="passenger-settings-profile"
    >
      {({ pressed }) => (
        <Card style={pressed ? { backgroundColor: theme.colors.surfacePressed } : null}>
          <View style={styles.row}>
            <Avatar name={name} uri={user?.profile_image_url} size={56} />
            <View style={styles.text}>
              <AppText variant="h3" numberOfLines={2}>
                {name}
              </AppText>
              {contact ? (
                <AppText variant="bodySmall" color="textSecondary" numberOfLines={1} ellipsizeMode="middle">
                  {contact}
                </AppText>
              ) : null}
              {badge ? (
                <View style={styles.badgeRow}>
                  <Badge tone={badge.tone} label={badge.label} testID="passenger-settings-status" />
                </View>
              ) : null}
            </View>
            <View style={I18nManager.isRTL ? styles.flip : null}>
              <Icon name="chevronEnd" size={20} color="textMuted" />
            </View>
          </View>
        </Card>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  text: { flex: 1, minWidth: 0, gap: space[1] },
  badgeRow: { flexDirection: 'row', marginTop: space[1] },
  flip: { transform: [{ scaleX: -1 }] },
});
