import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText } from '../../../components/ui/AppText';
import { Icon } from '../../../components/ui/Icon';
import { radius, space } from '../../../theme';

/** The "Where to?" entry into booking (passenger-home.md block 3): 56 high, full width. */
export const WhereToBar: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const { theme } = useAppTheme();
  const dark = theme.mode === 'dark';
  const fill = dark ? theme.colors.surfaceRaised : theme.colors.surface;
  return (
    <Pressable
      testID="home-where-to"
      accessibilityRole="button"
      accessibilityLabel="Where to? Search destination"
      onPress={onPress}
      style={({ pressed }) => [
        styles.bar,
        { backgroundColor: pressed ? theme.colors.surfacePressed : fill, borderColor: theme.colors.border },
        dark ? { borderWidth: theme.borderWidth.thin } : theme.elevation[1],
      ]}
    >
      <Icon name="search" size={24} color="textSecondary" />
      <AppText variant="title" numberOfLines={1} style={styles.label}>
        Where to?
      </AppText>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  bar: {
    minHeight: 56,
    borderRadius: radius.md,
    paddingHorizontal: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  label: { flex: 1 },
});

export default WhereToBar;
