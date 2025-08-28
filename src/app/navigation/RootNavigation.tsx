import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthStack from './stacks/AuthStack';
import DriverStack from './stacks/DriverStack';
import PassengerStack from './stacks/PassengerStack';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';


export type RootStackParamList = {
Auth: undefined;
Driver: undefined;
Passenger: undefined;
};


const Stack = createNativeStackNavigator<RootStackParamList>();


export default function RootNavigator() {
const { status } = useSelector((s: RootState) => s.auth);
const { role } = useSelector((s: RootState) => s.user);
// Original auth check (commented out for development)
// const role = 'driver'
if (status !== 'authenticated') {
return (
<Stack.Navigator screenOptions={{ headerShown: false }}>
<Stack.Screen name="Auth" component={AuthStack} />
</Stack.Navigator>
);
}

return (
<Stack.Navigator screenOptions={{ headerShown: false }}>
{role === 'driver' && <Stack.Screen name="Driver" component={DriverStack} />}
{role === 'passenger' && <Stack.Screen name="Passenger" component={PassengerStack} />}
{/* Fallback: if role missing, show Auth to choose role or a RolePicker screen */}
{!role && <Stack.Screen name="Auth" component={AuthStack} />}
</Stack.Navigator>
);
}