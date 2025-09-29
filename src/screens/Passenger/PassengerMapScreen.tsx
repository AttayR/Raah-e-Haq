import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import MAPS_CONFIG from '../../config/mapsConfig';

const PassengerMapScreen = () => {
  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={MAPS_CONFIG.DEFAULT_REGION}
        showsUserLocation={MAPS_CONFIG.CONTROLS.showUserLocation}
        showsMyLocationButton={MAPS_CONFIG.CONTROLS.showMyLocationButton}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  map: { flex: 1 },
});

export default PassengerMapScreen;