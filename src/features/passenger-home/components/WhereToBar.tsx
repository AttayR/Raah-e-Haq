import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText } from '../../../components/ui/AppText';
import { Icon } from '../../../components/ui/Icon';
import { radius, space } from '../../../theme';
import { t } from '../../../i18n';

/** The "Where to?" entry into booking (§8.3 Home sheet: 52 high, full width). */
/** §8.3 peek arithmetic: the field is 52. */
export const WHERE_TO_HEIGHT = 52;

export const WhereToBar: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const { theme } = useAppTheme();
  const dark = theme.mode === 'dark';
  const fill = dark ? theme.colors.surfaceRaised : theme.colors.surface;
  return (
    <Pressable
      testID="home-where-to"
      accessibilityRole="button"
      accessibilityLabel={t('home.whereToA11y')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.bar,
        { backgroundColor: pressed ? theme.colors.surfacePressed : fill, borderColor: theme.colors.border },
        dark ? { borderWidth: theme.borderWidth.thin } : theme.elevation[1],
      ]}
    >
      <Icon name="search" size={24} color="textSecondary" />
      <AppText variant="title" numberOfLines={1} style={styles.label}>
        {t('home.whereTo')}
      </AppText>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  bar: {
    minHeight: WHERE_TO_HEIGHT,
    borderRadius: radius.md,
    paddingHorizontal: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  label: { flex: 1 },
});

export default WhereToBar;
