import { env } from './env';
import { DEFAULT_LOCATIONS } from '../utils/locationUtils';

// Google Maps configuration: the key (from env) and the default region.
export const MAPS_CONFIG = {
  // Google Maps API Key (from the env config; never hardcode or log it)
  API_KEY: env.MAPS_KEY,
  
  // Default map settings
  // T-581: the service area (Lahore) while there is no position yet, the same city as
  // getDefaultLocation(); it was Karachi.
  DEFAULT_REGION: {
    latitude: DEFAULT_LOCATIONS.lahore.latitude,
    longitude: DEFAULT_LOCATIONS.lahore.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  },

  // UI-R19: the unused map style, marker colours, local fare numbers and control flags were
  // removed; the map style comes from src/theme (mapStyles) and fares from the server.
};

export default MAPS_CONFIG;
