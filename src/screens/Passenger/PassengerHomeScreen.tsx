import React from 'react';
import { View, Text, Button } from 'react-native';
import { useDispatch } from 'react-redux';
import { signOutThunk } from '../../store/thunks/authThunks';


export default function PassengerHomeScreen() {
const dispatch = useDispatch<any>();
return (
<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
<Text>Passenger home</Text>
<Button title="Sign out" onPress={() => dispatch(signOutThunk())} />
</View>
);
}