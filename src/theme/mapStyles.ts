/**
 * Google Maps style JSON (DESIGN_SYSTEM §9), passed as `customMapStyle` to react-native-maps.
 * Wired into the map components by T-609.
 */
import type { ColorMode } from './tokens';

export type MapStyleRule = {
  featureType?: string;
  elementType?: string;
  stylers: Array<Record<string, string | number>>;
};

export const lightMapStyle: MapStyleRule[] = [
  { elementType: 'geometry', stylers: [{ color: '#F2F2F2' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#C9D8EE' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#E1E4EB' }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ weight: 1.2 }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#E8ECF5' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#626B82' }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#858EA5' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.medical', elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
  { featureType: 'transit.station', elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
];

export const darkMapStyle: MapStyleRule[] = [
  { elementType: 'geometry', stylers: [{ color: '#1D2230' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9099B0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1D2230' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0F1A2E' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2B3247' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#343C55' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9099B0' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit.station', stylers: [{ visibility: 'on' }] },
];

export const mapStyles: Record<ColorMode, MapStyleRule[]> = {
  light: lightMapStyle,
  dark: darkMapStyle,
};
