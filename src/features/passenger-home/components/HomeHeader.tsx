import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import { Avatar } from '../../../components/ui/Avatar';
import { Chip } from '../../../components/ui/Chip';
import { Icon } from '../../../components/ui/Icon';
import { IconButton } from '../../../components/ui/IconButton';
import { layout, space } from '../../../theme';

export type HomeLocationState =
  | { kind: 'address'; text: string }
  | { kind: 'locating' }
  | { kind: 'denied' }
  /** T-315: the lookup failed (no fix in time); the passenger can retry. */
  | { kind: 'unavailable' };

const LOCATION_TEXT: Record<Exclude<HomeLocationState['kind'], 'address'>, string> = {
  locating: 'Finding your location…',
  denied: 'Location is off',
  unavailable: 'Location unavailable',
};

type Props = {
  greeting: string;
  name?: string | null;
  photoUri?: string | null;
  location: HomeLocationState;
  onOpenProfile: () => void;
  onOpenNotifications: () => void;
  /** "Turn on" (access off) or "Retry" (no fix): asks for the location again. */
  onEnableLocation: () => void;
};

/** Top of the passenger Home: avatar and inbox, greeting, where the rider is now. */
export const HomeHeader: React.FC<Props> = ({
  greeting,
  name,
  photoUri,
  location,
  onOpenProfile,
  onOpenNotifications,
  onEnableLocation,
}) => {
  const problem = location.kind === 'denied' || location.kind === 'unavailable';
  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <Pressable
          testID="home-profile"
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={onOpenProfile}
          hitSlop={space[1]}
          style={styles.avatarTarget}
        >
          <Avatar name={name} uri={photoUri} size={40} />
        </Pressable>
        <IconButton
          testID="home-notifications"
          icon="bell"
          variant="tonal"
          accessibilityLabel="Notifications"
          onPress={onOpenNotifications}
        />
      </View>

      <AppText variant="h2" numberOfLines={2} accessibilityRole="header" testID="home-greeting">
        {greeting}
      </AppText>

      <View style={styles.locationRow} testID="home-location">
        <Icon
          name={problem ? 'locationOff' : 'pin'}
          size={16}
          color={problem ? 'warning' : 'textSecondary'}
        />
        <AppText variant="bodySmall" color="textSecondary" numberOfLines={1} style={styles.locationText}>
          {location.kind === 'address' ? location.text : LOCATION_TEXT[location.kind]}
        </AppText>
        {location.kind === 'denied' ? (
          <Chip label="Turn on" tone="primary" onPress={onEnableLocation} accessibilityLabel="Turn on location" />
        ) : null}
        {location.kind === 'unavailable' ? (
          <Chip label="Retry" tone="primary" onPress={onEnableLocation} accessibilityLabel="Retry location" />
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[2],
  },
  avatarTarget: { minWidth: layout.touchTargetIOS, minHeight: layout.touchTargetIOS, justifyContent: 'center' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: space[1], minHeight: 24 },
  locationText: { flex: 1, minWidth: 0 },
});

export default HomeHeader;
