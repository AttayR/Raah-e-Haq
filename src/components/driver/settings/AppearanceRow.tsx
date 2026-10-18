import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme, type AppearancePreference } from '../../../app/providers/ThemeProvider';
import { AppText, Icon, SegmentedControl, type SegmentOption } from '../../ui';
import { radius, space } from '../../../theme';
import { perLocale } from '../../../i18n';
import { DRIVER_SETTINGS_COPY } from './copy';

const options = perLocale((): ReadonlyArray<SegmentOption<AppearancePreference>> => [
  { value: 'system', label: DRIVER_SETTINGS_COPY.appearanceSystem },
  { value: 'light', label: DRIVER_SETTINGS_COPY.appearanceLight },
  { value: 'dark', label: DRIVER_SETTINGS_COPY.appearanceDark },
]);

/**
 * Appearance setting (DESIGN_SYSTEM §1.6): System / Light / Dark, persisted by ThemeProvider
 * (T-601). Inline segmented control instead of a picker sheet until T-608 ships BottomSheet.
 */
export function AppearanceRow() {
  const { theme, scheme, setScheme } = useAppTheme();
  return (
    <View style={styles.container} testID="settings-appearance">
      <View style={styles.titleRow}>
        <View style={[styles.tile, { backgroundColor: theme.colors.surfaceAlt }]}>
          <Icon name="theme" />
        </View>
        <AppText variant="body" style={styles.title}>
          {DRIVER_SETTINGS_COPY.appearance}
        </AppText>
      </View>
      <SegmentedControl
        options={options()}
        value={scheme}
        onChange={setScheme}
        accessibilityLabel={DRIVER_SETTINGS_COPY.appearance}
        testID="settings-appearance-control"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: space[4], gap: space[3] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  tile: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1 },
});
