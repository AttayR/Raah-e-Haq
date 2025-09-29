import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import RatingModal from '../../components/RatingModal';
import { rateRide } from '../../services/rideService';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useRoute, useNavigation } from '@react-navigation/native';
import { BrandColors } from '../../theme/colors';
import { listenToActiveRide, RideRequest } from '../../services/rideService';
import useDirections from '../../hooks/useDirections';

type Params = { rideId?: string; passengerId: string };

const PassengerRideTrackingScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const mapRef = useRef<MapView>(null);
  const { routeCoordinates, fetchRoute } = useDirections();

  const passengerId: string = route.params?.passengerId;
  const [ride, setRide] = useState<RideRequest | null>(null);
  const [showRating, setShowRating] = useState(false);

  useEffect(() => {
    if (!passengerId) return;
    const unsub = listenToActiveRide(passengerId, (r) => {
      setRide(r);
      if (r?.pickup && r?.destination) {
        fetchRoute(r.pickup as any, r.destination as any);
      }
    });
    return () => unsub && unsub();
  }, [passengerId, fetchRoute]);

  useEffect(() => {
    if (ride?.pickup) {
      mapRef.current?.animateToRegion({
        latitude: ride.pickup.latitude,
        longitude: ride.pickup.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
  }, [ride?.pickup]);

  const driverCoord = ride?.driverId && (ride as any).driverLocation ? (ride as any).driverLocation : null;

  useEffect(() => {
    if (ride?.status === 'completed') {
      setShowRating(true);
    }
  }, [ride?.status]);

  const submitRating = async (rating: number) => {
    if (!ride?.id) return;
    await rateRide(ride.id, rating, '', 'passenger');
    setShowRating(false);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <MapView ref={mapRef} style={StyleSheet.absoluteFill}>
        {ride?.pickup && (
          <Marker coordinate={ride.pickup as any} title="Pickup" pinColor={BrandColors.primary} />
        )}
        {ride?.destination && (
          <Marker coordinate={ride.destination as any} title="Destination" pinColor="#ef4444" />
        )}
        {driverCoord && (
          <Marker coordinate={driverCoord} title="Driver" pinColor="#3b82f6" />
        )}
        {routeCoordinates.length > 0 && (
          <Polyline coordinates={routeCoordinates as any} strokeWidth={5} strokeColor={BrandColors.primary} />
        )}
      </MapView>

      <View style={styles.panel}>
        <Text style={styles.title}>Ride Status: {ride?.status || 'waiting'}</Text>
        {ride?.driverName && (
          <Text style={styles.subtitle}>Driver: {ride.driverName} · {ride.vehicleInfo?.brand} {ride.vehicleInfo?.model}</Text>
        )}
        <View style={styles.row}>
          <Text style={styles.value}>Fare: PKR {ride?.fare ?? '-'}</Text>
          <Text style={styles.value}>{ride?.distance ?? ''} · {ride?.duration ?? ''}</Text>
        </View>
      </View>

      <RatingModal visible={showRating} onSubmit={submitRating} onClose={() => setShowRating(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  subtitle: { marginTop: 6, color: '#374151' },
  row: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  value: { color: '#374151', fontWeight: '600' },
});

export default PassengerRideTrackingScreen;


