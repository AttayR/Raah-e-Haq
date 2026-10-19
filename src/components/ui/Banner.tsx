import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { t } from '../../i18n';
import { radius, space, type SemanticColorName } from '../../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type BannerTone = 'info' | 'warning' | 'danger' | 'success';

export type BannerProps = {
  tone?: BannerTone;
  /** Leading 20 glyph; defaults per tone. */
  icon?: IconName;
  title?: string;
  text: string;
  /** Optional trailing text action ("Retry", "Update"). */
  action?: { label: string; onPress: () => void; testID?: string };
  /**
   * Where the action sits: `end` (default, a short line like "Retry") or `below` the text, so a
   * long message (an email address, a phone number) keeps the full width and never wraps mid-word
   * in a narrow column (T-545).
   */
  actionPlacement?: 'end' | 'below';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const fills: Record<BannerTone, SemanticColorName> = {
  info: 'infoSoft',
  warning: 'warningSoft',
  danger: 'dangerSoft',
  success: 'successSoft',
};

const defaultIcons: Record<BannerTone, IconName> = {
  info: 'info',
  warning: 'warning',
  danger: 'warning',
  success: 'check',
};

/**
 * Inline Banner (DESIGN_SYSTEM §5.17): full width inside content, radius 12, padding 12/16, tone
 * fill (`infoSoft`, `warningSoft`, `dangerSoft`, `successSoft`), a leading 20 glyph and
 * `bodySmall` text in the tone colour (≥4.5:1 on its soft fill in both modes, §1.5), an optional
 * `label` title and a trailing text action. Warning and danger banners are announced politely.
 */
export function Banner({ tone = 'info', icon, title, text, action, actionPlacement = 'end', style, testID }: BannerProps) {
  const { theme } = useAppTheme();
  const urgent = tone === 'warning' || tone === 'danger';
  const below = actionPlacement === 'below';
  const actionButton = action ? (
    <Pressable
      onPress={action.onPress}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      // 24 visual + 10 slop each side = a 44 target.
      hitSlop={10}
      style={below ? styles.actionBelow : styles.action}
      testID={action.testID}
    >
      <AppText variant="buttonSmall" color={tone} numberOfLines={below ? undefined : 1}>
        {action.label}
      </AppText>
    </Pressable>
  ) : null;
  return (
    <View
      testID={testID}
      accessibilityLiveRegion={urgent ? 'polite' : 'none'}
      style={[styles.banner, { backgroundColor: theme.colors[fills[tone]] }, style]}
    >
      <Icon name={icon ?? defaultIcons[tone]} size={20} color={tone} />
      <View style={styles.text}>
        <View accessible accessibilityRole={urgent ? 'alert' : 'text'} style={styles.copy}>
          {title ? (
            <AppText variant="label" color={tone}>
              {title}
            </AppText>
          ) : null}
          <AppText variant="bodySmall" color={tone}>
            {text}
          </AppText>
        </View>
        {below ? actionButton : null}
      </View>
      {below ? null : actionButton}
    </View>
  );
}

/**
 * Offline banner (§5.17): `warningSoft`, `wifi-off`, "You're offline. Showing saved info."
 * Renders only while NetInfo reports no connection; place it under the Header (or at the top of
 * a map below the status bar).
 */
/**
 * True only while NetInfo reports no connection. `null` (not known yet) counts as online, so a
 * banner never flashes and an action is never disabled on launch (UI-R10).
 */
export function useIsOffline(): boolean {
  const { isConnected, isInternetReachable } = useNetInfo();
  return isConnected === false || isInternetReachable === false;
}

export function OfflineBanner({ style, testID = 'offline-banner' }: { style?: StyleProp<ViewStyle>; testID?: string }) {
  const offline = useIsOffline();
  if (!offline) {
    return null;
  }
  return <Banner tone="warning" icon="offline" text={t('kit.offline')} style={style} testID={testID} />;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: radius.md,
  },
  text: { flex: 1, minWidth: 0, gap: space[2] },
  copy: { gap: space[1] / 2 },
  action: { minHeight: space[6], justifyContent: 'center', alignSelf: 'center' },
  actionBelow: { minHeight: space[6], justifyContent: 'center', alignSelf: 'flex-start' },
});
