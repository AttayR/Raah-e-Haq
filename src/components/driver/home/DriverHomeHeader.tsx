import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Avatar } from '../../ui';
import { space } from '../../../theme';
import { DRIVER_HOME_COPY, greetingFor } from './copy';

type Props = {
  name?: string | null;
  photoUri?: string | null;
  isOnline: boolean;
  onOpenProfile: () => void;
};

/**
 * Greeting row: the driver's name (truncates, never pushes the avatar off-screen) and the
 * avatar (with the online ring), which opens the profile.
 */
export function DriverHomeHeader({ name, photoUri, isOnline, onOpenProfile }: Props) {
  const displayName = name?.trim() || DRIVER_HOME_COPY.driverFallbackName;
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <AppText variant="bodySmall" color="textSecondary" numberOfLines={1}>
          {greetingFor(new Date().getHours())}
        </AppText>
        <AppText variant="h2" numberOfLines={1} accessibilityRole="header">
          {displayName}
        </AppText>
      </View>
      <Pressable
        onPress={onOpenProfile}
        accessibilityRole="button"
        accessibilityLabel={DRIVER_HOME_COPY.openProfile}
        testID="driver-home-profile"
        style={styles.avatarTarget}
      >
        <Avatar name={displayName} uri={photoUri} size={48} online={isOnline} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  text: { flex: 1, minWidth: 0 },
  avatarTarget: { flexShrink: 0 },
});
