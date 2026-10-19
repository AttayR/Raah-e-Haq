import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { AppText, Button, Card, Icon } from '../../components/ui';
import { componentTokens, space } from '../../theme';
import { t } from '../../i18n';

type Props = { onOpenSettings: () => void; onRetry: () => void };

const k = componentTokens.locationNeeded;

/**
 * Driver Drive tab, location refused (UI-R8, shared-permissions "Denied state"): replaces the
 * online control. `warningSoft` circle with the location-off glyph, `h3` title, `bodySmall` body,
 * "Open Settings" (lg primary) and "Try again" (ghost, re-reads the permission).
 */
export function LocationNeededCard({ onOpenSettings, onRetry }: Props) {
  const { theme } = useAppTheme();
  return (
    <Card variant="outlined" testID="drive-location-needed">
      <View style={styles.column}>
        <View style={[styles.circle, { backgroundColor: theme.colors.warningSoft }]}>
          <Icon name="locationOff" size={k.glyph} color="warning" />
        </View>
        <AppText variant="h3" align="center" accessibilityRole="header">
          {t('permissions.driverDeniedTitle')}
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" align="center">
          {t('permissions.driverDeniedBody')}
        </AppText>
      </View>
      <View style={styles.actions}>
        <Button label={t('permissions.openSettings')} onPress={onOpenSettings} size="lg" testID="drive-location-open-settings" />
        <Button label={t('permissions.tryAgain')} onPress={onRetry} variant="ghost" size="lg" testID="drive-location-retry" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: space[2] },
  circle: { width: k.circle, height: k.circle, borderRadius: k.circle / 2, alignItems: 'center', justifyContent: 'center', marginBottom: space[2] },
  actions: { marginTop: space[4], gap: space[2] },
});
