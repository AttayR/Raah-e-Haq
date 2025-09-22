import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export const useLocation = () => {
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationTimeout, setInitializationTimeout] = useState(false);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  const requestLocationPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (hasPermission) return true;
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'RaaHeHaq needs access to your location to find nearby drivers and show your position on the map.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'Allow',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Permission request error:', err);
        return false;
      }
    }
    return true;
  }, []);

  const getCurrentLocation = useCallback(() => {
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ latitude, longitude });
      },
      () => {
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          getCurrentLocation();
        }, 2000);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
        showLocationDialog: true,
        forceRequestLocation: true,
      }
    );
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const hasPermission = await requestLocationPermission();
        if (hasPermission) {
          setTimeout(() => {
            getCurrentLocation();
            setIsInitialized(true);
          }, 1000);
        } else {
          Alert.alert(
            'Permission Required',
            'Location permission is required to use this feature. Please enable it in settings.'
          );
          setIsInitialized(true);
        }
      } catch {
        Alert.alert('Error', 'Failed to initialize location services');
        setIsInitialized(true);
      }
    };

    const timeout = setTimeout(() => {
      setInitializationTimeout(true);
      setIsInitialized(true);
    }, 10000);

    init();
    return () => {
      clearTimeout(timeout);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [requestLocationPermission, getCurrentLocation]);

  return {
    currentLocation,
    isInitialized,
    initializationTimeout,
    getCurrentLocation,
    setCurrentLocation,
  };
};

export default useLocation;


