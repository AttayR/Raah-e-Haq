/**
 * T-582 part 2 (QA 2026-10-19): a point chosen on the map gets its address (one reverse geocode
 * per pick; UI-R9b: confirmed on the centre-pin picker), not "Pinned on map"; the planner's destination field is revealed with less room above
 * it than the row gap, so no sliver of the pickup row stays under the handle.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { reverseGeocode } from '../../../src/services/placesService';
import { useBookingFlow } from '../../../src/features/ride-booking/useBookingFlow';
import { BOOKING_COPY } from '../../../src/features/ride-booking/copy';
import { REVEAL_MARGIN, revealOffset } from '../../../src/components/ui/keyboardReveal';
import { DESTINATION_REVEAL_TOP } from '../../../src/components/passenger/DualLocationPicker';
import { space } from '../../../src/theme';

jest.mock('../../../src/services/placesService', () => ({
  fetchAutocomplete: jest.fn(() => Promise.resolve([])),
  fetchPlaceDetails: jest.fn(() => Promise.resolve(null)),
  reverseGeocode: jest.fn(() => Promise.resolve('Plot 65, Gulberg III, Lahore')),
}));

const mockGeocode = reverseGeocode as jest.MockedFunction<typeof reverseGeocode>;
const directions = { fetchRoute: jest.fn(), fetchRouteWithWaypoints: jest.fn(), clearRoute: jest.fn() };
const prefill = { pickup: null, destination: null, pickupQuery: '', destQuery: '', stage: 'home' as const, routePending: false, stops: [] };
/** UI-R9b: the centre-pin picker's confirm with no address yet (the flow looks it up once). */
const at = (latitude: number, longitude: number) => ({ latitude, longitude });

describe('choose on map shows the address (T-582)', () => {
  beforeEach(() => mockGeocode.mockClear());

  it('a tapped destination is geocoded once and the field and place take the address', async () => {
    const { result } = renderHook(() =>
      useBookingFlow({ prefill, currentLocation: null, rideShown: false, directions }),
    );
    act(() => result.current.setPickup({ latitude: 31.52, longitude: 74.35, address: 'Liberty' }));
    act(() => result.current.setMapPick('destination'));
    act(() => result.current.placeOnMap('destination', at(31.48, 74.3), null));
    expect(result.current.destField.text).toBe(BOOKING_COPY.pinnedOnMap);
    await waitFor(() => expect(result.current.destField.text).toBe('Plot 65, Gulberg III, Lahore'));
    expect(result.current.destination).toEqual({ latitude: 31.48, longitude: 74.3, address: 'Plot 65, Gulberg III, Lahore' });
    expect(mockGeocode).toHaveBeenCalledTimes(1);
  });

  it('a late answer never overwrites a place picked meanwhile', async () => {
    let answer: (value: string | null) => void = () => undefined;
    mockGeocode.mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));
    const { result } = renderHook(() =>
      useBookingFlow({ prefill, currentLocation: null, rideShown: false, directions }),
    );
    act(() => result.current.setMapPick('pickup'));
    act(() => result.current.placeOnMap('pickup', at(31.5, 74.3), null));
    act(() => result.current.selectPickup({ latitude: 31.6, longitude: 74.4 }, 'Emporium Mall', false));
    await act(async () => {
      answer('Somewhere Else');
    });
    expect(result.current.pickupField.text).toBe('Emporium Mall');
    expect(result.current.pickup).toEqual({ latitude: 31.6, longitude: 74.4, address: 'Emporium Mall' });
  });

  it.each(['pickup', 'destination'] as const)(
    'two %s taps: the first answer arriving last never names the second point',
    async (target) => {
      const answers: Array<(value: string | null) => void> = [];
      mockGeocode.mockImplementation(() => new Promise((resolve) => { answers.push(resolve); }));
      const { result } = renderHook(() =>
        useBookingFlow({ prefill, currentLocation: null, rideShown: false, directions }),
      );
      const field = () => (target === 'pickup' ? result.current.pickupField : result.current.destField);
      const place = () => (target === 'pickup' ? result.current.pickup : result.current.destination);
      act(() => result.current.setMapPick(target));
      act(() => result.current.placeOnMap(target, at(31.5, 74.3), null));
      act(() => result.current.setMapPick(target));
      act(() => result.current.placeOnMap(target, at(31.6, 74.4), null));
      expect(answers).toHaveLength(2);
      await act(async () => {
        answers[1]('Street B');
      });
      await act(async () => {
        answers[0]('Street A');
      });
      expect(field().text).toBe('Street B');
      expect(place()).toEqual({ latitude: 31.6, longitude: 74.4, address: 'Street B' });
      mockGeocode.mockImplementation(() => Promise.resolve('Plot 65, Gulberg III, Lahore'));
    },
  );

  it('review regression: tap A, tap B, A answers (late for its tap) before B: A is dropped, the field ends on B', async () => {
    const answers: Array<(value: string | null) => void> = [];
    mockGeocode.mockImplementation(() => new Promise((resolve) => { answers.push(resolve); }));
    const { result } = renderHook(() =>
      useBookingFlow({ prefill, currentLocation: null, rideShown: false, directions }),
    );
    act(() => result.current.setMapPick('pickup'));
    act(() => result.current.placeOnMap('pickup', at(31.5, 74.3), null));
    act(() => result.current.setMapPick('pickup'));
    act(() => result.current.placeOnMap('pickup', at(31.6, 74.4), null));
    await act(async () => {
      answers[0]('Street A');
    });
    expect(result.current.pickupField.text).toBe(BOOKING_COPY.pinnedOnMap);
    await act(async () => {
      answers[1]('Street B');
    });
    expect(result.current.pickupField.text).toBe('Street B');
    mockGeocode.mockImplementation(() => Promise.resolve('Plot 65, Gulberg III, Lahore'));
  });

  it('a stop added on the map gets its address too', async () => {
    const { result } = renderHook(() =>
      useBookingFlow({ prefill, currentLocation: null, rideShown: false, directions }),
    );
    act(() => {
      result.current.setPickup({ latitude: 31.52, longitude: 74.35, address: 'A' });
      result.current.setDestination({ latitude: 31.48, longitude: 74.3, address: 'B' });
    });
    act(() => result.current.setMapPick('stop'));
    act(() => result.current.placeOnMap('stop', at(31.5, 74.32), null));
    await waitFor(() => expect(result.current.stops[0]?.address).toBe('Plot 65, Gulberg III, Lahore'));
  });
});

describe('no pickup-row sliver while typing the destination (T-582)', () => {
  it('the destination keeps less room above it than the gap to the pickup row', () => {
    expect(DESTINATION_REVEAL_TOP).toBeLessThan(space[2]);
  });

  it('revealOffset uses the top margin above the field only', () => {
    const viewport = { top: 100, bottom: 400 };
    // A field (with its suggestions) taller than the view is aligned to the top.
    const field = { top: 300, bottom: 900 };
    expect(revealOffset({ offset: 0, field, viewport })).toBe(300 - (100 + REVEAL_MARGIN));
    expect(revealOffset({ offset: 0, field, viewport, topMargin: DESTINATION_REVEAL_TOP })).toBe(300 - (100 + DESTINATION_REVEAL_TOP));
    // The bottom keeps the usual margin.
    expect(revealOffset({ offset: 0, field: { top: 150, bottom: 395 }, viewport, topMargin: 0 })).toBe(395 - (400 - REVEAL_MARGIN));
  });
});
