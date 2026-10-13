import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../../i18n';
import { componentTokens, motion } from '../../theme';
import { IconButton } from './IconButton';

export type MapControlsProps = {
  /** Top-start floating back/close (48 visual, 44+ target) at x=16, y=insets.top+8. */
  onBack?: () => void;
  backIcon?: 'back' | 'close';
  backLabel?: string;
  /** End-side "locate me", 16 above the sheet's top edge. */
  onLocate?: () => void;
  locateLabel?: string;
  /** The sheet's visible height (`BottomSheet animatedHeight`), so locate rides with the sheet. */
  sheetHeight?: SharedValue<number>;
  /** Fades both controls out (`motion.fast`) and disables them, e.g. while the sheet is at `full` (§8.3). */
  hidden?: boolean;
  /** Hides locate only. */
  locateHidden?: boolean;
  testID?: string;
};

const c = componentTokens.mapControls;

/**
 * Map floating controls (DESIGN_SYSTEM §9 v1.1, §5.2 `overlay`): at most two per map screen,
 * back/close top-start and "locate me" end-side riding 16 above the sheet. No refresh, no zoom,
 * no "+": data refreshes itself and "add stop" is a sheet row. Render it as a sibling of the map
 * and the BottomSheet, inside a `Screen edges={[]}`.
 */
export function MapControls({
  onBack,
  backIcon = 'back',
  backLabel,
  onLocate,
  locateLabel,
  sheetHeight,
  hidden = false,
  locateHidden = false,
  testID = 'map-controls',
}: MapControlsProps) {
  const insets = useSafeAreaInsets();
  const fallback = useSharedValue(0);
  const height = sheetHeight ?? fallback;
  const visible = useDerivedValue(() => withTiming(hidden ? 0 : 1, { duration: motion.fast.duration }), [hidden]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: visible.value }));
  const locateStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -(height.value + c.sheetGap) }],
  }));
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, fadeStyle]}
      pointerEvents={hidden ? 'none' : 'box-none'}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      testID={testID}
    >
      {onBack ? (
        <View style={[styles.back, { top: insets.top + componentTokens.header.overlayControlTopOffset }]}>
          <IconButton
            icon={backIcon}
            variant="floating"
            onPress={onBack}
            accessibilityLabel={backLabel ?? (backIcon === 'close' ? t('common.close') : t('common.back'))}
            testID={`${testID}-back`}
          />
        </View>
      ) : null}
      {onLocate && !locateHidden ? (
        <Animated.View style={[styles.locate, locateStyle]}>
          <IconButton
            icon="locate"
            variant="floating"
            onPress={onLocate}
            accessibilityLabel={locateLabel ?? t('kit.locateA11y')}
            testID={`${testID}-locate`}
          />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  back: { position: 'absolute', start: c.edge },
  locate: { position: 'absolute', end: c.edge, bottom: 0 },
});
