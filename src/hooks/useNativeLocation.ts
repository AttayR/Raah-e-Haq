import { useState, useEffect, useCallback } from 'react';
import { Alert, Platform, Linking, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { isAndroidEmulator, getDefaultLocation } from '../utils/locationUtils';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationPermissionStatus {
  isGranted: boolean;
  canAskAgain: boolean;
  isLocationEnabled: boolean;
}

export const useNativeLocation = () => {
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus>({
    isGranted: false,
    canAskAgain: true,
    isLocationEnabled: false,
  });

  // Check location services status
  const checkLocationServices = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      // For Android emulator, always return true
      if (isAndroidEmulator()) {
        console.log('Android emulator detected, skipping location services check');
        resolve(true);
        return;
      }
      
      Geolocation.getCurrentPosition(
        () => resolve(true),
        (error) => {
          // Error codes 1 and 2 usually indicate location services are disabled
          resolve(error.code !== 1 && error.code !== 2);
        },
        { timeout: 5000, maximumAge: 60000 }
      );
    });
  }, []);

  // Check permission status
  const checkPermissionStatus = useCallback(async (): Promise<LocationPermissionStatus> => {
    if (Platform.OS === 'android') {
      try {
        const fineLocation = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        const coarseLocation = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
        );
        
        const isGranted = fineLocation || coarseLocation;
        const isLocationEnabled = await checkLocationServices();
        
        // For Android emulator, always return granted and enabled
        if (isAndroidEmulator()) {
          return {
            isGranted: true,
            canAskAgain: false,
            isLocationEnabled: true,
          };
        }
        
        return {
          isGranted,
          canAskAgain: !isGranted,
          isLocationEnabled,
        };
      } catch (error) {
        console.warn('Error checking Android permissions:', error);
        return {
          isGranted: false,
          canAskAgain: true,
          isLocationEnabled: false,
        };
      }
    } else {
      // iOS - Geolocation automatically handles permissions
      const isLocationEnabled = await checkLocationServices();
      return {
        isGranted: true, // iOS handles this automatically
        canAskAgain: false,
        isLocationEnabled,
      };
    }
  }, [checkLocationServices]);

  // Request location permission
  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      // For Android emulator, skip permission request and use default location
      if (isAndroidEmulator()) {
        console.log('Android emulator detected, using default location');
        const defaultLocation = getDefaultLocation();
        setCurrentLocation(defaultLocation);
        setPermissionStatus({
          isGranted: true,
          canAskAgain: false,
          isLocationEnabled: true,
        });
        setIsLoading(false);
        return true;
      }
      
      if (Platform.OS === 'android') {
        // Check current status first
        const currentStatus = await checkPermissionStatus();
        
        if (currentStatus.isGranted) {
          // Permission already granted, check if location services are enabled
          if (!currentStatus.isLocationEnabled) {
            Alert.alert(
              'Location Services Disabled',
              'Please enable location services in your device settings to use this feature.',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Open Settings', 
                  onPress: () => Linking.openSettings() 
                }
              ]
            );
            setIsLoading(false);
            return false;
          }
          
          // Get location
          await getCurrentLocation();
          setIsLoading(false);
          return true;
        }

        // Request permission
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'RaaHeHaq needs access to your location to find nearby drivers and show your position.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'Allow',
          }
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          // Permission granted, now check location services
          const isLocationEnabled = await checkLocationServices();
          
          if (!isLocationEnabled) {
            Alert.alert(
              'Location Services Disabled',
              'Location permission granted but location services are disabled. Please enable location services in settings.',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Open Settings', 
                  onPress: () => Linking.openSettings() 
                }
              ]
            );
            setIsLoading(false);
            return false;
          }
          
          // Get location
          await getCurrentLocation();
          setIsLoading(false);
          return true;
        } else {
          // Permission denied
          Alert.alert(
            'Location Permission Required',
            'Location access is required to use this feature. You can enable it later in app settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Open Settings', 
                onPress: () => Linking.openSettings() 
              }
            ]
          );
          setIsLoading(false);
          return false;
        }
      } else {
        // iOS - Just get location, iOS handles permissions automatically
        await getCurrentLocation();
        setIsLoading(false);
        return true;
      }
    } catch (error) {
      console.warn('Error requesting location permission:', error);
      setIsLoading(false);
      return false;
    }
  }, [checkPermissionStatus, checkLocationServices]);

  // Get current location
  const getCurrentLocation = useCallback((): Promise<Coordinates | null> => {
    return new Promise((resolve) => {
      // For Android emulator, use a default location if real location fails
      const isEmulator = Platform.OS === 'android' && __DEV__;
      
      Geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setCurrentLocation(location);
          resolve(location);
        },
        (error) => {
          console.warn('Location error:', error);
          
          // For Android emulator, use default location
          if (isEmulator && error.code === 3) { // TIMEOUT
            console.log('Using default location for Android emulator');
            const defaultLocation = getDefaultLocation();
            setCurrentLocation(defaultLocation);
            resolve(defaultLocation);
            return;
          }
          
          if (error.code === 1) {
            // Permission denied
            Alert.alert(
              'Location Permission Required',
              'Please allow location access to use this feature.',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Enable Location', 
                  onPress: () => requestLocationPermission() 
                }
              ]
            );
          } else if (error.code === 2) {
            // Location services disabled
            Alert.alert(
              'Location Services Disabled',
              'Please enable location services in your device settings.',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Open Settings', 
                  onPress: () => Linking.openSettings() 
                }
              ]
            );
          } else {
            // Other error
            Alert.alert(
              'Location Error',
              'Unable to get your current location. Please try again.',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Retry', 
                  onPress: () => getCurrentLocation() 
                }
              ]
            );
          }
          
          resolve(null);
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }, [requestLocationPermission]);

  // Initialize location
  const initializeLocation = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const status = await checkPermissionStatus();
      setPermissionStatus(status);
      
      if (status.isGranted && status.isLocationEnabled) {
        await getCurrentLocation();
      }
    } catch (error) {
      console.warn('Error initializing location:', error);
    } finally {
      setIsLoading(false);
    }
  }, [checkPermissionStatus, getCurrentLocation]);

  // Refresh location
  const refreshLocation = useCallback(async () => {
    if (permissionStatus.isGranted && permissionStatus.isLocationEnabled) {
      await getCurrentLocation();
    } else {
      await requestLocationPermission();
    }
  }, [permissionStatus, getCurrentLocation, requestLocationPermission]);

  // Initialize on mount
  useEffect(() => {
    initializeLocation();
  }, [initializeLocation]);

  return {
    currentLocation,
    isLoading,
    permissionStatus,
    requestLocationPermission,
    refreshLocation,
    getCurrentLocation,
  };
};

export default useNativeLocation;
