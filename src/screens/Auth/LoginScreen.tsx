import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { setRole } from '../../store/slices/userSlice';
import { signInThunk } from '../../store/thunks/authThunks';


export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setLocalRole] = useState<'driver' | 'passenger'>('passenger');
  const dispatch = useDispatch<any>();
  const { status, error } = useSelector((s: RootState) => s.auth);

  const onLogin = () => {
    dispatch(setRole(role));
    dispatch(signInThunk(email.trim(), password.trim(), role));
  };

  return (
    <View style={styles.c}>
      <Text style={styles.h}>Welcome back</Text>
      <TextInput
        style={styles.i}
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.i}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <View style={{ flexDirection: 'row', gap: 12, marginVertical: 8 }}>
        <Button
          title={role === 'passenger' ? 'Passenger ✓' : 'Passenger'}
          onPress={() => setLocalRole('passenger')}
        />
        <Button
          title={role === 'driver' ? 'Driver ✓' : 'Driver'}
          onPress={() => setLocalRole('driver')}
        />
      </View>
      <Button
        title={status === 'loading' ? 'Signing in…' : 'Sign in'}
        onPress={onLogin}
      />
      {!!error && <Text style={{ color: 'red', marginTop: 8 }}>{error}</Text>}
      <View style={{ height: 12 }} />
      <Button
        title="Create account"
        onPress={() => navigation.navigate('Signup')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, padding: 16, gap: 12, justifyContent: 'center' },
  h: { fontSize: 22, fontWeight: '600', marginBottom: 8 },
  i: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12 },
});
