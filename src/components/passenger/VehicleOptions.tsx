import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { BrandColors } from '../../theme/colors';

export type VehicleOption = {
  id: string;
  name: string;
  eta: string;
  desc: string;
  price: string;
  image?: any;
  icon?: string;
};

type Props = {
  options: VehicleOption[];
  selectedId?: string;
  onSelect: (id: string) => void;
};

const VehicleOptions: React.FC<Props> = ({ options, selectedId, onSelect }) => {
  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const selected = selectedId === opt.id;
        return (
          <TouchableOpacity key={opt.id} style={[styles.card, selected && styles.cardSelected]} onPress={() => onSelect(opt.id)}>
            <View style={styles.vehicleIcon}>
              {opt.image ? (
                <Image source={opt.image} style={{ width: 40, height: 40, resizeMode: 'contain' }} />
              ) : (
                <Text style={{ color: 'white', fontSize: 18 }}>{opt.icon || '🚗'}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{opt.name}</Text>
              <View style={styles.detailsRow}>
                <Text style={styles.detail}>{opt.eta}</Text>
                <Text style={styles.dot}>•</Text>
                <Text style={styles.detail}>{opt.desc}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.price}>{opt.price}</Text>
              {selected && <Text style={{ color: '#10b981', fontWeight: '700', fontSize: 12 }}>Selected ✓</Text>}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  card: { backgroundColor: 'white', borderRadius: 15, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: 'transparent' },
  cardSelected: { borderColor: '#667eea', backgroundColor: '#f8f9ff' },
  vehicleIcon: { width: 60, height: 60, borderRadius: 12, backgroundColor: BrandColors.primary, alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: '700', color: '#2d3748' },
  detailsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detail: { fontSize: 12, color: '#9CA3AF' },
  dot: { color: '#9CA3AF' },
  price: { fontWeight: '700', color: '#667eea', fontSize: 16 },
});

export default VehicleOptions;


