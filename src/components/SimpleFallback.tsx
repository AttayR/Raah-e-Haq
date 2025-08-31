import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SimpleFallback() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>App is Working!</Text>
      <Text style={styles.subtitle}>This is a fallback component</Text>
      <Text style={styles.text}>If you can see this, the basic rendering is working</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f0f0f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 12,
    color: '#666',
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    color: '#888',
  },
});
