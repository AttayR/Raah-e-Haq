import React, { memo, useCallback, useRef } from 'react';
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
 * The bar's face: the 32 navy search disc and "Where to?" in `h3`. Shared by the bar and the
 * moving copy that carries it to the top of the planner (UI-R9b, `WhereToGhost`).
 */
export function WhereToFace({ discTestID }: { discTestID?: string }) {
  const { theme } = useAppTheme();
  return (
    <>
      <View style={[styles.disc, { backgroundColor: theme.colors.primary }]} testID={discTestID}>
        <Icon name="search" size={h.whereToGlyph} color="onPrimary" />
      </View>
      <AppText variant="h3" numberOfLines={1} style={styles.label}>
        {t('home.whereTo')}
      </AppText>
    </>
  );
}

/**
 * The "Where to?" hero (UI-R20b, passenger-home V4): the first control in the sheet. A 56 min
 * pill on `surfaceAlt` (pressed `surfaceAltPressed` + the 0.98 scale, §6.1), no shadow in either
 * mode (nothing inside a sheet is elevated). A 32 navy search disc with the 20 `onPrimary` glyph
 * 12 in from the start, then "Where to?" in `h3`. It books a ride: label "Where to? Book a ride
 * within the city". UI-R9b: the press hands over the bar's window y (measured when the finger
 * lands, so the tap never waits for it; null if it has not answered yet), where the planner's
 * shared-element move starts. Memoised: one stable handler.
 */
function WhereToBarBase({ onPress }: { onPress: (top: number | null) => void }) {
  const { theme } = useAppTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const ref = useRef<View | null>(null);
  const top = useRef<number | null>(null);
  const pressIn = useCallback(() => {
    onPressIn();
    top.current = null;
    ref.current?.measureInWindow?.((_x, y) => {
      top.current = Number.isFinite(y) ? y : null;
    });
  }, [onPressIn]);
  const press = useCallback(() => {
    onPress(top.current);
    top.current = null;
  }, [onPress]);
  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        ref={ref}
        testID="home-where-to"
        accessibilityRole="button"
        accessibilityLabel={t('home.whereToA11y')}
        onPress={press}
        onPressIn={pressIn}
        onPressOut={onPressOut}
        style={({ pressed }) => [
          styles.bar,
          { backgroundColor: pressed ? theme.colors.surfaceAltPressed : theme.colors.surfaceAlt },
        ]}
      >
        <WhereToFace discTestID="home-where-to-disc" />
      </Pressable>
    </Animated.View>
  );
}

export const WhereToBar = memo(WhereToBarBase);

export const whereToBarStyles = StyleSheet.create({
  bar: {
    minHeight: h.whereToHeight,
    borderRadius: radius.pill,
    paddingHorizontal: h.whereToInset,
    flexDirection: 'row',
    alignItems: 'center',
    gap: h.whereToInset,
  },
});

const styles = StyleSheet.create({
  bar: whereToBarStyles.bar,
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
