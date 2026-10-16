import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { t } from '../../../i18n';
import { componentTokens, radius, space } from '../../../theme';
import { AppText } from '../AppText';
import { Icon } from '../Icon';

const k = componentTokens.badge;

/**
 * The AC tier's pill (BE-86, T-522): a snowflake and "AC" in the `info` tone, on the vehicle
 * option, the live ride and the driver's request card. It never shrinks (like Badge).
 */
export function AcBadge({ testID }: { testID?: string }) {
  const { theme } = useAppTheme();
  return (
    <View
      accessible
      accessibilityLabel={t('ride.acBadgeA11y')}
      testID={testID}
      style={[styles.pill, { backgroundColor: theme.colors.infoSoft }]}
    >
      <Icon name="ac" size={componentTokens.chip.iconSize} color="info" />
      <AppText variant="label" color="info" numberOfLines={1}>
        {t('ride.acBadge')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: k.statusHeight,
    paddingHorizontal: space[2],
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    flexShrink: 0,
  },
});
