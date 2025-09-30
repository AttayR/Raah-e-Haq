import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export const useLocation = () => {
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationTimeout, setInitializationTimeout] = useState(false);
  const [hasFinePermission, setHasFinePermission] = useState(false);
  const [hasCoarsePermission, setHasCoarsePermission] = useState(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestLocationPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const fineGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        const coarseGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
        );

        if (fineGranted || coarseGranted) {
          setHasFinePermission(fineGranted);
          setHasCoarsePermission(coarseGranted);
          return true;
        }

        // Request FINE; user may select approximate (COARSE)
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

        // After request, re-check both
        const fineNow = granted === PermissionsAndroid.RESULTS.GRANTED && (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION));
        const coarseNow = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
        setHasFinePermission(!!fineNow);
        setHasCoarsePermission(!!coarseNow);
        return !!fineNow || !!coarseNow;
      } catch (err) {
        console.warn('Permission request error:', err);
        setHasFinePermission(false);
        setHasCoarsePermission(false);
        return false;
      }
    }
    return true;
  }, []);

  const getCurrentLocation = useCallback(() => {
    try {
      Geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          console.log('Location obtained:', { latitude, longitude });
          setCurrentLocation({ latitude, longitude });
        },
        (error) => {
          console.warn('Location error:', error);
          
          // Don't retry indefinitely - limit retries
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          
          // Only retry if we haven't gotten a location yet
          if (!currentLocation) {
            retryTimerRef.current = setTimeout(() => {
              getCurrentLocation();
            }, 3000);
          }
        },
        {
          enableHighAccuracy: hasFinePermission, // only request high accuracy if precise granted
          timeout: 15000,
          maximumAge: 30000, // Accept location up to 30 seconds old
        }
      );
    } catch (e) {
      console.warn('Location service error:', e);
      // Fallback: set a default location if all else fails
      if (!currentLocation) {
        console.log('Setting fallback location');
        setCurrentLocation({ latitude: 24.8607, longitude: 67.0011 }); // Karachi, Pakistan
      }
    }
  }, [hasFinePermission, currentLocation]);

  useEffect(() => {
    const init = async () => {
      try {
        // Configure Geolocation service
        Geolocation.setRNConfiguration({
          skipPermissionRequests: false,
          authorizationLevel: 'whenInUse',
        });

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
      } catch (error) {
        console.warn('Location initialization error:', error);
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
    hasFinePermission,
    hasCoarsePermission,
  };
};

export default useLocation;


