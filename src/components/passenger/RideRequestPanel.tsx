import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BrandColors } from '../../theme/colors';
import { useAppSelector } from '../../store';
import { selectInProgressRide } from '../../features/active-ride/slice';

type Props = {
  onRequest: () => void;
  disabled?: boolean;
};

const RideRequestPanel: React.FC<Props> = ({ onRequest, disabled }) => {
  // T-301: the old `ride` slice is gone; the active ride lives in activeRide.
  const activeRide = useAppSelector(selectInProgressRide);
  const isSubmitting = useAppSelector((s) => s.activeRide.isSubmitting);

  return (
    <View style={styles.container}>
      {activeRide ? (
        <View style={styles.row}>
          <Text style={styles.title}>Ride Active</Text>
          <Text style={styles.sub}>{activeRide.status.toUpperCase()}</Text>
        </View>
      ) : isSubmitting ? (
        <View style={styles.row}>
          <Text style={styles.title}>Request Sent</Text>
          <Text style={styles.sub}>Waiting for driver…</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.requestButton, disabled && styles.requestButtonDisabled]}
          onPress={onRequest}
          disabled={disabled}
        >
          <Text style={styles.requestButtonText}>Request Ride</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: BrandColors.primary },
  sub: { fontSize: 13, color: '#6b7280' },
  requestButton: {
    backgroundColor: BrandColors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  requestButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  requestButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default RideRequestPanel;


