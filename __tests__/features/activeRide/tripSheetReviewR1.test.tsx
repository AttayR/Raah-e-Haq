/**
 * UI-R12 design review round 1 (docs/design/shots/ui-r12/):
 * 1. the details stay hidden at peek and fade in as the sheet rises (TS1 Z6);
 * 2. the FareTag is centred in the 32 fare row (TS6.2);
 * 3. "Tap a star to rate" sits in the stars' label slot, 8 under them (PR2 block 5);
 * 4. one vehicle caption "{make} {model} · {colour}" on the trip PersonCard (TS5), the old split
 *    layout kept by default;
 * 6. receipt reports are 56 ListItems with a 40 icon tile (PR2 row 6);
 * 7. receipt tags are outline chips;
 * 9. empty details / persistent slots add no 24 gap;
 * 10. the comment counter is end-aligned;
 * plus "cash" in Roman Urdu and no repeated "Pay your driver in cash" under the breakdown.
 */
import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import MockAdapter from 'axios-mock-adapter';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { PersonCard, RatingInput, TextField, TripFareRow, TripSheet, detailsOpacity } from '../../../src/components/ui';
import { apiClient } from '../../../src/services/api';
import activeRideReducer, { initialActiveRideState } from '../../../src/features/active-ride/slice';
import { PassengerTripSheet } from '../../../src/features/active-ride/trip/PassengerTripSheet';
import { advanceRideStage, type PassengerRideStageState } from '../../../src/features/active-ride/stage';
import { resetRatingSessionState } from '../../../src/features/rating/hooks';
import { setLocale } from '../../../src/i18n';
import type { RideResource } from '../../../src/services/rideService';
import { makeRide } from '../../../test-utils/rideFixtures';

const flat = (node: { props: { style?: StyleProp<ViewStyle & TextStyle> } }): ViewStyle & TextStyle => StyleSheet.flatten(node.props.style) ?? {};

const stateOf = (ride: RideResource): PassengerRideStageState => {
  const state = advanceRideStage(null, ride);
  if (!state) throw new Error('no stage');
  return state;
};

afterEach(() => setLocale('en'));

describe('TripSheet details (TS1 Z6, review items 1 and 9)', () => {
  it('hidden at peek (opacity 0), fully shown 24 pt above it, always shown on the receipt', () => {
    expect(detailsOpacity(414, 414, false)).toBe(0);
    expect(detailsOpacity(300, 414, false)).toBe(0);
    expect(detailsOpacity(426, 414, false)).toBeCloseTo(0.5);
    expect(detailsOpacity(438, 414, false)).toBe(1);
    expect(detailsOpacity(700, 414, false)).toBe(1);
    expect(detailsOpacity(0, 0, true)).toBe(1);
    // Peek not measured yet: hidden (no flash on the first open).
    expect(detailsOpacity(500, 0, false)).toBe(0);
  });

  it('collapsed details are hidden from screen readers; the receipt\u2019s are not', () => {
    const { rerender } = render(<TripSheet stateKey="a" header={<Text>H</Text>} peek={<Text>P</Text>} details={<Text>Cancel</Text>} />);
    const details = screen.getByTestId('trip-sheet-details', { includeHiddenElements: true });
    expect(details.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(details.props.accessibilityElementsHidden).toBe(true);
    rerender(<TripSheet mode="receipt" stateKey="b" header={<Text>H</Text>} peek={<Text>P</Text>} persistent={<Text>R</Text>} />);
    expect(screen.getByTestId('trip-sheet-details').props.importantForAccessibility).toBe('auto');
  });

  it('adds the 24 gap only when a slot draws something', () => {
    render(<TripSheet mode="receipt" stateKey="b" header={<Text>H</Text>} peek={<Text>P</Text>} persistent={null} />);
    const content = screen.getByTestId('trip-sheet-details-content');
    act(() => fireEvent(content, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 370, height: 0 } } }));
    expect(flat(screen.getByTestId('trip-sheet-details')).marginTop).toBeUndefined();
    act(() => fireEvent(content, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 370, height: 56 } } }));
    expect(flat(screen.getByTestId('trip-sheet-details')).marginTop).toBe(24);
  });
});

describe('kit details (review items 2, 3, 4, 10)', () => {
  it('centres the Fixed fare tag in the fare row', () => {
    render(<TripFareRow amount={200} fixed accessibilityLabel="x" />);
    expect(flat(screen.getByTestId('trip-fare-row-tag-slot')).alignSelf).toBe('center');
  });

  it('shows the empty label in the stars’ label slot until a star is chosen', () => {
    const { rerender } = render(<RatingInput value={0} onChange={jest.fn()} emptyLabel="Tap a star to rate" testID="r" />);
    expect(screen.getByTestId('r-label')).toHaveTextContent('Tap a star to rate');
    rerender(<RatingInput value={5} onChange={jest.fn()} emptyLabel="Tap a star to rate" testID="r" />);
    expect(screen.getByTestId('r-label')).toHaveTextContent('Excellent');
  });

  it('joined vehicle layout is one caption that may wrap to 2 lines; split stays the default', () => {
    const { rerender } = render(<PersonCard name="Bilal" fallbackName="x" vehicleName="Toyota Corolla" vehicleColor="Blue" vehicleLayout="joined" vehicleTestID="v" />);
    expect(screen.getByTestId('v')).toHaveTextContent('Toyota Corolla · Blue');
    expect(screen.getByTestId('v').props.numberOfLines).toBe(2);
    expect(screen.queryByTestId('v-color')).toBeNull();
    rerender(<PersonCard name="Bilal" fallbackName="x" vehicleName="Toyota Corolla" vehicleColor="Blue" vehicleTestID="v" />);
    expect(screen.getByTestId('v')).toHaveTextContent('Toyota Corolla');
    expect(screen.getByTestId('v-color')).toHaveTextContent('Blue');
  });

  it('end-aligns a counter helper', () => {
    render(<TextField value="" onChangeText={jest.fn()} label="Comment" helper="0/500" helperAlign="end" testID="c" />);
    expect(flat(screen.getByTestId('c-helper')).textAlign).toBe('right');
  });

  it('"cash" in Roman Urdu', () => {
    setLocale('ur-Latn');
    render(<TripFareRow amount={200} fixed={false} accessibilityLabel="x" />);
    expect(screen.getByTestId('trip-fare-row-unit')).toHaveTextContent('naqad');
  });
});

describe('receipt (review items 3, 6, 7 and the footnote)', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet('/rating-tags').reply(200, {
      success: true,
      data: {
        window_days: 7,
        max_tags: 2,
        max_comment_length: 500,
        positive_min_stars: 4,
        negative_max_stars: 4,
        tags: { passenger: { positive: [{ key: 'clean_car', label: 'Clean car' }], negative: [] }, driver: { positive: [], negative: [] } },
      },
    });
    resetRatingSessionState();
  });
  afterEach(() => mock.restore());

  const ride = makeRide({
    id: 12,
    status: 'completed',
    vehicle_type: 'car_ac',
    driver_id: 5,
    driver: { id: 5, name: 'Bilal' },
    total_fare: 208,
    payment_method: 'cash',
    fare_breakdown: { base: 50, distance: 120, time: 38, stops: 0, min_fare_adjustment: 0, total: 208 },
    can_rate: true,
    my_rating: null,
    ac_report: { can_report: true, report: null },
    overcharge_report: { can_report: true, report: null },
  } as Partial<RideResource>);

  const renderReceipt = async () => {
    render(
      <Provider store={configureStore({ reducer: { activeRide: activeRideReducer }, preloadedState: { activeRide: { ...initialActiveRideState, ride } } })}>
        <PassengerTripSheet stageState={stateOf(ride)} ride={ride} driverLocation={null} onCancel={jest.fn()} onFinish={jest.fn()} />
      </Provider>,
    );
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 0));
    });
  };

  it('the star hint is the stars’ label (no second hint), tags are outline chips, the counter is at the end', async () => {
    await renderReceipt();
    expect(screen.getByTestId('rate-ride-stars-label')).toHaveTextContent('Tap a star to rate');
    expect(screen.queryByTestId('rate-ride-hint')).toBeNull();
    const row = screen.getByTestId('rate-ride-stars-row');
    fireEvent(row, 'layout', { nativeEvent: { layout: { width: 240, height: 48 } } });
    act(() => {
      fireEvent(row, 'responderGrant', { nativeEvent: { locationX: 5 * 48 - 10 } });
    });
    const chip = screen.getByTestId('rate-ride-tag-clean_car');
    // `outline`: a hairline border on `surface` (the filled chip has none).
    expect(flat(chip).borderWidth).toBeGreaterThan(0);
    expect(flat(screen.getByTestId('rate-ride-comment-helper')).textAlign).toBe('right');
  });

  it('reports are 56 ListItems with an icon tile; the breakdown has no repeated cash footnote', async () => {
    await renderReceipt();
    const ac = screen.getByTestId('active-ride-ac-report-button');
    const over = screen.getByTestId('active-ride-overcharge-button');
    expect(flat(ac).minHeight).toBe(56);
    expect(flat(over).minHeight).toBe(56);
    expect(screen.getByText('Pay your driver in cash')).toBeTruthy();
    fireEvent.press(screen.getByTestId('receipt-fare-details'));
    expect(screen.getAllByText('Pay your driver in cash')).toHaveLength(1);
  });
});
