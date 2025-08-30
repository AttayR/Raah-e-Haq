import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { auth, db } from '../services/firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

const FirebaseTest: React.FC = () => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<string>('');

  useEffect(() => {
    testFirebaseConnection();
  }, []);

  const testFirebaseConnection = async () => {
    try {
      // Test Authentication
      const userCredential = await signInAnonymously(auth);
      console.log('Firebase Auth Test: Success', userCredential.user.uid);

      // Test Firestore
      const testCollection = collection(db, 'test');
      const docRef = await addDoc(testCollection, {
        message: 'Firebase connection test',
        timestamp: new Date(),
        userId: userCredential.user.uid
      });
      console.log('Firestore Write Test: Success', docRef.id);

      // Test Firestore Read
      const querySnapshot = await getDocs(testCollection);
      console.log('Firestore Read Test: Success', querySnapshot.size, 'documents');

      setIsConnected(true);
      setTestResult('✅ All Firebase services are working correctly!');
      
      Alert.alert(
        'Firebase Test Success',
        'Firebase is properly configured and working!',
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('Firebase Test Error:', error);
      setIsConnected(false);
      setTestResult(`❌ Firebase test failed: ${error.message}`);
      
      Alert.alert(
        'Firebase Test Failed',
        `Error: ${error.message}`,
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Firebase Connection Test</Text>
      <Text style={styles.status}>
        Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </Text>
      <Text style={styles.result}>{testResult}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    margin: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  status: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  result: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default FirebaseTest;
