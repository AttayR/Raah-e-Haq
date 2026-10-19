import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import type { AutoAcceptSettings } from '../../../features/driver-auto-accept/api';
import { autoAcceptSubtitle } from '../../../features/driver-auto-accept/format';
import type { AutoAcceptLoad } from '../../../features/driver-auto-accept/slice';
import { t } from '../../../i18n';
import { componentTokens, radius, space } from '../../../theme';
import { AppText, Icon, Skeleton, Switch } from '../../ui';

/** §7.1: the row is 56 tall (the peek is sized for it). */
export const AUTO_ACCEPT_ROW_HEIGHT = 56;
const SKELETON_WIDTH = 120;
const SKELETON_HEIGHT = 12;

type Props = {
  settings: AutoAcceptSettings | null;
  loadStatus: AutoAcceptLoad;
  /** The driver is online (also on a ride): the subtitle names the live filters. */
  online: boolean;
  saving: boolean;
  onOpen: () => void;
  onSwitch: (value: boolean) => void;
  onRetry: () => void;
};

/**
 * The Drive sheet's auto-accept row (map-vehicles.md §7.1): `surfaceAlt` container, flash icon,
 * "Auto-accept" + one-line subtitle, kit Switch. Tap the row for the settings sheet. Loading:
 * skeleton subtitle, switch disabled. Error: "Couldn't load auto-accept" and a tap retries. Not
 * allowed by the server: its message, the row dimmed and the switch disabled (unless it is still
 * on, so the driver can always turn it off).
 */
export function AutoAcceptRow({ settings, loadStatus, online, saving, onOpen, onSwitch, onRetry }: Props) {
  const { theme } = useAppTheme();
  const on = settings?.enabled === true;
  const failed = settings === null && loadStatus === 'failed';
  const loading = settings === null && !failed;
  const refused = settings !== null && !settings.available;
  const switchDisabled = loading || failed || saving || (refused && !on);
  const subtitle = settings ? autoAcceptSubtitle(settings, online) : failed ? t('autoAccept.loadFailed') : '';

  // Two focus targets (VoiceOver/TalkBack): the row button (settings, or retry) and the Switch.
  // One accessible container would hide the Switch from assistive tech.
  return (
    <View style={[styles.row, { backgroundColor: theme.colors.surfaceAlt }]} testID="auto-accept-row-container">
      <Pressable
        onPress={failed ? onRetry : onOpen}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={`${t('autoAccept.title')}, ${subtitle}`}
        accessibilityHint={failed ? t('autoAccept.retryHint') : t('autoAccept.openSettingsHint')}
        style={[styles.main, refused ? styles.refused : null]}
        testID="auto-accept-row"
      >
        <Icon name={on ? 'autoAccept' : 'autoAcceptOff'} color={on ? 'primaryText' : 'textSecondary'} />
        <View style={styles.text}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {t('autoAccept.title')}
          </AppText>
          {loading ? (
            <Skeleton width={SKELETON_WIDTH} height={SKELETON_HEIGHT} testID="auto-accept-row-loading" />
          ) : (
            <AppText
              variant="caption"
              color="textSecondary"
              numberOfLines={1}
              ellipsizeMode="tail"
              testID="auto-accept-row-subtitle"
            >
              {subtitle}
            </AppText>
          )}
        </View>
      </Pressable>
      <Switch
        value={on}
        onValueChange={onSwitch}
        disabled={switchDisabled}
        accessibilityLabel={t('autoAccept.title')}
        testID="auto-accept-switch"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: AUTO_ACCEPT_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderRadius: radius.md,
    paddingStart: space[4],
  },
  main: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
  },
  refused: { opacity: componentTokens.state.disabledOpacity },
  text: { flex: 1, minWidth: 0, gap: space[0] },
});
