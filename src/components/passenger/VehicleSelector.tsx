import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../app/providers/ThemeProvider';

type Vehicle = 'car' | 'bike' | 'van';

interface VehicleSelectorProps {
  selectedVehicle: Vehicle;
  onVehicleSelect: (vehicle: Vehicle) => void;
}

const VehicleSelector: React.FC<VehicleSelectorProps> = ({ 
  selectedVehicle, 
  onVehicleSelect 
}) => {
  // Safe theme access with fallback
  let theme;
  try {
    const themeContext = useTheme();
    theme = themeContext?.theme || {
      colors: {
        primary: '#3B82F6',
        background: '#FFFFFF',
        surface: '#F8FAFC',
        text: '#1F2937',
        border: '#E5E7EB',
      }
    };
  } catch (error) {
    console.log('Theme error, using fallback:', error);
    theme = {
      colors: {
        primary: '#3B82F6',
        background: '#FFFFFF',
        surface: '#F8FAFC',
        text: '#1F2937',
        border: '#E5E7EB',
      }
    };
  }
  
  const styles = createStyles(theme);

  const vehicles: { type: Vehicle; label: string; icon: string }[] = [
    { type: 'car', label: 'Car', icon: 'directions-car' },
    { type: 'bike', label: 'Bike', icon: 'motorcycle' },
    { type: 'van', label: 'Van', icon: 'airport-shuttle' },
  ];

  return (
    <View style={styles.container}>
      {vehicles.map((vehicle) => (
        <TouchableOpacity
          key={vehicle.type}
          style={[
            styles.vehicleCard,
            selectedVehicle === vehicle.type && styles.selectedCard,
          ]}
          onPress={() => onVehicleSelect(vehicle.type)}
        >
          <View style={[
            styles.iconContainer,
            selectedVehicle === vehicle.type && styles.selectedIconContainer,
          ]}>
            <Icon
              name={vehicle.icon as any}
              size={24}
              color={selectedVehicle === vehicle.type ? 'white' : theme.colors.primary}
            />
          </View>
          <Text style={[
            styles.vehicleLabel,
            selectedVehicle === vehicle.type && styles.selectedLabel,
          ]}>
            {vehicle.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    vehicleCard: {
      flex: 1,
      alignItems: 'center',
      padding: 16,
      marginHorizontal: 4,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    selectedCard: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.background,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    selectedIconContainer: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    vehicleLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    selectedLabel: {
      color: theme.colors.primary,
    },
  });

export default VehicleSelector;


