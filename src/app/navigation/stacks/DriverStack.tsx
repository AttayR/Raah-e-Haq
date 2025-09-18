import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DriverBottomTabs from '../tabs/DriverBottomTabs';
import DriverProfile from 'src/screens/Driver/DriverProfile';
import DriverMessagesScreen from 'src/screens/Driver/DriverMessagesScreen';
import DriverMapScreen from 'src/screens/Driver/DriverMapScreen';

export type DriverStackParamList = {
  DriverTabs: undefined;
  DriverProfile: undefined;
  DriverMessagesScreen: {
    chatData: {
      id: string;
      name: string;
      avatar: string;
      lastMessage: string;
      time: string;
      unreadCount: number;
      isPassenger: boolean;
    };
  };
  DriverMap: undefined;
};

const Stack = createNativeStackNavigator<DriverStackParamList>();

const DriverStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen 
        name="DriverTabs" 
        component={DriverBottomTabs} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="DriverProfile" 
        component={DriverProfile} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="DriverMessagesScreen" 
        component={DriverMessagesScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="DriverMap" 
        component={DriverMapScreen} 
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default DriverStack;