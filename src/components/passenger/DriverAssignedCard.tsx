import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { radius, space, textStyles } from '../../theme';
import type { DriverCardInfo } from '../../features/active-ride/stage';
import { ACTIVE_RIDE_COPY } from '../../features/active-ride/copy';

type Props = {
  /** The assigned driver and vehicle, from the ride (driverCardOf); nothing is invented. */
  driver: DriverCardInfo;
  /** Shown only when set: the screen passes it only while the ride exposes driver.phone (BE-20). */
  onCall?: () => void;
  /** Shown only when set (in-ride chat does not exist yet). */
  onMessage?: () => void;
  messageLabel?: string;
};

/** Driver name, rating, vehicle (make, model, colour) and plate (T-304, PAX-06). */
const DriverAssignedCard: React.FC<Props> = ({ driver, onCall, onMessage, messageLabel }) => {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const name = driver.name ?? ACTIVE_RIDE_COPY.driverFallbackName;
  const vehicleLine = [driver.vehicleName, driver.color].filter((p): p is string => !!p).join(' · ');
  return (
    <View testID="driver-assigned-card" style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={[styles.avatar, { backgroundColor: c.primary }]}>
        <Text style={[styles.initial, { color: c.onPrimary }]}>{driver.name ? driver.name.charAt(0) : ''}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={[styles.title, { color: c.textPrimary }]} numberOfLines={1}>{name}</Text>
          {driver.rating !== null && (
            <Text testID="driver-rating" style={[styles.rating, { color: c.ratingStar }]}>
              {`${driver.rating.toFixed(1)}★`}
            </Text>
          )}
        </View>
        {vehicleLine !== '' && (
          <Text testID="driver-vehicle" style={[styles.sub, { color: c.textSecondary }]} numberOfLines={1}>{vehicleLine}</Text>
        )}
        {driver.plate && (
          <Text testID="driver-plate" style={[styles.plate, { color: c.textPrimary }]}>{ACTIVE_RIDE_COPY.plate(driver.plate)}</Text>
        )}
        {(onCall || onMessage) && (
          <View style={styles.row}>
            {onCall && (
              <TouchableOpacity
                testID="driver-call-button"
                accessibilityRole="button"
                style={[styles.btn, { backgroundColor: c.surfaceAlt }]}
                onPress={onCall}
              >
                <Text style={[styles.btnText, { color: c.textPrimary }]}>{ACTIVE_RIDE_COPY.call}</Text>
              </TouchableOpacity>
            )}
            {onMessage && messageLabel && (
              <TouchableOpacity accessibilityRole="button" style={[styles.btn, { backgroundColor: c.surfaceAlt }]} onPress={onMessage}>
                <Text style={[styles.btnText, { color: c.textPrimary }]}>{messageLabel}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space[4],
    flexDirection: 'row',
    gap: space[3],
    alignItems: 'center',
  },
  avatar: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  initial: { ...textStyles.title },
  body: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  title: { ...textStyles.bodyStrong, flexShrink: 1 },
  rating: { ...textStyles.label },
  sub: { ...textStyles.caption },
  plate: { ...textStyles.label, marginTop: space[1] },
  row: { flexDirection: 'row', gap: space[2], marginTop: space[2] },
  btn: { flex: 1, paddingVertical: space[2], borderRadius: radius.md, alignItems: 'center' },
  btnText: { ...textStyles.buttonSmall },
});

export default DriverAssignedCard;
