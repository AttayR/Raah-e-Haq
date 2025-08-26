import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { useDispatch } from 'react-redux';
import { signUpThunk } from '../../store/thunks/authThunks';


export default function SignupScreen() {
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [role, setRole] = useState<'driver'|'passenger'>('passenger');
const dispatch = useDispatch<any>();


const onSignup = () => dispatch(signUpThunk(email.trim(), password.trim(), role));


return (
<View style={styles.c}>
<Text style={styles.h}>Create your account</Text>
<TextInput style={styles.i} placeholder="Email" autoCapitalize='none' value={email} onChangeText={setEmail} />
<TextInput style={styles.i} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
<View style={{ flexDirection: 'row', gap: 12, marginVertical: 8 }}>
<Button title={role === 'passenger' ? 'Passenger ✓' : 'Passenger'} onPress={() => setRole('passenger')} />
<Button title={role === 'driver' ? 'Driver ✓' : 'Driver'} onPress={() => setRole('driver')} />
</View>
<Button title="Sign up" onPress={onSignup} />
</View>
);
}


const styles = StyleSheet.create({
c: { flex: 1, padding: 16, gap: 12, justifyContent: 'center' },
h: { fontSize: 22, fontWeight: '600', marginBottom: 8 },
i: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12 },
});