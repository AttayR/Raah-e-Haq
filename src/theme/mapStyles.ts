/**
 * Google Maps style JSON (DESIGN_SYSTEM §9), passed as `customMapStyle` to react-native-maps.
 * Wired into the map components by T-609; brand-tinted in UI-R20b (passenger-home V8).
 */
import type { ColorMode } from './tokens';

export type MapStyleRule = {
  featureType?: string;
  elementType?: string;
  stylers: Array<Record<string, string | number>>;
};

/**
 * The land colour of each style: also the map's background before its tiles draw, so a loading
 * map shows the theme instead of Google's grey (T-540), and the Home entrance veil (UI-R20b V7).
 */
export const mapBackgrounds: Record<ColorMode, string> = {
  light: '#F3F5F9',
  dark: '#1B2233',
};

/**
 * [UI-R20b] Brand-tinted light style (passenger-home V8): cool navy-tinted land, soft parks and
 * water, white roads with a light edge, navy-tinted highways, quiet labels; business POIs off,
 * medical and transit kept. Every map in the app reads it through `theme.mapStyle`.
 */
export const lightMapStyle: MapStyleRule[] = [
  { elementType: 'geometry', stylers: [{ color: mapBackgrounds.light }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#E3EEE6' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#CCDBF2' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#E1E5EE' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ weight: 1.2 }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#E4EAF7' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#CDD7EE' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#626B82' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#4C556C' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#858EA5' }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#858EA5' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.medical', elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#DADFEA' }] },
  { featureType: 'transit.station', elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
];

/** [UI-R20b] Brand-tinted dark style (passenger-home V8): navy-tinted highways, calm labels, POIs off. */
export const darkMapStyle: MapStyleRule[] = [
  { elementType: 'geometry', stylers: [{ color: mapBackgrounds.dark }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8A94AD' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: mapBackgrounds.dark }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#B7BFD0' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1A2A2A' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0E1830' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#283149' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: mapBackgrounds.dark }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#2E3852' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#34426B' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#283149' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8A94AD' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit.station', stylers: [{ visibility: 'on' }] },
];

export const mapStyles: Record<ColorMode, MapStyleRule[]> = {
  light: lightMapStyle,
  dark: darkMapStyle,
};
