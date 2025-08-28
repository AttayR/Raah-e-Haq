import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DriverBottomTabs from '../tabs/DriverBottomTabs';

export type DriverStackParamList = {
  DriverTabs: undefined;
};

const Stack = createNativeStackNavigator<DriverStackParamList>();

const DriverStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DriverTabs" component={DriverBottomTabs} />
    </Stack.Navigator>
  );


  
};

export default DriverStack;