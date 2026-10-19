import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText, Button, Card, Icon } from '../../../components/ui';
import { space } from '../../../theme';
import { NOTIFICATIONS_COPY } from '../copy';
import { usePushPermission } from '../hooks';

/**
 * Contextual push prompt on the notifications screen (T-502): shown only while push is off.
 * The first tap shows the system prompt; after a denial it opens the phone settings.
 */
export function PushPermissionBanner({ style }: { style?: StyleProp<ViewStyle> } = {}) {
  const { permission, enable } = usePushPermission();
  if (permission === null || permission === 'granted') return null;
  return (
    <Card style={style} testID="notifications-push-banner">
      <View style={styles.row}>
        <Icon name="bell" color="primaryText" />
        <View style={styles.text}>
          <AppText variant="title">{NOTIFICATIONS_COPY.pushBannerTitle}</AppText>
          <AppText variant="bodySmall" color="textSecondary">
            {NOTIFICATIONS_COPY.pushBannerBody}
          </AppText>
        </View>
      </View>
      <View style={styles.action}>
        <Button
          size="sm"
          variant="secondary"
          label={permission === 'denied' ? NOTIFICATIONS_COPY.pushBannerSettings : NOTIFICATIONS_COPY.pushBannerAction}
          onPress={() => {
            enable();
          }}
          testID="notifications-push-enable"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  text: { flex: 1, minWidth: 0, gap: space[1] },
  action: { marginTop: space[3], flexDirection: 'row', justifyContent: 'flex-end' },
});
