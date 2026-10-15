/**
 * T-540: a loading map shows the theme's land colour, not Google's (dark) grey: the map is pinned
 * to the app theme (Google Maps otherwise follows the phone's dark mode until the style applies)
 * and paints the style's background behind the tiles. Booking's placeholder uses it too.
 */
import React from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import SafeMapView from '../../src/components/SafeMapView';
import { MapPlaceholder } from '../../src/features/ride-booking/components/BookingNotices';
import { DarkTheme, LightTheme, mapBackgrounds, mapStyles } from '../../src/theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
const mockScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

const renderThemed = async (ui: React.ReactElement, mode: 'light' | 'dark') => {
  mockScheme.mockReturnValue(mode);
  render(<ThemeProvider>{ui}</ThemeProvider>);
  await act(async () => {});
};

describe('SafeMapView theme while loading (T-540)', () => {
  it.each([
    ['light', LightTheme],
    ['dark', DarkTheme],
  ] as const)('%s: map follows the app theme and shows the style land colour behind the tiles', async (mode, theme) => {
    await renderThemed(<SafeMapView testID="map" style={StyleSheet.absoluteFill} customMapStyle={theme.mapStyle} />, mode);
    const map = screen.getByTestId('map');
    expect(map.props.userInterfaceStyle).toBe(mode);
    expect(StyleSheet.flatten(map.props.style).backgroundColor).toBe(mapBackgrounds[mode]);
    expect(StyleSheet.flatten(map.props.style).position).toBe('absolute'); // the caller's style still applies
    expect(map.props.loadingBackgroundColor).toBe(mapBackgrounds[mode]);
  });

  it('the background is the style land colour (one source)', () => {
    expect(mapStyles.light[0]).toEqual({ elementType: 'geometry', stylers: [{ color: mapBackgrounds.light }] });
    expect(mapStyles.dark[0]).toEqual({ elementType: 'geometry', stylers: [{ color: mapBackgrounds.dark }] });
    expect(LightTheme.mapBackground).toBe(mapBackgrounds.light);
  });

  it('booking map placeholder uses the map background, not a grey surface', async () => {
    await renderThemed(<MapPlaceholder message="Loading map…" />, 'light');
    const fills = screen.UNSAFE_getAllByType(View).map((v) => StyleSheet.flatten(v.props.style)?.backgroundColor);
    expect(fills).toContain(mapBackgrounds.light);
    expect(fills).not.toContain(LightTheme.colors.surfaceAlt);
  });
});
