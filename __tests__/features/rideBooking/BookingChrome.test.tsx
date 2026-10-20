/**
 * T-604: booking map chrome. Controls sit below the status bar / Dynamic Island, the trip
 * card's chips wrap instead of clipping, the sheet rides above the keyboard on iOS and reports
 * its height (T-314); nearby drivers are top-down vehicle markers (T-586).
 */
import React from 'react';
import { Keyboard, StyleSheet } from 'react-native';
import { act, fireEvent, render, renderHook, within } from '@testing-library/react-native';
import { DarkTheme, LightTheme, type AppTheme } from '../../../src/theme';
import { MapTopControls } from '../../../src/features/ride-booking/components/MapTopControls';
import { useSharedValue } from 'react-native-reanimated';
import { BookingSheet } from '../../../src/features/ride-booking/components/BookingSheet';
import { NearbyVehicleMarkers } from '../../../src/features/nearby-vehicles';
import { useKeyboardHeight } from '../../../src/hooks/useKeyboardHeight';
import { AppText } from '../../../src/components/ui/AppText';
import LocationSearch, { replaceLabelEdit } from '../../../src/components/passenger/LocationSearch';
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

  it('UI-R10 (§9): two map controls only, back and locate; no start over', () => {
    const SheetHeight = ({ onBack, onRecenter }: { onBack: () => void; onRecenter: () => void }) => {
      const height = useSharedValue(320);
      return <MapTopControls onBack={onBack} onRecenter={onRecenter} sheetHeight={height} />;
    };
    const onBack = jest.fn();
    const onRecenter = jest.fn();
    const { getByLabelText, queryByLabelText, queryByTestId } = render(<SheetHeight onBack={onBack} onRecenter={onRecenter} />);
    fireEvent.press(getByLabelText('Back'));
    fireEvent.press(getByLabelText('Show my location'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onRecenter).toHaveBeenCalledTimes(1);
    // T-553: no legacy "+" Request Ride entry point; UI-R10: no "Start over" (refresh) control.
    expect(queryByLabelText('More ride options')).toBeNull();
    expect(queryByLabelText('Start over')).toBeNull();
    expect(queryByTestId('map-reset')).toBeNull();
  });

  it('T-549 / UI-R10: after a pan on the live ride the end-side control follows the ride again', () => {
    const recentre = jest.fn();
    const onRecenter = jest.fn();
    const Follow = ({ visible }: { visible: boolean }) => {
      const height = useSharedValue(0);
      return <MapTopControls onBack={jest.fn()} onRecenter={onRecenter} sheetHeight={height} followRide={{ visible, onPress: recentre }} />;
    };
    const { getByTestId, queryByTestId, rerender } = render(<Follow visible={false} />);
    expect(queryByTestId('ride-recentre')).toBeNull();
    rerender(<Follow visible />);
    expect(queryByTestId('map-recenter')).toBeNull();
    fireEvent.press(getByTestId('ride-recentre'));
    expect(recentre).toHaveBeenCalledTimes(1);
    expect(onRecenter).not.toHaveBeenCalled();
    expect(getByTestId('ride-recentre').props.accessibilityLabel).toBe('Follow your ride on the map');
  });

  it('UI-R10: the sheet draws its top accessory flush at the top, inside the radius clip', () => {
    const { getByTestId } = render(
      <BookingSheet topAccessory={<AppText>bar</AppText>}>
        <AppText>content</AppText>
      </BookingSheet>,
    );
    expect(StyleSheet.flatten(getByTestId('booking-sheet-top-accessory').props.style)).toMatchObject({
      position: 'absolute',
      top: 0,
      overflow: 'hidden',
      borderTopLeftRadius: 24,
    });
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

  it('sheet footer (T-564): pinned under the scroll, insets.bottom + 8 below it, 8 above the keyboard', () => {
    const onDone = jest.fn();
    const { getByTestId, getByText } = render(
      <BookingSheet maxHeightRatio={0.5} footer={<AppText onPress={onDone}>Done</AppText>}>
        <AppText>Receipt</AppText>
      </BookingSheet>,
    );
    const footer = getByTestId('booking-sheet-footer');
    // Clear of the 34 pt home indicator, and outside the scroll (so long content never cuts it off).
    expect(StyleSheet.flatten(footer.props.style)).toMatchObject({ paddingBottom: 42, paddingTop: 16, paddingHorizontal: 16 });
    expect(StyleSheet.flatten(getByTestId('booking-sheet-scroll').props.contentContainerStyle).paddingBottom).toBe(16);
    expect(within(getByTestId('booking-sheet-scroll')).queryByText('Done')).toBeNull();
    fireEvent.press(getByText('Done'));
    expect(onDone).toHaveBeenCalledTimes(1);
    act(() => keyboardListeners.keyboardWillShow?.({ endCoordinates: { height: 291 } }));
    expect(StyleSheet.flatten(getByTestId('booking-sheet-footer').props.style).paddingBottom).toBe(8);
  });

  it('sheet without a footer keeps the inset under its content', () => {
    const { getByTestId, queryByTestId } = render(
      <BookingSheet>
        <AppText>content</AppText>
      </BookingSheet>,
    );
    expect(queryByTestId('booking-sheet-footer')).toBeNull();
    expect(StyleSheet.flatten(getByTestId('booking-sheet-scroll').props.contentContainerStyle).paddingBottom).toBe(50);
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

  it('sheet: content scrolls below a fixed 24 pt handle band, with a hairline once scrolled (T-539)', () => {
    const { getByTestId } = render(
      <BookingSheet maxHeightRatio={0.5}>
        <AppText>Bilal</AppText>
      </BookingSheet>,
    );
    // The scroll (and its clipping) starts 24 below the top, never right under the handle.
    expect(StyleSheet.flatten(getByTestId('booking-sheet-handle-area').props.style)).toMatchObject({ height: 24, paddingTop: 8 });
    expect(StyleSheet.flatten(getByTestId('booking-sheet-scroll').props.contentContainerStyle).paddingTop).toBeUndefined();
    expect(StyleSheet.flatten(getByTestId('booking-sheet-handle-area').props.style).borderBottomWidth).toBeUndefined();

    fireEvent.scroll(getByTestId('booking-sheet-scroll'), { nativeEvent: { contentOffset: { x: 0, y: 40 } } });
    expect(StyleSheet.flatten(getByTestId('booking-sheet-handle-area').props.style)).toMatchObject({
      borderBottomWidth: theme.borderWidth.thin,
      borderBottomColor: theme.colors.border,
    });
    fireEvent.scroll(getByTestId('booking-sheet-scroll'), { nativeEvent: { contentOffset: { x: 0, y: 0 } } });
    expect(StyleSheet.flatten(getByTestId('booking-sheet-handle-area').props.style).borderBottomWidth).toBeUndefined();
  });

  it('nearby drivers render as top-down vehicles, not pins (T-586: full opacity once in, no callout, no tap)', () => {
    jest.useFakeTimers();
    const { getByTestId } = render(
      <NearbyVehicleMarkers
        drivers={[{ id: 'a1', vehicle_type: 'car', distance_km: 1, estimated_arrival_min: 2, location: { latitude: 31.5, longitude: 74.3 }, heading: null }]}
      />,
    );
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    const marker = getByTestId('nearby-driver-a1');
    expect(marker.props.pinColor).toBeUndefined();
    expect(marker.props).toMatchObject({ anchor: { x: 0.5, y: 0.5 }, flat: true, tappable: false, zIndex: 0, opacity: 1 });
    expect(marker.props.title).toBeUndefined();
    expect(getByTestId('nearby-driver-a1-glyph').props).toMatchObject({ width: 40, height: 40 });
    jest.useRealTimers();
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

  describe('"Current location" is replaced by typing, not added to (T-551)', () => {
    const Pickup: React.FC<{ onChangeQuery?: (q: string) => void }> = ({ onChangeQuery }) => (
      <LocationSearch mode="pickup" query="Current location" replaceOnType="Current location" onChangeQuery={onChangeQuery} onSelect={jest.fn()} />
    );

    it('focus selects the label; once typed in, focus no longer selects', () => {
      mockAutocomplete.mockResolvedValue([]);
      const { getByTestId } = render(<Pickup />);
      const input = getByTestId('location-search-pickup');
      expect(input.props.selectTextOnFocus).toBe(true);
      fireEvent.changeText(input, 'G');
      expect(input.props.selectTextOnFocus).toBe(false);
    });

    it('a keystroke after the label keeps only what was typed', () => {
      mockAutocomplete.mockResolvedValue([]);
      const onChangeQuery = jest.fn();
      const { getByTestId } = render(<Pickup onChangeQuery={onChangeQuery} />);
      const input = getByTestId('location-search-pickup');
      fireEvent.changeText(input, 'Current locationG');
      expect(input.props.value).toBe('G');
      expect(onChangeQuery).toHaveBeenLastCalledWith('G');
      // Later keystrokes are ordinary typing.
      fireEvent.changeText(input, 'Ga');
      expect(input.props.value).toBe('Ga');
    });

    it('a field without the label types as before', () => {
      const { getByTestId } = render(
        <LocationSearch mode="pickup" query="Gulberg III" replaceOnType="Current location" onSelect={jest.fn()} />,
      );
      const input = getByTestId('location-search-pickup');
      expect(input.props.selectTextOnFocus).toBe(false);
      fireEvent.changeText(input, 'Gulberg III, Lahore');
      expect(input.props.value).toBe('Gulberg III, Lahore');
    });

    it('"Pinned on map" is replaced the same way, in the destination field too', () => {
      const labels = ['Current location', 'Pinned on map'];
      const { getByTestId } = render(
        <LocationSearch mode="destination" query="Pinned on map" replaceOnType={labels} onSelect={jest.fn()} />,
      );
      const input = getByTestId('location-search-destination');
      expect(input.props.selectTextOnFocus).toBe(true);
      fireEvent.changeText(input, 'Pinned on mapLiberty');
      expect(input.props.value).toBe('Liberty');
    });

    it.each([
      ['Current locationGaddafi Stadium', 'Gaddafi Stadium'],
      ['GCurrent location', 'G'],
      ['CurrentG location', 'G'],
      ['Current locatio', ''],
      ['G', 'G'],
      ['Current location', 'Current location'],
    ])('replaceLabelEdit(%p) is %p', (typed, expected) => {
      expect(replaceLabelEdit('Current location', typed)).toBe(expected);
    });
  });

  it('results: rows, no empty or error state', async () => {
    mockAutocomplete.mockResolvedValue([
      { place_id: 'p1', description: 'Liberty Market, Lahore', structured_formatting: { main_text: 'Liberty Market', secondary_text: 'Lahore' } },
    ]);
    const { getByTestId, findByText, queryByTestId } = render(<Harness onChooseOnMap={jest.fn()} />);
    fireEvent.changeText(getByTestId('location-search-destination'), 'Liberty');
    expect(await findByText('Liberty Market')).toBeTruthy();
    expect(queryByTestId('location-search-empty')).toBeNull();
  });
});
