import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { layout, space } from '../../theme';
import { AppText } from './AppText';

type Props = {
  title: string;
  /** Optional trailing text action ("See all"). */
  actionLabel?: string;
  onAction?: () => void;
  actionAccessibilityLabel?: string;
  testID?: string;
};

/** Section title in `overline` with an optional trailing text action (DESIGN_SYSTEM 5.8). */
export const SectionHeader: React.FC<Props> = ({ title, actionLabel, onAction, actionAccessibilityLabel, testID }) => (
  <View style={styles.row} testID={testID}>
    <AppText variant="overline" color="textMuted" accessibilityRole="header" numberOfLines={1} style={styles.title}>
      {title}
    </AppText>
    {actionLabel && onAction ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
        onPress={onAction}
        hitSlop={space[2]}
        style={styles.action}
      >
        <AppText variant="buttonSmall" color="primaryText" numberOfLines={1}>
          {actionLabel}
        </AppText>
      </Pressable>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], minHeight: 32 },
  title: { flex: 1 },
  action: { minHeight: layout.touchTargetIOS - space[3], justifyContent: 'center' },
});

export default SectionHeader;
