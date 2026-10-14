import React from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Button, IconButton, ListGroup, ListItem, Screen, Switch } from '../../../components/ui';
import { haptics } from '../../../core/haptics';
import { space } from '../../../theme';
import { NOTIFICATIONS_COPY } from '../copy';
import { useNotificationPreferences } from '../hooks';
import type { NotificationPreferenceKey } from '../types';

type Row = { key: NotificationPreferenceKey; title: string; subtitle?: string };

/**
 * Under the master switch. While push is off they are disabled and drawn off (no push is sent for
 * them then); their stored values are kept and show again when push is turned back on.
 */
const CATEGORY_ROWS: readonly Row[] = [
  { key: 'rideUpdates', title: NOTIFICATIONS_COPY.prefRideUpdates, subtitle: NOTIFICATIONS_COPY.prefRideUpdatesSubtitle },
  { key: 'chat', title: NOTIFICATIONS_COPY.prefChat, subtitle: NOTIFICATIONS_COPY.prefChatSubtitle },
  { key: 'promotions', title: NOTIFICATIONS_COPY.prefPromotions },
  { key: 'soundAlerts', title: NOTIFICATIONS_COPY.prefSoundAlerts, subtitle: NOTIFICATIONS_COPY.prefSoundAlertsSubtitle },
];

/**
 * Settings → Notifications for both roles (T-502, BE-11): the five push switches from
 * GET/PUT /notifications/preferences, and the phone's own notification settings.
 */
export function NotificationPreferencesScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation();
  const { preferences, status, reload, toggle } = useNotificationPreferences();

  /**
   * One switch row: the whole row toggles (not only the thumb), and the kit Switch's 64x44 slot
   * is the full touch target. Never locked while a save is in flight: the hook queues changes.
   * A disabled row shows off whatever is stored, so a category never looks on while push is off.
   */
  const renderRow = (key: NotificationPreferenceKey, title: string, disabled: boolean, subtitle?: string, icon?: 'bell') => {
    const value = !disabled && preferences ? preferences[key] : false;
    return (
      <ListItem
        key={key}
        icon={icon}
        title={title}
        subtitle={subtitle}
        disabled={disabled}
        onPress={() => {
          haptics.selection();
          toggle(key, !value);
        }}
        accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
        checked={value}
        trailing={
          <Switch
            testID={`notification-pref-${key}`}
            value={value}
            onValueChange={(next) => {
              toggle(key, next);
            }}
            accessibilityLabel={title}
            disabled={disabled}
          />
        }
        testID={`notification-pref-${key}-row`}
      />
    );
  };

  const pushOff = !preferences?.pushEnabled;

  return (
    <Screen scroll contentStyle={styles.content} testID="notification-preferences">
      <View style={styles.header}>
        <IconButton
          icon="back"
          accessibilityLabel={NOTIFICATIONS_COPY.back}
          onPress={() => navigation.goBack()}
          testID="notification-preferences-back"
        />
        <AppText variant="h2" accessibilityRole="header" style={styles.title}>
          {NOTIFICATIONS_COPY.preferencesTitle}
        </AppText>
      </View>

      {status === 'loading' && !preferences ? (
        <View style={styles.centered} testID="notification-preferences-loading">
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}

      {status === 'failed' && !preferences ? (
        <View style={styles.centered} testID="notification-preferences-error">
          <AppText variant="body" align="center">
            {NOTIFICATIONS_COPY.preferencesLoadFailed}
          </AppText>
          <Button label={NOTIFICATIONS_COPY.retry} variant="outline" onPress={reload} />
        </View>
      ) : null}

      {preferences ? (
        <>
          <ListGroup title={NOTIFICATIONS_COPY.preferencesPushGroup}>
            {renderRow('pushEnabled', NOTIFICATIONS_COPY.prefPushEnabled, false, undefined, 'bell')}
            {CATEGORY_ROWS.map((row) => renderRow(row.key, row.title, pushOff, row.subtitle))}
          </ListGroup>
          <AppText variant="bodySmall" color="textSecondary" style={styles.hint}>
            {NOTIFICATIONS_COPY.preferencesHint}
          </AppText>
        </>
      ) : null}

      <ListGroup>
        <ListItem
          icon="settings"
          title={NOTIFICATIONS_COPY.phoneSettings}
          subtitle={NOTIFICATIONS_COPY.phoneSettingsSubtitle}
          onPress={() => {
            Linking.openSettings();
          }}
          testID="notification-preferences-phone-settings"
        />
      </ListGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[6],
    gap: space[6],
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  title: { flex: 1, minWidth: 0 },
  centered: { alignItems: 'center', gap: space[3], paddingVertical: space[8] },
  hint: { marginTop: -space[4], marginHorizontal: space[4] },
});
