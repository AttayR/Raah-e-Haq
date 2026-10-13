import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { t } from '../../i18n';
import { componentTokens, motion } from '../../theme';
import { Avatar } from './Avatar';
import { IconButton } from './IconButton';

export type MapControlsProps = {
  /** Top-start floating back/close (48 visual, 44+ target) at x=16, y=insets.top+8. */
  onBack?: () => void;
  backIcon?: 'back' | 'close';
  backLabel?: string;
  /**
   * Tab-root maps (Home, Drive; §8.3): the signed-in user's 48 avatar top-start instead of a back
   * button, opening the profile. Ignored when `onBack` is set.
   */
  avatar?: { name?: string | null; uri?: string | null; onPress: () => void; accessibilityLabel: string };
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
 * back/close (or, on the Home/Drive tab maps, the user's avatar, §8.3) top-start and "locate me"
 * end-side riding 16 above the sheet. No refresh, no zoom,
 * no "+": data refreshes itself and "add stop" is a sheet row. Render it as a sibling of the map
 * and the BottomSheet, inside a `Screen edges={[]}`.
 */
export function MapControls({
  onBack,
  backIcon = 'back',
  backLabel,
  avatar,
  onLocate,
  locateLabel,
  sheetHeight,
  hidden = false,
  locateHidden = false,
  testID = 'map-controls',
}: MapControlsProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
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
      ) : avatar ? (
        <View style={[styles.back, { top: insets.top + componentTokens.header.overlayControlTopOffset }]}>
          <Pressable
            onPress={avatar.onPress}
            accessibilityRole="button"
            accessibilityLabel={avatar.accessibilityLabel}
            style={({ pressed }) => [
              styles.avatar,
              { backgroundColor: theme.colors.surface },
              theme.elevation[2],
              pressed ? styles.pressed : null,
            ]}
            testID={`${testID}-avatar`}
          >
            <Avatar name={avatar.name} uri={avatar.uri} size={48} />
          </Pressable>
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
  // 48 visual like a floating IconButton, with its elevation so a photo lifts off the map.
  avatar: { borderRadius: componentTokens.iconButton.floatingVisual },
  pressed: { opacity: 0.85 },
  locate: { position: 'absolute', end: c.edge, bottom: 0 },
});
