import React from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText } from '../../../components/ui';
import { componentTokens, radius, space } from '../../../theme';
import { BOOKING_COPY } from '../copy';

const k = componentTokens.mapControls;
const FLOATING = componentTokens.iconButton.floatingVisual;
/** passenger-vehicle-fare.md "On the map" 2: 48 high, at most 260 wide. */
const PILL_MAX_WIDTH = 260;

type Props = {
  /** "18 min · 8.2 km" from the server estimate. */
  summary: string;
  /** Back to the search to edit the trip. */
  onPress: () => void;
};

/**
 * The route summary pill centred at the top of the choose-ride map (passenger-vehicle-fare.md):
 * `surface`, pill radius, `elevation.2`, the estimate's duration and distance in `numeric`. It is
 * not a map control (§9 counts back and locate only): it never overlaps the back button, so on a
 * narrow phone it narrows instead (the text shrinks to fit, one line).
 */
export const RouteSummaryPill: React.FC<Props> = ({ summary, onPress }) => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Clear of the 48 back button (and its 16 edge) on both sides, plus an 8 gap.
  const maxWidth = Math.min(PILL_MAX_WIDTH, width - 2 * (k.edge + FLOATING + space[2]));
  return (
    <View pointerEvents="box-none" style={[styles.row, { top: insets.top + componentTokens.header.overlayControlTopOffset }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={BOOKING_COPY.routeSummaryA11y(summary)}
        style={({ pressed }) => [
          styles.pill,
          theme.elevation[2],
          { maxWidth, backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.surface },
        ]}
        testID="route-summary-pill"
      >
        <AppText variant="numeric" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {summary}
        </AppText>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { position: 'absolute', start: 0, end: 0, alignItems: 'center' },
  pill: {
    height: FLOATING,
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
