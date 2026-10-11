import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText } from '../../../components/ui/AppText';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { IconButton } from '../../../components/ui/IconButton';
import { Screen } from '../../../components/ui/Screen';
import { radius, space } from '../../../theme';

/** Inline danger banner (DESIGN_SYSTEM 5.17) for a booking error, dismissible. */
export const BookingErrorBanner: React.FC<{ message: string; onDismiss: () => void }> = ({ message, onDismiss }) => {
  const { theme } = useAppTheme();
  return (
    <View
      testID="booking-error"
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: theme.colors.dangerSoft }]}
    >
      <Icon name="warning" size={20} color="danger" />
      <AppText variant="bodySmall" color="danger" style={styles.bannerText}>
        {message}
      </AppText>
      <IconButton icon="close" iconColor="danger" accessibilityLabel="Dismiss error" onPress={onDismiss} />
    </View>
  );
};

/** Full-screen state while the booking map waits for (or is refused) the device location. */
export const LocationWaitState: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => {
  const { theme } = useAppTheme();
  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.wait}>
      <View style={[styles.iconCircle, { backgroundColor: theme.colors.primarySoft }]}>
        <Icon name="locationOff" size={48} color="primaryText" />
      </View>
      <AppText variant="h3" align="center">
        Finding your location
      </AppText>
      <AppText variant="bodySmall" color="textSecondary" align="center">
        Allow location access so drivers can find your pickup.
      </AppText>
      {onRetry ? (
        <Button label="Try again" variant="secondary" fullWidth={false} onPress={onRetry} testID="location-retry" />
      ) : null}
    </Screen>
  );
};

/** Placeholder where the map will draw (loading, or the map failed). */
export const MapPlaceholder: React.FC<{ message: string }> = ({ message }) => {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.mapPlaceholder, { backgroundColor: theme.colors.surfaceAlt }]}>
      <AppText variant="bodyStrong" color="textSecondary">
        {message}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, paddingStart: space[3], gap: space[2] },
  bannerText: { flex: 1, paddingVertical: space[3] },
  wait: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6], gap: space[3] },
  iconCircle: { width: 96, height: 96, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
