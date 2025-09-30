import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BrandColors } from '../../theme/colors';

type Vehicle = 'car' | 'bike' | 'van';

interface Props {
  value: Vehicle;
  onChange: (v: Vehicle) => void;
}

const VehicleSelector: React.FC<Props> = ({ value, onChange }) => {
  const iconName = (v: Vehicle) => (v === 'car' ? 'directions-car' : v === 'bike' ? 'motorcycle' : 'airport-shuttle');
  const label = (v: Vehicle) => (v === 'car' ? 'Car' : v === 'bike' ? 'Bike' : 'Van');

  return (
    <View style={styles.row}>
      {(['car','bike','van'] as const).map(v => (
        <TouchableOpacity
          key={v}
          style={[styles.chip, value === v && styles.activeChip]}
          onPress={() => onChange(v)}
        >
          <Icon name={iconName(v)} size={20} color={value === v ? BrandColors.primary : '#374151'} />
          <Text style={[styles.chipText, value === v && styles.activeChipText]}>
            {label(v)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  chip: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'white',
  },
  activeChip: {
    borderColor: BrandColors.primary,
    backgroundColor: '#eef6ff',
  },
  chipText: {
    color: '#374151',
    fontWeight: '600',
  },
  activeChipText: {
    color: BrandColors.primary,
  },
});

export default VehicleSelector;


