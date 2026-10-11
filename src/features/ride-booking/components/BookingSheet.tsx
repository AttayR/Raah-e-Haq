import React from 'react';
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { useKeyboardHeight } from '../../../hooks/useKeyboardHeight';
import { radius, space } from '../../../theme';
import { MAP_TOP_CONTROLS_HEIGHT } from './MapTopControls';

type Props = {
  children: React.ReactNode;
  /** Reports the sheet's height so the map keeps its points above it (T-314). */
  onHeightChange?: (height: number) => void;
  /**
   * Cap as a share of the window (e.g. 0.5) so the route stays visible above the sheet on the
   * vehicle / fare / ride steps (DESIGN_SYSTEM 5.14). Content scrolls inside.
   */
  maxHeightRatio?: number;
  testID?: string;
};

/**
 * The booking map's bottom sheet (DESIGN_SYSTEM 5.14): `surface`, top radius 24, upward
 * shadow, bottom safe-area inset. It never grows under the map controls; longer content
 * scrolls inside. On iOS it rides above the keyboard (Android resizes the window itself,
 * `adjustResize`), so search suggestions stay visible while typing.
 */
export const BookingSheet: React.FC<Props> = ({ children, onHeightChange, maxHeightRatio, testID = 'booking-sheet' }) => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const keyboardHeight = useKeyboardHeight();
  const keyboardOffset = Platform.OS === 'ios' ? keyboardHeight : 0;
  const keyboardUp = keyboardHeight > 0;
  const belowControls = windowHeight - insets.top - MAP_TOP_CONTROLS_HEIGHT - space[4] - keyboardOffset;
  // The ratio cap applies only while the keyboard is down (typing needs the room).
  const ratioCap = maxHeightRatio && !keyboardUp ? windowHeight * maxHeightRatio : Infinity;
  const maxHeight = Math.max(0, Math.min(belowControls, ratioCap));

  return (
    <View
      testID={testID}
      onLayout={(e: LayoutChangeEvent) => onHeightChange?.(e.nativeEvent.layout.height)}
      style={[
        styles.sheet,
        theme.elevation[3],
        {
          bottom: keyboardOffset,
          maxHeight,
          backgroundColor: theme.colors.surface,
        },
        theme.mode === 'dark' ? { borderWidth: theme.borderWidth.thin, borderColor: theme.colors.border } : null,
      ]}
    >
      <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
      <ScrollView
        style={styles.scroll}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: (keyboardUp ? 0 : insets.bottom) + space[4] },
        ]}
      >
        {children}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    start: 0,
    end: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderBottomWidth: 0,
  },
  handle: { width: 36, height: 5, borderRadius: radius.pill, alignSelf: 'center', marginTop: space[2] },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: space[4], paddingTop: space[3], gap: space[3] },
});

export default BookingSheet;
