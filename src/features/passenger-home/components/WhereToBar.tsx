import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText } from '../../../components/ui/AppText';
import { Icon } from '../../../components/ui/Icon';
import { usePressScale } from '../../../components/ui/usePressScale';
import { componentTokens, radius } from '../../../theme';
import { t } from '../../../i18n';

const h = componentTokens.home;

/**
 * The "Where to?" hero (UI-R20b, passenger-home V4): the first control in the sheet. A 56 min
 * pill on `surfaceAlt` (pressed `surfaceAltPressed` + the 0.98 scale, §6.1), no shadow in either
 * mode (nothing inside a sheet is elevated). A 32 navy search disc with the 20 `onPrimary` glyph
 * 12 in from the start, then "Where to?" in `h3`. It books a ride: label "Where to? Book a ride
 * within the city". Memoised: one stable handler.
 */
function WhereToBarBase({ onPress }: { onPress: () => void }) {
  const { theme } = useAppTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        testID="home-where-to"
        accessibilityRole="button"
        accessibilityLabel={t('home.whereToA11y')}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={({ pressed }) => [
          styles.bar,
          { backgroundColor: pressed ? theme.colors.surfaceAltPressed : theme.colors.surfaceAlt },
        ]}
      >
        <View style={[styles.disc, { backgroundColor: theme.colors.primary }]} testID="home-where-to-disc">
          <Icon name="search" size={h.whereToGlyph} color="onPrimary" />
        </View>
        <AppText variant="h3" numberOfLines={1} style={styles.label}>
          {t('home.whereTo')}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

export const WhereToBar = memo(WhereToBarBase);

const styles = StyleSheet.create({
  bar: {
    minHeight: h.whereToHeight,
    borderRadius: radius.pill,
    paddingHorizontal: h.whereToInset,
    flexDirection: 'row',
    alignItems: 'center',
    gap: h.whereToInset,
  },
  disc: {
    width: h.whereToDisc,
    height: h.whereToDisc,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
});

export default WhereToBar;
