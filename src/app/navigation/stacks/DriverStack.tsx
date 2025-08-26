import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DriverHomeScreen from '../../../screens/Driver/DriverHomeScreen';


export type DriverStackParamList = {
DriverHome: undefined;
};


const Stack = createNativeStackNavigator<DriverStackParamList>();
export default function DriverStack() {
return (
<Stack.Navigator>
<Stack.Screen name="DriverHome" component={DriverHomeScreen} options={{ title: 'Driver' }} />
</Stack.Navigator>
);
}