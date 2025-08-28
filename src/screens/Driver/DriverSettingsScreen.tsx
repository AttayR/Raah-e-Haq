import React from 'react';
import { View, Text } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';

const DriverSettingsScreen = () => {
  const { theme } = useAppTheme();
  
  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: theme.colors.background, 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: 16 
    }}>
      <Text style={{ 
        color: theme.colors.text, 
        fontSize: 24, 
        fontWeight: '700',
        marginBottom: 16
      }}>
        Settings
      </Text>
      <Text style={{ 
        color: theme.colors.text, 
        fontSize: 16,
        textAlign: 'center'
      }}>
        Driver settings will be available here
      </Text>
    </View>
  );
};

export default DriverSettingsScreen;