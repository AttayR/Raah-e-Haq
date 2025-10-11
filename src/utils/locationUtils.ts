import { Platform } from 'react-native';

// Default locations for different cities
export const DEFAULT_LOCATIONS = {
  lahore: {
    latitude: 31.5204,
    longitude: 74.3587,
    city: 'Lahore, Pakistan'
  },
  karachi: {
    latitude: 24.8607,
    longitude: 67.0011,
    city: 'Karachi, Pakistan'
  },
  islamabad: {
    latitude: 33.6844,
    longitude: 73.0479,
    city: 'Islamabad, Pakistan'
  },
  default: {
    latitude: 31.5204,
    longitude: 74.3587,
    city: 'Lahore, Pakistan'
  }
};

// Check if running on Android emulator
export const isAndroidEmulator = (): boolean => {
  return Platform.OS === 'android' && __DEV__;
};

// Get default location for emulator
export const getDefaultLocation = () => {
  return DEFAULT_LOCATIONS.default;
};

// Mock location for testing
export const mockLocation = {
  latitude: 31.5204,
  longitude: 74.3587,
  accuracy: 10,
  altitude: 0,
  heading: 0,
  speed: 0,
  timestamp: Date.now(),
};
