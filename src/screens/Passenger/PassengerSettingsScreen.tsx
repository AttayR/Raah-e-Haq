import React from 'react';
import { View, Text } from 'react-native';
import { useDispatch } from 'react-redux';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import BrandButton from '../../components/BrandButton';
import { signOutThunk } from '../../store/thunks/authThunks';

const PassengerSettingsScreen = () => {
  const { theme } = useAppTheme();
  const dispatch = useDispatch<any>();
  
  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: theme.colors.background, 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: 16,
      gap: 12
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
        textAlign: 'center',
        marginBottom: 20
      }}>
        Passenger settings will be implemented here
      </Text>
      <BrandButton title="Sign out" variant="warning" onPress={() => dispatch(signOutThunk())} />
    </View>
  );
};

export default PassengerSettingsScreen;