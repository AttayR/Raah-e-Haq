import React, { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText } from '../../../components/ui/AppText';
import { Icon } from '../../../components/ui/Icon';
import { radius, space } from '../../../theme';
import { t } from '../../../i18n';

/** §8.3 peek arithmetic: the field is 52. */
export const WHERE_TO_HEIGHT = 52;

/**
 * The "Where to?" entry into booking (passenger-home block 3, §8.3; UI-R9): a 52-high field-like
 * button, full width, radius `md`, `surfaceAlt` fill (`surfaceAltPressed` while pressed) in both
 * modes, no shadow: it reads as the search field it opens, not as a floating card. Magnifier 24
 * `textSecondary` at 16, label in `title` 12 after it.
 */
function WhereToBarBase({ onPress }: { onPress: () => void }) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      testID="home-where-to"
      accessibilityRole="button"
      accessibilityLabel={t('home.whereToA11y')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.bar,
        { backgroundColor: pressed ? theme.colors.surfaceAltPressed : theme.colors.surfaceAlt },
      ]}
    >
      <Icon name="search" size={24} color="textSecondary" />
      <AppText variant="title" numberOfLines={1} style={styles.label}>
        {t('home.whereTo')}
      </AppText>
    </Pressable>
  );
}

export const WhereToBar = memo(WhereToBarBase);

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
