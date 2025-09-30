import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

const RequestingCard: React.FC = () => {
  return (
    <View style={styles.card}>
      <ActivityIndicator color="#667eea" size="small" />
      <Text style={styles.title}>Finding you a driver…</Text>
      <Text style={styles.sub}>Sharing your request with nearby drivers</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, alignItems: 'center', gap: 6 },
  title: { fontWeight: '700', color: '#111827' },
  sub: { fontSize: 12, color: '#6b7280' },
});

export default RequestingCard;


