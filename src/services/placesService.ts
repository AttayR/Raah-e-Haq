import MAPS_CONFIG from '../config/mapsConfig';

export type AutocompleteItem = {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
};

export async function fetchAutocomplete(query: string): Promise<AutocompleteItem[]> {
  if (!query || query.length < 2) return [];
  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${MAPS_CONFIG.API_KEY}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== 'OK') return [];
  return json.predictions as AutocompleteItem[];
}

export async function fetchPlaceDetails(placeId: string): Promise<{ latitude: number; longitude: number; address?: string } | null> {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=geometry/location,formatted_address&key=${MAPS_CONFIG.API_KEY}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== 'OK' || !json.result?.geometry?.location) return null;
  const { lat, lng } = json.result.geometry.location;
  return { latitude: lat, longitude: lng, address: json.result.formatted_address };
}

// Fallback reverse geocoding using OpenStreetMap Nominatim (free, no API key needed)
async function fallbackReverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
    console.log('Fallback reverse geocoding URL:', url);
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'RaaHeHaq/1.0'
      }
    });
    
    if (!res.ok) {
      console.error('Fallback reverse geocoding HTTP error:', res.status);
      return null;
    }
    
    const json = await res.json();
    console.log('Fallback reverse geocoding response:', json);
    
    if (json.display_name) {
      console.log('Fallback reverse geocoding success:', json.display_name);
      return json.display_name;
    }
    
    return null;
  } catch (error) {
    console.error('Fallback reverse geocoding error:', error);
    return null;
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_CONFIG.API_KEY}`;
    console.log('Reverse geocoding URL:', url);
    
    const res = await fetch(url);
    console.log('Reverse geocoding response status:', res.status);
    
    if (!res.ok) {
      console.error('Reverse geocoding HTTP error:', res.status, res.statusText);
      return await fallbackReverseGeocode(lat, lng);
    }
    
    const json = await res.json();
    console.log('Reverse geocoding response:', json);
    
    if (json.status !== 'OK') {
      console.error('Reverse geocoding API error:', json.status, json.error_message);
      console.log('Trying fallback reverse geocoding...');
      return await fallbackReverseGeocode(lat, lng);
    }
    
    if (!json.results?.length) {
      console.warn('No results from reverse geocoding, trying fallback...');
      return await fallbackReverseGeocode(lat, lng);
    }
    
    const address = json.results[0].formatted_address;
    console.log('Reverse geocoding success:', address);
    return address;
  } catch (error) {
    console.error('Reverse geocoding fetch error:', error);
    console.log('Trying fallback reverse geocoding...');
    return await fallbackReverseGeocode(lat, lng);
  }
}


