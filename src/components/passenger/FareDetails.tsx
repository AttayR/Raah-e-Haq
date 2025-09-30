import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

type Props = {
  vehicleName: string;
  distanceKm: string;
  estimate: string;
  breakdown: { label: string; value: string }[];
  onConfirm: () => void;
};

const FareDetails: React.FC<Props> = ({ vehicleName, distanceKm, estimate, breakdown, onConfirm }) => {
  return (
    <View style={{ padding: 16 }}>
      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Estimated Fare</Text>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#667eea' }}>{estimate}</Text>
        <Text style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{vehicleName} • {distanceKm}</Text>
      </View>
      <View style={styles.box}>
        <Text style={styles.boxTitle}>Fare Breakdown</Text>
        {breakdown.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue}>{row.value}</Text>
          </View>
        ))}
        <View style={[styles.row, { borderTopWidth: 2, borderTopColor: '#e5e7eb', marginTop: 10, paddingTop: 12 }]}>
          <Text style={[styles.rowLabel, { fontWeight: '800', color: '#2d3748' }]}>Total</Text>
          <Text style={[styles.rowValue, { fontWeight: '800', color: '#2d3748' }]}>{estimate}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.cta} onPress={onConfirm}>
        <Text style={styles.ctaText}>Confirm & Request</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  box: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 14 },
  boxTitle: { fontWeight: '700', color: '#2d3748', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { color: '#4a5568' },
  rowValue: { color: '#4a5568' },
  cta: { marginTop: 16, backgroundColor: '#667eea', paddingVertical: 14, borderRadius: 12, alignItems: 'center', elevation: 2 },
  ctaText: { color: 'white', fontWeight: '700', fontSize: 16 },
});

export default FareDetails;


