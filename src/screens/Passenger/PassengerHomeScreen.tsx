/* eslint-disable react-native/no-inline-styles */
import React from 'react';
import { View, Text } from 'react-native';
import { useDispatch } from 'react-redux';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import BrandButton from '../../components/BrandButton';
import { signOutThunk } from '../../store/thunks/authThunks';


export default function PassengerHomeScreen() {
  const { theme } = useAppTheme();
  const dispatch = useDispatch<any>();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16 }}>
      <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: '700' }}>
        Passenger home
      </Text>
      <BrandButton title="Request a Ride" variant="primary" />
      <BrandButton title="Sign out" variant="warning" onPress={() => dispatch(signOutThunk())} />
    </View>
  );
}
