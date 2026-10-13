import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { haptics } from '../../core/haptics';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { componentTokens, motion } from '../../theme';
import { AppText } from './AppText';
import { Badge } from './Badge';
import { Icon, type IconName } from './Icon';

export type TabBarItem = {
  /** Route name; also the item's testID suffix (`tab-<key>`). */
  key: string;
  label: string;
  /** Outline glyph (inactive) and filled glyph (active); the same name when there is no outline. */
  icon: IconName;
  activeIcon: IconName;
  /** Count badge on the indicator pill; 0 or undefined shows nothing (§5.12). */
  badgeCount?: number;
  /** Read instead of the label when the badge shows ("Inbox, 3 unread"). */
  badgeAccessibilityLabel?: string;
};

export type TabBarProps = {
  items: ReadonlyArray<TabBarItem>;
  activeKey: string;
  /** Called for a tap on a tab that is not the active one, and for a re-tap (scroll to top). */
  onSelect: (key: string) => void;
  onLongPress?: (key: string) => void;
  /** Full-screen moments (an incoming ride request) hide the bar entirely (§5.3, §8.3). */
  hidden?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

const k = componentTokens.tabBar;

/**
 * Tab bar (DESIGN_SYSTEM §5.3 v1.1), shared by both roles: 60 high plus the bottom inset,
 * `surface` fill, top hairline `border`, no shadow, equal-width items (min 64). Each item is a
 * 56×32 indicator pill around the 24 glyph, 4 above a `caption` label, 6 bottom padding.
 * Active: `primarySoft` pill (width 32→56 and opacity 0→1 in `motion.fast`), filled glyph in
 * `onPrimarySoft`, 600 label in `primaryText`. Inactive: outline glyph and 500 label in
 * `textMuted`. A count Badge sits on the pill's top-end corner. Changing tab fires the
 * `selection` haptic. Reduced motion: the pill appears without animating.
 */
export function TabBar({
  items,
  activeKey,
  onSelect,
  onLongPress,
  hidden = false,
  accessibilityLabel,
  testID = 'tab-bar',
}: TabBarProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  if (hidden) {
    return null;
  }
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        styles.bar,
        {
          paddingBottom: insets.bottom,
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: theme.borderWidth.hairline,
        },
      ]}
    >
      {items.map(item => (
        <TabBarButton
          key={item.key}
          item={item}
          active={item.key === activeKey}
          onPress={() => {
            if (item.key !== activeKey) haptics.selection();
            onSelect(item.key);
          }}
          onLongPress={onLongPress ? () => onLongPress(item.key) : undefined}
        />
      ))}
    </View>
  );
}

type ButtonProps = { item: TabBarItem; active: boolean; onPress: () => void; onLongPress?: () => void };

function TabBarButton({ item, active, onPress, onLongPress }: ButtonProps) {
  const { theme } = useAppTheme();
  const reduce = useReducedMotion();
  const progress = useDerivedValue(
    () => withTiming(active ? 1 : 0, { duration: reduce ? 0 : motion.fast.duration }),
    [active, reduce],
  );
  const pillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    width: interpolate(progress.value, [0, 1], [k.indicatorWidthFrom, k.indicatorWidth]),
  }));
  const badge = item.badgeCount ?? 0;
  const label = badge > 0 && item.badgeAccessibilityLabel ? item.badgeAccessibilityLabel : item.label;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={styles.item}
      testID={`tab-${item.key}`}
    >
      <View style={styles.indicator}>
        <Animated.View
          style={[styles.pill, { backgroundColor: theme.colors.primarySoft }, pillStyle]}
          testID={active ? `tab-${item.key}-pill` : undefined}
        />
        <Icon
          name={active ? item.activeIcon : item.icon}
          size={24}
          color={active ? 'onPrimarySoft' : 'textMuted'}
          testID={`tab-${item.key}-icon`}
        />
        {badge > 0 ? (
          <View style={styles.badge} pointerEvents="none">
            <Badge variant="count" count={badge} testID={`tab-${item.key}-badge`} />
          </View>
        ) : null}
      </View>
      <AppText
        variant={active ? 'captionStrong' : 'caption'}
        color={active ? 'primaryText' : 'textMuted'}
        numberOfLines={1}
        // Labels shrink before they clip at large font scales (§2).
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={styles.label}
      >
        {item.label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row' },
  item: {
    flex: 1,
    minWidth: k.itemMinWidth,
    minHeight: k.height,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: k.bottomPadding,
  },
  indicator: {
    width: k.indicatorWidth,
    height: k.indicatorHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: { position: 'absolute', height: k.indicatorHeight, borderRadius: k.indicatorRadius },
  badge: { position: 'absolute', top: k.badgeOffsetY, end: -k.badgeOffsetX },
  label: { marginTop: k.labelGap, maxWidth: '100%' },
});
