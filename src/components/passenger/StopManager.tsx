import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../app/providers/ThemeProvider';
import { RideStopRequest } from '../../services/rideService';

interface StopManagerProps {
  stops: RideStopRequest[];
  onRemoveStop: (index: number) => void;
  onReorderStops: (fromIndex: number, toIndex: number) => void;
}

const StopManager: React.FC<StopManagerProps> = ({
  stops,
  onRemoveStop,
  onReorderStops,
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
        textSecondary: '#6B7280',
        border: '#E5E7EB',
        error: '#EF4444',
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
        textSecondary: '#6B7280',
        border: '#E5E7EB',
        error: '#EF4444',
      }
    };
  }
  
  const styles = createStyles(theme);

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      onReorderStops(index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < stops.length - 1) {
      onReorderStops(index, index + 1);
    }
  };

  if (stops.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stops ({stops.length})</Text>
      
      <ScrollView style={styles.stopsList} showsVerticalScrollIndicator={false}>
        {stops.map((stop, index) => (
          <View key={index} style={styles.stopItem}>
            <View style={styles.stopNumber}>
              <Text style={styles.stopNumberText}>{index + 1}</Text>
            </View>
            
            <View style={styles.stopContent}>
              <Text style={styles.stopAddress} numberOfLines={2}>
                {stop.address}
              </Text>
              <Text style={styles.stopCoordinates}>
                {stop.latitude.toFixed(6)}, {stop.longitude.toFixed(6)}
              </Text>
            </View>
            
            <View style={styles.stopActions}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  index === 0 && styles.actionButtonDisabled,
                ]}
                onPress={() => handleMoveUp(index)}
                disabled={index === 0}
              >
                <Icon
                  name="keyboard-arrow-up"
                  size={16}
                  color={
                    index === 0
                      ? theme.colors.textSecondary
                      : theme.colors.primary
                  }
                />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  index === stops.length - 1 && styles.actionButtonDisabled,
                ]}
                onPress={() => handleMoveDown(index)}
                disabled={index === stops.length - 1}
              >
                <Icon
                  name="keyboard-arrow-down"
                  size={16}
                  color={
                    index === stops.length - 1
                      ? theme.colors.textSecondary
                      : theme.colors.primary
                  }
                />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => onRemoveStop(index)}
              >
                <Icon name="delete" size={16} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
      
      <View style={styles.infoContainer}>
        <Icon name="info" size={16} color={theme.colors.textSecondary} />
        <Text style={styles.infoText}>
          Drag stops up/down to reorder them
        </Text>
      </View>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      marginTop: 12,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    stopsList: {
      maxHeight: 200,
    },
    stopItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    stopNumber: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    stopNumberText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: 'white',
    },
    stopContent: {
      flex: 1,
    },
    stopAddress: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: 4,
    },
    stopCoordinates: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    stopActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 4,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    actionButtonDisabled: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
    },
    removeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    infoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.colors.background,
      borderRadius: 8,
    },
    infoText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginLeft: 8,
    },
  });

export default StopManager;
