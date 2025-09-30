import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LocationSearch from './LocationSearch';
import Icon from 'react-native-vector-icons/MaterialIcons';

type Coords = { latitude: number; longitude: number };

type Props = {
  stops: Coords[];
  onAddStop: (c: Coords) => void;
  onRemoveStop: (index: number) => void;
  maxStops?: number;
};

const StopsEditor: React.FC<Props> = ({ stops, onAddStop, onRemoveStop, maxStops = 5 }) => {
  return (
    <View style={{ gap: 8 }}>
      {stops.map((s, idx) => (
        <View key={`stop-${idx}`} style={styles.row}>
          <View style={styles.dot} />
          <Text style={styles.stopText}>Stop {idx + 1}: {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}</Text>
          <TouchableOpacity onPress={() => onRemoveStop(idx)} style={styles.removeBtn}>
            <Icon name="close" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      ))}
      {stops.length < maxStops && (
        <View style={{ marginTop: 4 }}>
          <LocationSearch
            mode="destination"
            query={''}
            onChangeQuery={() => {}}
            onSelect={(sel) => onAddStop(sel.coords)}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFA500' },
  stopText: { fontSize: 14, color: '#374151', flex: 1 },
  removeBtn: { padding: 4 },
});

export default StopsEditor;


