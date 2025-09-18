import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useAppSelector } from '../app/providers/ReduxProvider';
import { BrandColors } from '../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';

const AppTestFlow = () => {
  const { isAuthenticated, userProfile, role, profileCompleted } = useAppSelector(state => state.auth);
  const [testResults, setTestResults] = useState<string[]>([]);

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const runTests = () => {
    setTestResults([]);
    addTestResult('Starting comprehensive app flow tests...');

    // Test 1: Authentication Status
    if (isAuthenticated) {
      addTestResult('✅ User is authenticated');
    } else {
      addTestResult('❌ User is not authenticated');
    }

    // Test 2: User Profile
    if (userProfile) {
      addTestResult(`✅ User profile loaded: ${userProfile.fullName || 'Unknown'}`);
    } else {
      addTestResult('❌ User profile not loaded');
    }

    // Test 3: Role Assignment
    if (role) {
      addTestResult(`✅ User role assigned: ${role}`);
    } else {
      addTestResult('❌ User role not assigned');
    }

    // Test 4: Profile Completion
    if (profileCompleted) {
      addTestResult('✅ Profile is completed');
    } else {
      addTestResult('❌ Profile is not completed');
    }

    // Test 5: Navigation Flow
    if (isAuthenticated && role && profileCompleted) {
      addTestResult('✅ Ready for main app navigation');
    } else {
      addTestResult('❌ Not ready for main app navigation');
    }

    addTestResult('Test completed!');
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Icon name="bug-report" size={24} color={BrandColors.primary} />
        <Text style={styles.title}>App Flow Test</Text>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusTitle}>Current Status:</Text>
        <Text style={styles.statusText}>
          Authenticated: {isAuthenticated ? '✅' : '❌'}
        </Text>
        <Text style={styles.statusText}>
          Role: {role || 'None'}
        </Text>
        <Text style={styles.statusText}>
          Profile: {profileCompleted ? '✅ Complete' : '❌ Incomplete'}
        </Text>
        <Text style={styles.statusText}>
          User: {userProfile?.fullName || 'Unknown'}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.testButton} onPress={runTests}>
          <Icon name="play-arrow" size={20} color="white" />
          <Text style={styles.buttonText}>Run Tests</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.clearButton} onPress={clearResults}>
          <Icon name="clear" size={20} color="white" />
          <Text style={styles.buttonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Test Results:</Text>
        {testResults.map((result, index) => (
          <Text key={index} style={styles.resultText}>
            {result}
          </Text>
        ))}
      </ScrollView>

      <View style={styles.featuresContainer}>
        <Text style={styles.featuresTitle}>Implemented Features:</Text>
        <View style={styles.featureList}>
          <Text style={styles.featureItem}>✅ Authentication (Phone, Email, Google)</Text>
          <Text style={styles.featureItem}>✅ Driver Registration & Verification</Text>
          <Text style={styles.featureItem}>✅ Passenger Profile Management</Text>
          <Text style={styles.featureItem}>✅ Google Maps Integration</Text>
          <Text style={styles.featureItem}>✅ Ride Request System</Text>
          <Text style={styles.featureItem}>✅ Real-time Driver Dispatch</Text>
          <Text style={styles.featureItem}>✅ Payment System</Text>
          <Text style={styles.featureItem}>✅ Push Notifications</Text>
          <Text style={styles.featureItem}>✅ Chat System</Text>
          <Text style={styles.featureItem}>✅ Ride History</Text>
          <Text style={styles.featureItem}>✅ Earnings Tracking</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: BrandColors.primary,
    marginLeft: 10,
  },
  statusContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  testButton: {
    flex: 1,
    backgroundColor: BrandColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 5,
  },
  resultsContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  resultText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
    fontFamily: 'monospace',
  },
  featuresContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  featureList: {
    gap: 5,
  },
  featureItem: {
    fontSize: 14,
    color: '#28a745',
    marginBottom: 3,
  },
});

export default AppTestFlow;
