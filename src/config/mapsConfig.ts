// Google Maps Configuration
export const MAPS_CONFIG = {
  // Google Maps API Key
  API_KEY: 'AIzaSyB9UdTqlABhdZsmv3oswAm9nfrbPF5NLsI',
  
  // Default map settings
  DEFAULT_REGION: {
    latitude: 24.8607, // Karachi, Pakistan
    longitude: 67.0011,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  },
  
  // Map styles
  MAP_STYLES: {
    standard: [],
    dark: [
      {
        elementType: 'geometry',
        stylers: [{ color: '#242f3e' }],
      },
      {
        elementType: 'labels.text.stroke',
        stylers: [{ color: '#242f3e' }],
      },
      {
        elementType: 'labels.text.fill',
        stylers: [{ color: '#746855' }],
      },
    ],
  },
  
  // Location settings
  LOCATION_SETTINGS: {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 10000,
  },
  
  // Map markers
  MARKERS: {
    pickup: {
      color: '#10b981', // Green
      title: 'Pickup Location',
    },
    destination: {
      color: '#ef4444', // Red
      title: 'Destination',
    },
    driver: {
      color: '#3b82f6', // Blue
      title: 'Available Driver',
    },
    currentLocation: {
      color: '#8b5cf6', // Purple
      title: 'Your Location',
    },
  },
  
  // Fare calculation settings
  FARE_SETTINGS: {
    baseFare: 50, // PKR
    perKmRate: 25, // PKR per km
    surgeMultiplier: {
      peakHours: 1.5,
      weekend: 1.2,
      weather: 1.3,
    },
  },
  
  // Map controls
  CONTROLS: {
    showUserLocation: true,
    showMyLocationButton: true,
    showCompass: true,
    showScale: true,
  },
};

export default MAPS_CONFIG;
