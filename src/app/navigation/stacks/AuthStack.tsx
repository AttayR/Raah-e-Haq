import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../../../screens/Auth/LoginScreen';
import SignupScreen from '../../../screens/Auth/SignupScreen';



export type AuthStackParamList = {
Login: undefined;
Signup: { role?: 'driver'|'passenger' } | undefined;
};


const Stack = createNativeStackNavigator<AuthStackParamList>();


export default function AuthStack() {
return (
<Stack.Navigator>
<Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign In' }} />
<Stack.Screen name="Signup" component={SignupScreen} options={{ title: 'Create Account' }} />
</Stack.Navigator>
);
}