import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../app/providers/ThemeProvider';

interface PassengerCountSelectorProps {
  count: number;
  onCountChange: (count: number) => void;
  maxCount?: number;
}

const PassengerCountSelector: React.FC<PassengerCountSelectorProps> = ({
  count,
  onCountChange,
  maxCount = 6,
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
      }
    };
  }
  
  const styles = createStyles(theme);

  const handleIncrement = () => {
    if (count < maxCount) {
      onCountChange(count + 1);
    }
  };

  const handleDecrement = () => {
    if (count > 1) {
      onCountChange(count - 1);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Number of Passengers</Text>
      
      <View style={styles.selectorContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            count <= 1 && styles.buttonDisabled,
          ]}
          onPress={handleDecrement}
          disabled={count <= 1}
        >
          <Icon
            name="remove"
            size={20}
            color={count <= 1 ? theme.colors.textSecondary : theme.colors.primary}
          />
        </TouchableOpacity>

        <View style={styles.countContainer}>
          <Text style={styles.countText}>{count}</Text>
          <Text style={styles.countLabel}>
            {count === 1 ? 'Passenger' : 'Passengers'}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            count >= maxCount && styles.buttonDisabled,
          ]}
          onPress={handleIncrement}
          disabled={count >= maxCount}
        >
          <Icon
            name="add"
            size={20}
            color={count >= maxCount ? theme.colors.textSecondary : theme.colors.primary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.infoContainer}>
        <Icon name="info" size={16} color={theme.colors.textSecondary} />
        <Text style={styles.infoText}>
          Maximum {maxCount} passengers per ride
        </Text>
      </View>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
    },
    label: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 20,
    },
    selectorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    button: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    buttonDisabled: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
    },
    countContainer: {
      alignItems: 'center',
      marginHorizontal: 24,
      minWidth: 80,
    },
    countText: {
      fontSize: 32,
      fontWeight: 'bold',
      color: theme.colors.primary,
    },
    countLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    infoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 16,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: theme.colors.background,
      borderRadius: 8,
    },
    infoText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginLeft: 8,
    },
  });

export default PassengerCountSelector;
