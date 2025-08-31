import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { setSignedOut, setAuthenticated } from '../store/slices/authSlice';

export default function AuthDebug() {
  const dispatch = useDispatch<any>();
  const authState = useSelector((state: RootState) => state.auth);
  const userState = useSelector((state: RootState) => state.user);

  const testSignOut = () => {
    console.log('AuthDebug - Testing sign out');
    dispatch(setSignedOut());
  };

  const testSignIn = () => {
    console.log('AuthDebug - Testing sign in');
    const mockUser = {
      uid: 'test_user_' + Date.now(),
      phoneNumber: '+1234567890',
      role: 'driver' as const,
      displayName: 'Test User',
      email: 'test@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
      isVerified: true,
      isActive: true
    };
    
    const mockSession = {
      uid: mockUser.uid,
      phoneNumber: mockUser.phoneNumber,
      role: mockUser.role,
      token: 'test_token_' + Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000)
    };

    dispatch(setAuthenticated({
      uid: mockUser.uid,
      phoneNumber: mockUser.phoneNumber,
      role: mockUser.role,
      userProfile: mockUser,
      session: mockSession
    }));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Auth Debug Info</Text>
      <Text style={styles.text}>Status: {authState.status}</Text>
      <Text style={styles.text}>UID: {authState.uid || 'null'}</Text>
      <Text style={styles.text}>Phone: {authState.phoneNumber || 'null'}</Text>
      <Text style={styles.text}>Role: {authState.role || 'null'}</Text>
      <Text style={styles.text}>Error: {authState.error || 'null'}</Text>
      <Text style={styles.text}>User Role: {userState.role || 'null'}</Text>
      <Text style={styles.text}>Verification ID: {authState.verificationId || 'null'}</Text>
      
      <View style={styles.buttonContainer}>
        <Button title="Test Sign Out" onPress={testSignOut} />
        <Button title="Test Sign In" onPress={testSignIn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f0f0f0',
    margin: 16,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  text: {
    fontSize: 14,
    marginBottom: 4,
  },
  buttonContainer: {
    marginTop: 16,
    gap: 8,
  },
});
