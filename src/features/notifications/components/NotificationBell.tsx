import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, IconButton } from '../../../components/ui';
import type { SemanticColorName } from '../../../theme';
import { NOTIFICATIONS_COPY } from '../copy';
import { unreadBadgeLabel, useUnreadNotificationCount } from '../hooks';

export type NotificationBellProps = {
  onPress: () => void;
  iconColor?: SemanticColorName;
  variant?: 'plain' | 'tonal' | 'floating';
  testID?: string;
};

/**
 * Bell with the unread count (T-502), for a screen header (e.g. passenger Home). It only
 * reads the store: the count is kept fresh by useNotificationsSync in the role stack.
 */
export function NotificationBell({ onPress, iconColor = 'textPrimary', variant = 'plain', testID }: NotificationBellProps) {
  const { theme } = useAppTheme();
  const count = useUnreadNotificationCount();
  const label = unreadBadgeLabel(count);
  return (
    <View>
      <IconButton
        icon="bell"
        variant={variant}
        iconColor={iconColor}
        onPress={onPress}
        accessibilityLabel={label ? `${NOTIFICATIONS_COPY.title}, ${label} ${NOTIFICATIONS_COPY.unreadA11y.toLowerCase()}` : NOTIFICATIONS_COPY.title}
        testID={testID}
      />
      {label ? (
        <View
          pointerEvents="none"
          style={[styles.badge, { backgroundColor: theme.colors.dangerFill, borderColor: theme.colors.surface }]}
          testID={testID ? `${testID}-badge` : undefined}
        >
          <AppText variant="numericSmall" color="onPrimary" maxFontSizeMultiplier={1}>
            {label}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -2,
    end: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
