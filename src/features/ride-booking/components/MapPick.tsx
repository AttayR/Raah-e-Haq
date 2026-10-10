import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { radius, space, textStyles } from '../../../theme';
import { BOOKING_COPY } from '../copy';
import type { MapPickTarget } from '../mapTap';

/** Turns on the explicit "choose on map" mode (T-304, PAX-14). */
export const ChooseOnMapButton: React.FC<{ label?: string; onPress: () => void; testID?: string }> = ({
  label = BOOKING_COPY.chooseOnMap,
  onPress,
  testID = 'choose-on-map',
}) => {
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.pill, { backgroundColor: theme.colors.surfaceAlt }]}
    >
      <Text style={[styles.pillText, { color: theme.colors.primaryText }]}>{label}</Text>
    </TouchableOpacity>
  );
};

/** While the mode is on: what the next tap does, and a way out. */
export const MapPickBanner: React.FC<{ target: MapPickTarget; onCancel: () => void }> = ({ target, onCancel }) => {
  const { theme } = useAppTheme();
  return (
    <View
      testID="map-pick-banner"
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: theme.colors.infoSoft }]}
    >
      <Text style={[styles.bannerText, { color: theme.colors.textPrimary }]}>{BOOKING_COPY.mapPickHint(target)}</Text>
      <TouchableOpacity accessibilityRole="button" onPress={onCancel} style={styles.cancel}>
        <Text style={[styles.pillText, { color: theme.colors.primaryText }]}>{BOOKING_COPY.mapPickCancel}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.pill, marginTop: space[1] },
  pillText: { ...textStyles.buttonSmall },
  banner: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, padding: space[3], gap: space[2] },
  bannerText: { ...textStyles.bodySmall, flex: 1 },
  cancel: { paddingHorizontal: space[2], paddingVertical: space[1] },
});
