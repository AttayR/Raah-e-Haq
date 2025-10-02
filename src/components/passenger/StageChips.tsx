import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Props = {
  stage: 'home' | 'pickup' | 'destination' | 'vehicle' | 'fare' | 'requesting';
};

const STAGES: { key: Props['stage']; label: string; icon: string }[] = [
  { key: 'pickup', label: 'Pickup', icon: '📍' },
  { key: 'destination', label: 'Destination', icon: '🎯' },
  { key: 'vehicle', label: 'Vehicle', icon: '🚗' },
  { key: 'fare', label: 'Fare', icon: '💰' },
  { key: 'requesting', label: 'Request', icon: '🔔' },
];

const StageChips: React.FC<Props> = ({ stage }) => {
  return (
    <View style={styles.row}>
      {STAGES.map((s) => {
        const active = s.key === stage || (stage === 'home' && s.key === 'pickup');
        return (
          <View key={s.key} style={[styles.chip, active && styles.chipActive]}>
            <Text style={styles.icon}>{s.icon}</Text>
            <Text style={[styles.text, active && styles.textActive]}>{s.label}</Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999 },
  chipActive: { backgroundColor: '#eef6ff', borderWidth: 1, borderColor: '#67a9ff' },
  icon: { fontSize: 12 },
  text: { fontSize: 12, color: '#6b7280', fontWeight: '700' },
  textActive: { color: '#2563eb' },
});

export default StageChips;


