import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PassengerBottomTabs from 'src/app/navigation/tabs/PassengerBottomTabs';

export type PassengerStackParamList = {
  PassengerTabs: undefined;
};

const Stack = createNativeStackNavigator<PassengerStackParamList>();

const PassengerStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PassengerTabs" component={PassengerBottomTabs} />
    </Stack.Navigator>
  );
};

export default PassengerStack;
