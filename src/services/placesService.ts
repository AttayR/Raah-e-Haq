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

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_CONFIG.API_KEY}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== 'OK' || !json.results?.length) return null;
  return json.results[0].formatted_address as string;
}


