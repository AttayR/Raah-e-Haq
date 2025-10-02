import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BrandColors } from '../../theme/colors';
import { useAppSelector } from '../../store';

type Props = {
  onRequest: () => void;
  disabled?: boolean;
};

const RideRequestPanel: React.FC<Props> = ({ onRequest, disabled }) => {
  const ride = useAppSelector((s) => s.ride);

  return (
    <View style={styles.container}>
      {ride.activeRide ? (
        <View style={styles.row}>
          <Text style={styles.title}>Ride Active</Text>
          <Text style={styles.sub}>{ride.activeRide.status.toUpperCase()}</Text>
        </View>
      ) : ride.currentRequestId ? (
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


