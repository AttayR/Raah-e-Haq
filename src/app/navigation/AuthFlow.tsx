import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import AuthStack from './stacks/AuthStack';
import RootNavigation from './RootNavigation';

export default function AuthFlow() {
  // For now, always show auth screens to test
  console.log('AuthFlow - Rendering auth screens');
  
  return (
    <View style={styles.container}>
      <Text style={styles.debugText}>AuthFlow is working!</Text>
      <AuthStack />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  debugText: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'yellow',
    padding: 10,
    zIndex: 1000,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
