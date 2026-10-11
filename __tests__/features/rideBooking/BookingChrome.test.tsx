/**
 * T-604: booking map chrome. Controls sit below the status bar / Dynamic Island, the trip
 * card's chips wrap instead of clipping, the sheet rides above the keyboard on iOS and reports
 * its height (T-314); nearby drivers are car markers.
 */
import React from 'react';
import { Keyboard, StyleSheet } from 'react-native';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import { DarkTheme, LightTheme, type AppTheme } from '../../../src/theme';
import { MapTopControls } from '../../../src/features/ride-booking/components/MapTopControls';
import { TripSummaryCard } from '../../../src/features/ride-booking/components/TripSummaryCard';
import { BookingSheet } from '../../../src/features/ride-booking/components/BookingSheet';
import { NearbyDriverMarkers } from '../../../src/components/passenger/NearbyDrivers';
import { useKeyboardHeight } from '../../../src/hooks/useKeyboardHeight';
import { AppText } from '../../../src/components/ui/AppText';
import LocationSearch from '../../../src/components/passenger/LocationSearch';
import { fetchAutocomplete } from '../../../src/services/placesService';

jest.mock('../../../src/services/placesService', () => ({
  fetchAutocomplete: jest.fn(),
  fetchPlaceDetails: jest.fn(),
}));
const mockAutocomplete = fetchAutocomplete as jest.Mock;

let mockTheme: AppTheme = LightTheme;
jest.mock('../../../src/app/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: mockTheme, scheme: 'system', setScheme: jest.fn() }),
}));
// Notched phone: 47 pt top inset, 34 pt home indicator.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

type Listener = (e: { endCoordinates: { height: number } }) => void;
const keyboardListeners: Record<string, Listener> = {};
beforeEach(() => {
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: Listener) => {
    keyboardListeners[event] = cb;
    return { remove: jest.fn() };
  }) as never);
});
afterEach(() => jest.restoreAllMocks());

describe.each([
  ['light', LightTheme],
  ['dark', DarkTheme],
] as const)('booking chrome (%s)', (_mode, theme) => {
  beforeEach(() => {
    mockTheme = theme;
  });

  it('map controls start at insets.top + 8, all labelled; reset hidden during a ride', () => {
    const handlers = { onBack: jest.fn(), onRecenter: jest.fn(), onReset: jest.fn(), onOpenAdvanced: jest.fn() };
    const { getByLabelText, getByTestId, queryByLabelText, rerender } = render(<MapTopControls {...handlers} />);
    expect(StyleSheet.flatten(getByTestId('map-top-controls').props.style)).toMatchObject({ top: 55 });
    fireEvent.press(getByLabelText('Back'));
    fireEvent.press(getByLabelText('Show my location'));
    fireEvent.press(getByLabelText('Start over'));
    fireEvent.press(getByLabelText('More ride options'));
    Object.values(handlers).forEach((h) => expect(h).toHaveBeenCalledTimes(1));
    rerender(<MapTopControls {...handlers} onReset={undefined} />);
    expect(queryByLabelText('Start over')).toBeNull();
  });

  it('trip card: addresses on one line each, chips in a wrapping row', () => {
    const onSwap = jest.fn();
    const { getByText, getByTestId } = render(
      <TripSummaryCard
        label="Trip details"
        pickup="G9C5+5F5, Block N Gulberg III, Lahore, Pakistan"
        dropoff="Liberty Market Gulberg III, Lahore, Pakistan"
        meta="2.26 km • 6 min"
        actions={[
          { label: 'Edit pickup', onPress: jest.fn() },
          { label: 'Edit drop-off', onPress: jest.fn() },
          { label: 'Swap', onPress: onSwap, testID: 'swap-trip' },
        ]}
      />,
    );
    expect(getByText('Liberty Market Gulberg III, Lahore, Pakistan').props.numberOfLines).toBe(1);
    const swap = getByTestId('swap-trip');
    expect(StyleSheet.flatten(getByTestId('trip-summary-actions').props.style)).toMatchObject({ flexWrap: 'wrap' });
    fireEvent.press(swap);
    expect(onSwap).toHaveBeenCalled();
  });

  it('sheet: bottom inset padding, rises with the keyboard, reports its height', () => {
    const onHeightChange = jest.fn();
    const { getByTestId } = render(
      <BookingSheet onHeightChange={onHeightChange}>
        <AppText>content</AppText>
      </BookingSheet>,
    );
    const sheet = getByTestId('booking-sheet');
    expect(StyleSheet.flatten(sheet.props.style)).toMatchObject({ bottom: 0, backgroundColor: theme.colors.surface });
    fireEvent(sheet, 'layout', { nativeEvent: { layout: { height: 320, width: 375, x: 0, y: 0 } } });
    expect(onHeightChange).toHaveBeenCalledWith(320);
    act(() => keyboardListeners.keyboardWillShow?.({ endCoordinates: { height: 291 } }));
    expect(StyleSheet.flatten(getByTestId('booking-sheet').props.style)).toMatchObject({ bottom: 291 });
  });

  it('sheet: maxHeightRatio caps the height while the keyboard is down', () => {
    const { getByTestId } = render(
      <BookingSheet maxHeightRatio={0.5}>
        <AppText>content</AppText>
      </BookingSheet>,
    );
    // Test window is 750 x 1334 (RN jest preset): half = 667.
    expect(StyleSheet.flatten(getByTestId('booking-sheet').props.style).maxHeight).toBe(667);
  });

  it('nearby drivers render as car badges, not pins', () => {
    const { getByTestId } = render(
      <NearbyDriverMarkers
        drivers={[{ id: 'a1', rating: 4.5, vehicle_type: 'car', distance_km: 1, estimated_arrival_min: 2, location: { latitude: 31.5, longitude: 74.3 } }]}
      />,
    );
    const marker = getByTestId('nearby-driver-a1');
    expect(marker.props.pinColor).toBeUndefined();
    // Nearby (not assigned) drivers are drawn muted, 60% opacity.
    expect(StyleSheet.flatten(getByTestId('nearby-driver-a1-glyph').props.style)).toMatchObject({ opacity: 0.6 });
    expect(marker.props.anchor).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe('useKeyboardHeight', () => {
  it('tracks the keyboard height and drops to 0 on hide', () => {
    const { result } = renderHook(() => useKeyboardHeight());
    expect(result.current).toBe(0);
    act(() => keyboardListeners.keyboardWillShow?.({ endCoordinates: { height: 300 } }));
    expect(result.current).toBe(300);
    act(() => keyboardListeners.keyboardWillHide?.({ endCoordinates: { height: 0 } }));
    expect(result.current).toBe(0);
  });
});

describe('LocationSearch states', () => {
  beforeEach(() => {
    mockTheme = LightTheme;
    mockAutocomplete.mockReset();
  });

  const Harness: React.FC<{ initial?: string; onChooseOnMap?: () => void }> = ({ initial = '', onChooseOnMap }) => {
    const [q, setQ] = React.useState(initial);
    return <LocationSearch mode="destination" query={q} onChangeQuery={setQ} onSelect={jest.fn()} onChooseOnMap={onChooseOnMap} />;
  };

  it('does not search prefilled text, only what the passenger types', async () => {
    mockAutocomplete.mockResolvedValue([]);
    render(<Harness initial="Current location" />);
    await act(async () => {});
    expect(mockAutocomplete).not.toHaveBeenCalled();
  });

  it('no results: "No places found" then "Set location on map"', async () => {
    mockAutocomplete.mockResolvedValue([]);
    const onChooseOnMap = jest.fn();
    const { getByTestId, findByText, getByLabelText } = render(<Harness onChooseOnMap={onChooseOnMap} />);
    fireEvent.changeText(getByTestId('location-search-destination'), 'zzqx');
    expect(await findByText('No places found')).toBeTruthy();
    fireEvent.press(getByLabelText('Set location on map'));
    expect(onChooseOnMap).toHaveBeenCalled();
  });

  it('search error: danger banner and the map fallback', async () => {
    mockAutocomplete.mockRejectedValue(new Error('quota'));
    const { getByTestId, findByText } = render(<Harness onChooseOnMap={jest.fn()} />);
    fireEvent.changeText(getByTestId('location-search-destination'), 'Liberty');
    expect(await findByText("Search isn't working right now.")).toBeTruthy();
    expect(getByTestId('location-search-on-map')).toBeTruthy();
  });

  it('results: rows, no empty or error state', async () => {
    mockAutocomplete.mockResolvedValue([
      { place_id: 'p1', description: 'Liberty Market, Lahore', structured_formatting: { main_text: 'Liberty Market', secondary_text: 'Lahore' } },
    ]);
    const { getByTestId, findByText, queryByTestId } = render(<Harness onChooseOnMap={jest.fn()} />);
    fireEvent.changeText(getByTestId('location-search-destination'), 'Liberty');
    expect(await findByText('Liberty Market')).toBeTruthy();
    expect(queryByTestId('location-search-empty')).toBeNull();
    expect(queryByTestId('location-search-on-map')).toBeNull();
  });
});
