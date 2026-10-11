import React from 'react';
import { ActivityIndicator, Linking, StyleSheet, Switch, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Button, IconButton, ListGroup, ListItem, Screen } from '../../../components/ui';
import { space } from '../../../theme';
import { NOTIFICATIONS_COPY } from '../copy';
import { useNotificationPreferences } from '../hooks';
import type { NotificationPreferenceKey } from '../types';

type Row = { key: NotificationPreferenceKey; title: string; subtitle?: string };

/** Under the master switch; disabled while push is off (the server ignores them then). */
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
  const { preferences, status, saving, reload, toggle } = useNotificationPreferences();

  const renderSwitch = (key: NotificationPreferenceKey, disabled: boolean) => (
    <Switch
      testID={`notification-pref-${key}`}
      value={preferences ? preferences[key] : false}
      onValueChange={(value) => {
        toggle(key, value);
      }}
      disabled={disabled || saving !== null}
      trackColor={{ true: theme.colors.primary, false: theme.colors.borderStrong }}
      ios_backgroundColor={theme.colors.borderStrong}
      thumbColor={theme.colors.surface}
    />
  );

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
            <ListItem
              icon="bell"
              title={NOTIFICATIONS_COPY.prefPushEnabled}
              trailing={renderSwitch('pushEnabled', false)}
            />
            {CATEGORY_ROWS.map((row) => (
              <ListItem
                key={row.key}
                title={row.title}
                subtitle={row.subtitle}
                trailing={renderSwitch(row.key, pushOff)}
                disabled={pushOff}
              />
            ))}
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
