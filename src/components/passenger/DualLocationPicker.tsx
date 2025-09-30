import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LocationSearch from './LocationSearch';
import { BrandColors } from '../../theme/colors';

type Coords = { latitude: number; longitude: number } | null;

type Props = {
  pickup: Coords;
  destination: Coords;
  pickupQuery: string;
  destQuery: string;
  onPickupQuery: (q: string) => void;
  onDestQuery: (q: string) => void;
  onSelectPickup: (c: { latitude: number; longitude: number }) => void;
  onSelectDestination: (c: { latitude: number; longitude: number }) => void;
  onUseCurrentLocation?: () => void;
  onSwap?: () => void;
};

const DualLocationPicker: React.FC<Props> = ({
  pickup,
  destination,
  pickupQuery,
  destQuery,
  onPickupQuery,
  onDestQuery,
  onSelectPickup,
  onSelectDestination,
  onUseCurrentLocation,
  onSwap,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Plan your trip</Text>
      <View style={styles.row}>
        <View style={styles.dotPickup} />
        <View style={{ flex: 1 }}>
          <LocationSearch mode="pickup" query={pickupQuery} onChangeQuery={onPickupQuery} onSelect={(s) => onSelectPickup(s.coords)} readOnly={pickupQuery.endsWith('…')} />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.dotDestination} />
        <View style={{ flex: 1 }}>
          <LocationSearch mode="destination" query={destQuery} onChangeQuery={onDestQuery} onSelect={(s) => onSelectDestination(s.coords)} />
        </View>
      </View>
      <View style={styles.actions}>
        {onUseCurrentLocation && (
          <TouchableOpacity style={styles.actionBtn} onPress={onUseCurrentLocation}>
            <Text style={styles.actionText}>📍 Use current location</Text>
          </TouchableOpacity>
        )}
        {onSwap && (
          <TouchableOpacity style={styles.swapBtn} onPress={onSwap}>
            <Text style={styles.swapText}>⇅ Swap</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 10 },
  title: { fontWeight: '700', fontSize: 16, color: '#111827' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dotPickup: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981', marginTop: 16 },
  dotDestination: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', marginTop: 16 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  actionBtn: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#F3F4F6', borderRadius: 10 },
  actionText: { fontWeight: '700', color: '#111827' },
  swapBtn: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: BrandColors.primary, borderRadius: 10 },
  swapText: { fontWeight: '700', color: 'white' },
});

export default DualLocationPicker;


