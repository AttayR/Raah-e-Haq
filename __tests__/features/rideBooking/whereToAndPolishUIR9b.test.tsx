/**
 * UI-R9b: the "Where to?" shared-element feel (the bar's window y is measured when the finger
 * lands and handed to Booking, which fades in and moves a copy of the bar onto the planner's
 * destination field; nothing moves without a start, with Reduce Motion or when the field cannot
 * be measured); autocomplete rows on the kit tile with the text-start divider and the typed match
 * in 700; and the UI-R10 polish (the sheet reports reaching its cap, so the locate control hides;
 * the Fare details ghost sits on the gutter).
 */
import React from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { WhereToBar } from '../../../src/features/passenger-home/components/WhereToBar';
import { ARRIVAL_SETTLE_MS, WhereToGhost, useWhereToArrival } from '../../../src/features/ride-booking/components/WhereToArrival';
import { bookingScreenOptions } from '../../../src/app/navigation/stacks/PassengerStack';
import { LocationSuggestionRow, SUGGESTION_TEXT_START, titleParts } from '../../../src/components/passenger/LocationSuggestionRow';
import { BookingSheet } from '../../../src/features/ride-booking/components/BookingSheet';
import { SelectedFare } from '../../../src/features/ride-booking/components/BookingChoices';
import { componentTokens, radius } from '../../../src/theme';

jest.mock('../../../src/app/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: jest.requireActual('../../../src/theme').LightTheme, scheme: 'system', setScheme: jest.fn() }),
}));
jest.mock('../../../src/app/navigation/tabs/PassengerBottomTabs', () => ({ __esModule: true, default: () => null }));
jest.mock('src/screens/Passenger/PassengerMapScreen', () => ({ __esModule: true, default: () => null }), { virtual: true });

describe('"Where to?" hands over where the bar is', () => {
  it('a press with no measured position passes null at once (the tap never waits for the measure)', () => {
    const onPress = jest.fn();
    render(<WhereToBar onPress={onPress} />);
    const bar = screen.getByTestId('home-where-to');
    fireEvent.press(bar);
    expect(onPress).toHaveBeenLastCalledWith(null);
  });

  it('Booking fades in only for the "Where to?" entry', () => {
    const route = (params?: object) => ({ key: 'b', name: 'Booking' as const, params });
    expect(bookingScreenOptions({ route: route({ entry: 'whereTo' }) })).toEqual({ freezeOnBlur: false, animation: 'fade', animationDuration: 250 });
    expect(bookingScreenOptions({ route: route() })).toEqual({ freezeOnBlur: false });
  });
});

describe('the bar lands on the destination field', () => {
  beforeEach(() => jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }));
  afterEach(() => jest.useRealTimers());

  it('no start: nothing moves, the field shows', () => {
    const { result } = renderHook(() => useWhereToArrival(null));
    expect(result.current.active).toBe(false);
    render(<WhereToGhost arrival={result.current} />);
    expect(screen.queryByTestId('where-to-ghost', { includeHiddenElements: true })).toBeNull();
  });

  it('a start: the copy of the bar shows over the map; a field that cannot be measured shows at once', async () => {
    const Harness = () => {
      const arrival = useWhereToArrival(612);
      return (
        <>
          <View ref={arrival.fieldRef} />
          <WhereToGhost arrival={arrival} />
          <Text testID="state">{arrival.active ? 'moving' : 'done'}</Text>
        </>
      );
    };
    render(<Harness />);
    const ghost = screen.getByTestId('where-to-ghost', { includeHiddenElements: true });
    expect(StyleSheet.flatten(ghost.props.style)).toMatchObject({ top: 612, height: componentTokens.home.whereToHeight, borderRadius: radius.pill });
    await act(async () => {
      jest.advanceTimersByTime(ARRIVAL_SETTLE_MS);
    });
    expect(screen.getByTestId('state')).toHaveTextContent('moving');
    await act(async () => {
      jest.advanceTimersByTime(150);
    });
    // The measure never answers in tests: the field is revealed after its timeout, the copy leaves.
    expect(screen.getByTestId('state')).toHaveTextContent('done');
    expect(screen.queryByTestId('where-to-ghost', { includeHiddenElements: true })).toBeNull();
  });

  it('Reduce Motion: no move', async () => {
    const reduce = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() => Promise.resolve(true));
    const { result } = renderHook(() => useWhereToArrival(612));
    await act(async () => undefined);
    expect(result.current.active).toBe(false);
    reduce.mockImplementation(() => Promise.resolve(false));
  });
});

describe('autocomplete rows on the kit tile', () => {
  it('the typed match is drawn in 700; bad ranges never hide text', () => {
    expect(titleParts('Liberty Market', [{ offset: 0, length: 3 }])).toEqual([
      { text: 'Lib', strong: true },
      { text: 'erty Market', strong: false },
    ]);
    expect(titleParts('Liberty', [{ offset: 50, length: 3 }, { offset: -1, length: 2 }])).toEqual([{ text: 'Liberty', strong: false }]);
    expect(titleParts('Liberty Market', [{ offset: 8, length: 3 }, { offset: 0, length: 3 }])).toEqual([
      { text: 'Lib', strong: true },
      { text: 'erty ', strong: false },
      { text: 'Mar', strong: true },
      { text: 'ket', strong: false },
    ]);
  });

  it('40 tile radius md, text 16 after it, divider from the text start', () => {
    const onPress = jest.fn();
    render(
      <LocationSuggestionRow
        title="Liberty Market"
        subtitle="Gulberg III, Lahore"
        matched={[{ offset: 0, length: 3 }]}
        divider
        onPress={onPress}
        accessibilityLabel="Liberty Market, Gulberg III, Lahore"
        testID="row"
      />,
    );
    fireEvent.press(screen.getByTestId('row'));
    expect(onPress).toHaveBeenCalled();
    expect(screen.getByText('Lib')).toHaveStyle({ fontWeight: '700' });
    expect(SUGGESTION_TEXT_START).toBe(componentTokens.listItem.tile + 16);
    expect(StyleSheet.flatten(screen.getByTestId('tile-row').props.style)).toMatchObject({ width: 40, height: 40, borderRadius: radius.md });
    expect(StyleSheet.flatten(screen.getByTestId('divider-row').props.style)).toMatchObject({ start: SUGGESTION_TEXT_START });
  });
});

describe('UI-R10 polish', () => {
  it('the booking sheet reports reaching its cap (the locate control hides), and is hidden under the picker', () => {
    const onFullChange = jest.fn();
    const onHeightChange = jest.fn();
    const { rerender } = render(
      <BookingSheet onFullChange={onFullChange} onHeightChange={onHeightChange}>
        <Text>content</Text>
      </BookingSheet>,
    );
    const sheet = screen.getByTestId('booking-sheet');
    const cap = StyleSheet.flatten(sheet.props.style).maxHeight as number;
    fireEvent(sheet, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 300 } } });
    expect(onFullChange).toHaveBeenLastCalledWith(false);
    fireEvent(sheet, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 375, height: cap } } });
    expect(onFullChange).toHaveBeenLastCalledWith(true);
    rerender(
      <BookingSheet onFullChange={onFullChange} onHeightChange={onHeightChange} hidden>
        <Text>content</Text>
      </BookingSheet>,
    );
    onHeightChange.mockClear();
    const hiddenSheet = screen.getByTestId('booking-sheet', { includeHiddenElements: true });
    fireEvent(hiddenSheet, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 0 } } });
    expect(onHeightChange).not.toHaveBeenCalled();
    expect(StyleSheet.flatten(hiddenSheet.props.style)).toMatchObject({ display: 'none' });
    // Shown again: its last height is reported at once (the map controls ride on it again).
    rerender(
      <BookingSheet onFullChange={onFullChange} onHeightChange={onHeightChange}>
        <Text>content</Text>
      </BookingSheet>,
    );
    expect(onHeightChange).toHaveBeenLastCalledWith(cap);
  });

  it('the Fare details ghost sits on the gutter (its own padding pulled back)', () => {
    const quote = {
      vehicle_type: 'car',
      fare: 230,
      currency: 'PKR',
      breakdown: { base_fare: 80, distance_fare: 150, time_fare: 0, booking_fee: 0, surge_multiplier: 1 },
      offer_band: null,
      fare_policy: null,
    };
    render(<SelectedFare quote={quote as never} distanceKm={5} durationMin={12} />);
    expect(StyleSheet.flatten(screen.getByTestId('fare-details-toggle-wrap').props.style)).toMatchObject({
      alignSelf: 'flex-start',
      marginStart: -componentTokens.button.paddingHorizontal.sm,
    });
  });
});
