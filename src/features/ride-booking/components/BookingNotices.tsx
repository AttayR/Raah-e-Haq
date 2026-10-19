import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText } from '../../../components/ui/AppText';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { IconButton } from '../../../components/ui/IconButton';
import { Screen } from '../../../components/ui/Screen';
import { radius, space } from '../../../theme';
import type { LocationErrorKind } from '../../../hooks/useNativeLocation';
import { BOOKING_COPY } from '../copy';

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
      <IconButton icon="close" iconColor="danger" accessibilityLabel={BOOKING_COPY.dismissErrorA11y} onPress={onDismiss} />
    </View>
  );
};

const waitCopy = (reason: LocationErrorKind | null | undefined): { title: string; body: string } => {
  if (reason === 'denied' || reason === 'disabled') {
    return { title: BOOKING_COPY.locationOffTitle, body: BOOKING_COPY.locationOffBody };
  }
  if (reason === 'unavailable') {
    return { title: BOOKING_COPY.locationUnavailableTitle, body: BOOKING_COPY.locationUnavailableBody };
  }
  return { title: BOOKING_COPY.locationWaitTitle, body: BOOKING_COPY.locationWaitBody };
};

/**
 * T-580: on the booking sheet while location is refused or off. The pickup field above stays
 * usable; the action asks the OS again when it still can, else opens Settings.
 */
export const LocationOffBanner: React.FC<{ onTurnOn: () => void }> = ({ onTurnOn }) => (
  <Banner
    tone="warning"
    icon="locationOff"
    title={BOOKING_COPY.locationOffTitle}
    text={BOOKING_COPY.locationOffManualBody}
    action={{ label: BOOKING_COPY.locationTurnOn, onPress: onTurnOn, testID: 'booking-location-turn-on' }}
    testID="booking-location-off"
  />
);

/**
 * Full-screen state while the booking map waits for (or is refused) the device location.
 * T-315: the reason comes from useNativeLocation and is shown here instead of an alert;
 * access that was refused or switched off offers the Settings page.
 */
export const LocationWaitState: React.FC<{
  onRetry?: () => void;
  reason?: LocationErrorKind | null;
  onOpenSettings?: () => void;
  /**
   * UI-R8: the OS may still ask (useNativeLocation `permissionStatus.canAskAgain`, e.g. after the
   * pre-prompt's "Not now"). Then "Try again" asks the OS and no Settings button is offered, as on
   * passenger Home.
   */
  canAskAgain?: boolean;
  /** T-580: the way out while waiting (booking is a pushed screen). */
  onBack?: () => void;
}> = ({ onRetry, reason, onOpenSettings, canAskAgain = false, onBack }) => {
  const { theme } = useAppTheme();
  const { title, body } = waitCopy(reason);
  const needsSettings = reason === 'disabled' || (reason === 'denied' && !canAskAgain);
  const settingsAction = needsSettings ? onOpenSettings : undefined;
  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.wait} testID="location-wait">
      {onBack ? (
        <View style={styles.back}>
          <IconButton icon="back" accessibilityLabel={BOOKING_COPY.backA11y} onPress={onBack} testID="location-wait-back" />
        </View>
      ) : null}
      <View style={[styles.iconCircle, { backgroundColor: theme.colors.primarySoft }]}>
        <Icon name="locationOff" size={48} color="primaryText" />
      </View>
      <AppText variant="h3" align="center" accessibilityRole="header">
        {title}
      </AppText>
      <AppText variant="bodySmall" color="textSecondary" align="center" accessibilityLiveRegion="polite">
        {body}
      </AppText>
      {settingsAction ? (
        <Button
          label={BOOKING_COPY.locationOpenSettings}
          fullWidth={false}
          onPress={settingsAction}
          testID="location-open-settings"
        />
      ) : null}
      {onRetry ? (
        <Button label={BOOKING_COPY.locationRetry} variant="secondary" fullWidth={false} onPress={onRetry} testID="location-retry" />
      ) : null}
    </Screen>
  );
};

/** Placeholder where the map will draw (loading, or the map failed). */
export const MapPlaceholder: React.FC<{ message: string }> = ({ message }) => {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.mapPlaceholder, { backgroundColor: theme.mapBackground }]}>
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
  back: { position: 'absolute', top: space[2], start: space[4] },
  iconCircle: { width: 96, height: 96, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
