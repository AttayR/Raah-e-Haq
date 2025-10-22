import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRide } from '../hooks/useRide';

const RideServiceTest = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  
  const {
    currentRide,
    rideHistory,
    availableDrivers,
    isLoading,
    error,
    requestRide,
    findNearbyDrivers,
    refreshRideHistory,
  } = useRide(11, 'passenger');

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testCreateRide = async () => {
    try {
      addTestResult('Testing ride creation...');
      const rideData = {
        passenger_id: 11,
        pickup_address: 'Test Pickup Location',
        dropoff_address: 'Test Destination Location',
        pickup_latitude: 31.5204,
        pickup_longitude: 74.3587,
        dropoff_latitude: 31.5304,
        dropoff_longitude: 74.3687,
        vehicle_type: 'car',
      };
      
      const ride = await requestRide(rideData);
      addTestResult(`✅ Ride created successfully! ID: ${ride.id}`);
    } catch (error) {
      addTestResult(`❌ Ride creation failed: ${error}`);
    }
  };

  const testFindDrivers = async () => {
    try {
      addTestResult('Testing driver search...');
      const drivers = await findNearbyDrivers(31.5204, 74.3587, 5);
      addTestResult(`✅ Found ${drivers.length} drivers nearby`);
    } catch (error) {
      addTestResult(`❌ Driver search failed: ${error}`);
    }
  };

  const testRefreshHistory = async () => {
    try {
      addTestResult('Testing ride history refresh...');
      await refreshRideHistory();
      addTestResult(`✅ Ride history refreshed! Count: ${rideHistory.length}`);
    } catch (error) {
      addTestResult(`❌ History refresh failed: ${error}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ride Service Test</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>Current Ride: {currentRide ? `ID ${currentRide.id}` : 'None'}</Text>
        <Text style={styles.statusText}>Ride History: {rideHistory.length} rides</Text>
        <Text style={styles.statusText}>Available Drivers: {availableDrivers.length}</Text>
        <Text style={styles.statusText}>Loading: {isLoading ? 'Yes' : 'No'}</Text>
        {error && <Text style={styles.errorText}>Error: {error}</Text>}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={testCreateRide}>
          <Text style={styles.buttonText}>Test Create Ride</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testFindDrivers}>
          <Text style={styles.buttonText}>Test Find Drivers</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testRefreshHistory}>
          <Text style={styles.buttonText}>Test Refresh History</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Test Results:</Text>
        {testResults.map((result, index) => (
          <Text key={index} style={styles.resultText}>{result}</Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  statusContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 16,
    marginBottom: 5,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    marginBottom: 5,
    color: '#ff4444',
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    minWidth: '30%',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  resultText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#666',
  },
});

export default RideServiceTest;
