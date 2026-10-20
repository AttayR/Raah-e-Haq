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

// The service area's default point (map centre before a fix). T-593: never a stand-in for the
// device's position; an emulator is given a position with `adb emu geo fix <lng> <lat>`.
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
