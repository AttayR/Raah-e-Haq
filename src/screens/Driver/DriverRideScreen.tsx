import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Dimensions,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BrandColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { useRide } from '../../hooks/useRide';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import ErrorBoundary from '../../components/ErrorBoundary';
import { RideResource, RideStopResource } from '../../services/rideService';

const { width, height } = Dimensions.get('window');

interface DriverRideScreenProps {
  ride: RideResource;
  onRideUpdate: (ride: RideResource) => void;
}

const DriverRideScreen: React.FC<DriverRideScreenProps> = ({ ride, onRideUpdate }) => {
  const { handleError } = useErrorHandler();
  const rideHook = useRide(ride.driver_id, 'driver');
  const {
    navigateToNextStop,
    markStopCompleted,
    getNavigationInstructions,
    startLocationTracking,
    stopLocationTracking,
    subscribeToRideUpdates,
    unsubscribe,
  } = rideHook || {};

  const [currentStopIndex, setCurrentStopIndex] = useState(ride.current_stop_index || 0);
  const [navigationInstructions, setNavigationInstructions] = useState<any>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);

  // Subscribe to ride updates
  useEffect(() => {
    if (ride.id && subscribeToRideUpdates) {
      subscribeToRideUpdates(ride.id, 'driver')
        .then((id) => setConnectionId(id))
        .catch((error) => handleError(error, 'WEBSOCKET_SUBSCRIPTION_ERROR'));
    }

    return () => {
      if (connectionId && unsubscribe) {
        unsubscribe(connectionId);
      }
    };
  }, [ride.id, subscribeToRideUpdates, unsubscribe, connectionId, handleError]);

  // Start location tracking
  useEffect(() => {
    if (startLocationTracking) {
      startLocationTracking({
        enableTracking: true,
        updateInterval: 5000, // 5 seconds
        minAccuracy: 50,
        minDistance: 10,
        backgroundTracking: true
      }).catch((error) => handleError(error, 'LOCATION_TRACKING_ERROR'));
    }

    return () => {
      if (stopLocationTracking) {
        stopLocationTracking();
      }
    };
  }, [startLocationTracking, stopLocationTracking, handleError]);

  // Get navigation instructions
  const loadNavigationInstructions = useCallback(async () => {
    if (!getNavigationInstructions) return;

    try {
      const instructions = await getNavigationInstructions(ride.id);
      setNavigationInstructions(instructions);
    } catch (error) {
      handleError(error, 'NAVIGATION_ERROR');
    }
  }, [ride.id, getNavigationInstructions, handleError]);

  // Navigate to next stop
  const handleNavigateToNextStop = useCallback(async () => {
    if (!navigateToNextStop) return;

    try {
      setIsNavigating(true);
      const result = await navigateToNextStop(ride.id);
      setCurrentStopIndex(result.current_stop_index);
      await loadNavigationInstructions();
      Alert.alert('Navigation Started', 'Follow the route to the next stop');
    } catch (error) {
      handleError(error, 'NAVIGATION_ERROR');
    } finally {
      setIsNavigating(false);
    }
  }, [ride.id, navigateToNextStop, loadNavigationInstructions, handleError]);

  // Mark stop as completed
  const handleMarkStopCompleted = useCallback(async (stopId: number) => {
    if (!markStopCompleted) return;

    try {
      const result = await markStopCompleted(ride.id, stopId);
      setCurrentStopIndex(result.current_stop_index);
      await loadNavigationInstructions();
      Alert.alert('Stop Completed', 'Stop marked as completed successfully');
    } catch (error) {
      handleError(error, 'STOP_COMPLETION_ERROR');
    }
  }, [ride.id, markStopCompleted, loadNavigationInstructions, handleError]);

  // Get current stop
  const getCurrentStop = (): RideStopResource | null => {
    if (ride.stops && ride.stops.length > currentStopIndex) {
      return ride.stops[currentStopIndex];
    }
    return null;
  };

  // Get next stop
  const getNextStop = (): RideStopResource | null => {
    if (ride.stops && ride.stops.length > currentStopIndex + 1) {
      return ride.stops[currentStopIndex + 1];
    }
    return null;
  };

  const currentStop = getCurrentStop();
  const nextStop = getNextStop();

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('DriverRideScreen Error:', error, errorInfo);
        handleError(error, 'DRIVER_RIDE_ERROR');
      }}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ride in Progress</Text>
          <Text style={styles.rideId}>Ride ID: {ride.ride_id}</Text>
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            region={{
              latitude: ride.pickup_latitude,
              longitude: ride.pickup_longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            showsUserLocation={true}
            showsMyLocationButton={true}
          >
            {/* Pickup Marker */}
            <Marker
              coordinate={{
                latitude: ride.pickup_latitude,
                longitude: ride.pickup_longitude,
              }}
              title="Pickup Location"
              description={ride.pickup_address}
              pinColor="green"
            />

            {/* Dropoff Marker */}
            <Marker
              coordinate={{
                latitude: ride.dropoff_latitude,
                longitude: ride.dropoff_longitude,
              }}
              title="Dropoff Location"
              description={ride.dropoff_address}
              pinColor="red"
            />

            {/* Stop Markers */}
            {ride.stops?.map((stop, index) => (
              <Marker
                key={stop.id}
                coordinate={{
                  latitude: stop.latitude,
                  longitude: stop.longitude,
                }}
                title={`Stop ${stop.stop_order}`}
                description={stop.address}
                pinColor={index === currentStopIndex ? "blue" : "orange"}
              />
            ))}
          </MapView>
        </View>

        {/* Ride Details */}
        <ScrollView style={styles.detailsContainer} showsVerticalScrollIndicator={false}>
          {/* Passenger Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Passenger Information</Text>
            <View style={styles.infoCard}>
              <Text style={styles.passengerName}>{ride.passenger?.name || 'Unknown'}</Text>
              <Text style={styles.passengerPhone}>{ride.passenger?.phone || 'N/A'}</Text>
              <Text style={styles.passengerRating}>
                Rating: {ride.passenger?.rating || 'N/A'} ⭐
              </Text>
            </View>
          </View>

          {/* Current Stop */}
          {currentStop && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Stop</Text>
              <View style={styles.stopCard}>
                <Text style={styles.stopAddress}>{currentStop.address}</Text>
                <Text style={styles.stopStatus}>Status: {currentStop.status_label}</Text>
                <Text style={styles.stopETA}>
                  ETA: {currentStop.estimated_arrival || 'Calculating...'}
                </Text>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.completeButton]}
                  onPress={() => handleMarkStopCompleted(currentStop.id)}
                >
                  <Icon name="check" size={20} color="white" />
                  <Text style={styles.buttonText}>Mark as Completed</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Next Stop */}
          {nextStop && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Next Stop</Text>
              <View style={styles.stopCard}>
                <Text style={styles.stopAddress}>{nextStop.address}</Text>
                <Text style={styles.stopETA}>
                  ETA: {nextStop.estimated_arrival || 'Calculating...'}
                </Text>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.navigateButton]}
                  onPress={handleNavigateToNextStop}
                  disabled={isNavigating}
                >
                  <Icon name="navigation" size={20} color="white" />
                  <Text style={styles.buttonText}>
                    {isNavigating ? 'Starting Navigation...' : 'Navigate to Next Stop'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Navigation Instructions */}
          {navigationInstructions && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Navigation Instructions</Text>
              <View style={styles.instructionsCard}>
                <Text style={styles.routeInfo}>
                  Distance: {navigationInstructions.route?.distance || 'N/A'}
                </Text>
                <Text style={styles.routeInfo}>
                  Duration: {navigationInstructions.route?.duration || 'N/A'}
                </Text>
                
                {navigationInstructions.route?.steps?.map((step: any, index: number) => (
                  <View key={index} style={styles.stepItem}>
                    <Text style={styles.stepInstruction}>{step.instruction}</Text>
                    <Text style={styles.stepDistance}>{step.distance} - {step.duration}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Ride Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ride Summary</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Fare:</Text>
                <Text style={styles.summaryValue}>PKR {ride.total_fare}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Distance:</Text>
                <Text style={styles.summaryValue}>{ride.distance_km || 'N/A'} km</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Duration:</Text>
                <Text style={styles.summaryValue}>{ride.duration_minutes || 'N/A'} min</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Stops:</Text>
                <Text style={styles.summaryValue}>
                  {ride.completed_stops_count}/{ride.active_stops_count}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    padding: 20,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  rideId: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  mapContainer: {
    height: height * 0.4,
  },
  map: {
    flex: 1,
  },
  detailsContainer: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: BrandColors.primary,
  },
  passengerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  passengerPhone: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  passengerRating: {
    fontSize: 14,
    color: '#f59e0b',
    fontWeight: '500',
  },
  stopCard: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  stopAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  stopStatus: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  stopETA: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  completeButton: {
    backgroundColor: '#10b981',
  },
  navigateButton: {
    backgroundColor: '#3b82f6',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  instructionsCard: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#8b5cf6',
  },
  routeInfo: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  stepItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  stepInstruction: {
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 4,
  },
  stepDistance: {
    fontSize: 12,
    color: '#6b7280',
  },
  summaryCard: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
});

export default DriverRideScreen;
