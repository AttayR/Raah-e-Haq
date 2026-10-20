/**
 * UI-R13 design review (and UI-R12 round 2) fixes on the shared trip sheet:
 * 2. every return to peek scrolls the body back to its top (TS1 "Peek and scroll");
 * 3. the peek counts the footer as laid out, so the waiting timer is never cut;
 * 4. the footer hairline only at the scrollable snap, from the overflow visible there;
 * 5. "You keep" shares the start and end edge with Fare details (DC1 #4/#5);
 * 6. Roman Urdu slide labels fit at 1.3× on an iPhone SE;
 * 7. a cancelled receipt without a fee draws no empty money group;
 * 8. a short plate never shrinks (iOS left it at ~5 pt after the swap); a long one is re-keyed;
 * 9. the sender's cancel dialog in the ride's voice (PA4 parcel rows);
 * and the driver footer gives Start and Complete trip separate slides (the knob never parks).
 */
import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { BottomSheet, PersonCard, SlideToConfirm, TripSheet, tripPeekHeight } from '../../../src/components/ui';
import { AppText } from '../../../src/components/ui/AppText';
import { PLATE_FIT_CHARS, plateShrinks } from '../../../src/components/ui/ride/PersonCard';
import { SLIDE_LABEL_MIN_SCALE } from '../../../src/components/ui/ride/SlideToConfirm';
import { componentTokens, layout as layoutTokens, textStyles, MAX_FONT_SIZE_MULTIPLIER } from '../../../src/theme';
import activeRideReducer, { initialActiveRideState } from '../../../src/features/active-ride/slice';
import { PassengerTripSheet } from '../../../src/features/active-ride/trip/PassengerTripSheet';
import { advanceRideStage } from '../../../src/features/active-ride/stage';
import { passengerTripHeader } from '../../../src/features/active-ride/trip/tripModel';
import { cancelQuestion } from '../../../src/features/active-ride/cancel';
import { DRIVER_RIDE_COPY } from '../../../src/features/driver-ride/copy';
import { DriverTripSheet } from '../../../src/features/driver-ride/trip/DriverTripSheet';
import { setLocale, t } from '../../../src/i18n';
import '../../../src/i18n/copy-ur-Latn';
import type { RideResource } from '../../../src/services/rideService';
import { makeRide } from '../../../test-utils/rideFixtures';
import { driverSheetProps } from '../../../test-utils/driverTripFixtures';

afterEach(() => setLocale('en'));

const layoutOf = (node: Parameters<typeof fireEvent>[0], height: number, width = 390) =>
  act(() => {
    fireEvent(node, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height } } });
  });

const handle = (testID: string) => screen.getByTestId(`${testID}-handle`);
const adjust = (testID: string, actionName: 'increment' | 'decrement') =>
  act(() => {
    fireEvent(handle(testID), 'accessibilityAction', { nativeEvent: { actionName } });
  });

describe('2. peek starts at the top again', () => {
  it('scrolls the body to 0 (no animation) on every return to peek', () => {
    const onSnapChange = jest.fn();
    render(
      <BottomSheet snapPoints={['peek', 'content']} peekHeight={200} footerDivider onSnapChange={onSnapChange} testID="sheet">
        <Text>Body</Text>
      </BottomSheet>,
    );
    layoutOf(screen.getByTestId('sheet').parent!.parent!, 874);
    layoutOf(screen.getByTestId('sheet-body'), 1200);
    const scroll = screen.UNSAFE_getByType(ScrollView).instance as ScrollView;
    const scrollTo = jest.spyOn(scroll, 'scrollTo');
    adjust('sheet', 'increment');
    expect(onSnapChange).toHaveBeenLastCalledWith('content', expect.any(Number));
    scrollTo.mockClear();
    adjust('sheet', 'decrement');
    expect(onSnapChange).toHaveBeenLastCalledWith('peek', 200);
    expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
  });
});

describe('4. footer hairline', () => {
  it('is off at peek even with the details below it; on at the expanded snap while content runs under the footer', () => {
    render(
      <BottomSheet snapPoints={['peek', 'content']} peekHeight={200} footerDivider footer={<Text>Footer</Text>} testID="sheet">
        <Text>Body</Text>
      </BottomSheet>,
    );
    layoutOf(screen.getByTestId('sheet').parent!.parent!, 874);
    layoutOf(screen.getByTestId('sheet-footer'), 120);
    layoutOf(screen.getByTestId('sheet-body'), 2000);
    const scroll = screen.getByTestId('sheet-scroll');
    act(() => {
      fireEvent(scroll, 'contentSizeChange', 390, 2000);
    });
    expect(screen.queryByTestId('sheet-footer-divider')).toBeNull();
    adjust('sheet', 'increment');
    act(() => {
      fireEvent(scroll, 'contentSizeChange', 390, 2001);
    });
    expect(screen.getByTestId('sheet-footer-divider')).toBeTruthy();
    // Scrolled to the end: nothing runs under the footer any more.
    act(() => {
      fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { y: 2000 }, layoutMeasurement: { height: 600 }, contentSize: { height: 2001 } } });
    });
    expect(screen.queryByTestId('sheet-footer-divider')).toBeNull();
  });

  it('is an overlay: showing it does not change the footer layout', () => {
    render(
      <BottomSheet snapPoints={['content']} footerDivider footer={<Text>Footer</Text>} testID="sheet">
        <Text>Body</Text>
      </BottomSheet>,
    );
    layoutOf(screen.getByTestId('sheet').parent!.parent!, 874);
    layoutOf(screen.getByTestId('sheet-footer'), 120);
    layoutOf(screen.getByTestId('sheet-body'), 2000);
    act(() => {
      fireEvent(screen.getByTestId('sheet-scroll'), 'contentSizeChange', 390, 2000);
    });
    // Content runs under the footer at the sheet's one (scrollable) snap: the hairline shows…
    expect(screen.getByTestId('sheet-footer-divider')).toBeTruthy();
    // …drawn over the footer, not as a border that would grow it.
    const footer = screen.getByTestId('sheet-footer');
    expect(StyleSheet.flatten(footer.props.style).borderTopWidth).toBeUndefined();
  });
});

describe('3. the peek counts the footer as drawn', () => {
  it('prefers the laid-out footer block over the estimate, rounded up', () => {
    const estimate = tripPeekHeight({ header: 62, peek: 273, footer: 64, bottomInset: 34 });
    expect(estimate).toBe(componentTokens.sheet.contentTop + 62 + 273 + componentTokens.sheet.footerTopPadding + 64 + 34 + layoutTokens.bottomActionOffset);
    expect(tripPeekHeight({ header: 62, peek: 273, footer: 64, bottomInset: 34, footerBlock: 125.4 })).toBe(Math.ceil(componentTokens.sheet.contentTop + 62 + 273 + 125.4));
  });

  it('the trip sheet re-measures its peek group (a timer that appears) and its footer block', () => {
    const heights: number[] = [];
    const { rerender } = render(
      <TripSheet stateKey="arrived" header={<AppText>H</AppText>} peek={<AppText>P</AppText>} footer={<AppText>F</AppText>} onHeightChange={(h) => heights.push(h)} testID="ts" />,
    );
    layoutOf(screen.getByTestId('ts').parent!.parent!, 874);
    layoutOf(screen.getByText('H'), 62);
    layoutOf(screen.getByTestId('ts-peek'), 220);
    layoutOf(screen.getByText('F'), 64);
    layoutOf(screen.getByTestId('ts-footer'), 125);
    expect(heights[heights.length - 1]).toBe(componentTokens.sheet.contentTop + 62 + 220 + 125);
    // The waiting timer (12 + 64) joins the peek group: the peek grows by its full height.
    rerender(
      <TripSheet stateKey="arrived" header={<AppText>H</AppText>} peek={<AppText>P + timer</AppText>} footer={<AppText>F</AppText>} onHeightChange={(h) => heights.push(h)} testID="ts" />,
    );
    layoutOf(screen.getByTestId('ts-peek'), 220 + 76);
    expect(heights[heights.length - 1]).toBe(componentTokens.sheet.contentTop + 62 + 296 + 125);
  });
});

const completedDriverRide = makeRide({
  id: 41,
  status: 'completed',
  passenger: { id: 9, name: 'Ayesha Khan', rating: 4.8 },
  total_fare: 450,
  fare: 450,
  commission_rate: 10,
  commission_amount: 45,
  driver_net: 405,
  fare_breakdown: { base: 150, distance: 200, time: 100, stops: 0, min_fare_adjustment: 0, total: 450 },
  can_rate: false,
} as Partial<RideResource>);

describe('5. "You keep" on the receipt', () => {
  it('has no inset of its own: the same start and end edge as Fare details', () => {
    render(<DriverTripSheet {...driverSheetProps({ ride: completedDriverRide, step: 'summary' })} />);
    const row = StyleSheet.flatten(screen.getByTestId('driver-ride-you-keep').props.style);
    const details = StyleSheet.flatten(screen.getByTestId('driver-ride-fare-details').props.style);
    for (const key of ['paddingHorizontal', 'paddingStart', 'paddingEnd', 'paddingLeft', 'paddingRight', 'marginHorizontal'] as const) {
      expect(row[key]).toBe(details[key]);
    }
    expect(screen.getByTestId('driver-ride-you-keep').props.accessibilityLabel).toBe('You keep, Rs 405, after 10% commission');
  });
});

describe('6. Roman Urdu slide labels', () => {
  it('are the short forms and fit an iPhone SE track at 1.3×', () => {
    setLocale('ur-Latn');
    expect(DRIVER_RIDE_COPY.slideStart).toBe('Slide karke shuru karein');
    expect(DRIVER_RIDE_COPY.slideComplete).toBe('Slide karke mukammal karein');
    const s = componentTokens.ride.slide;
    // SE 375 − 2 × 16 gutter; the label clears the knob at the start and the inset at the end.
    const room = 375 - 2 * layoutTokens.gutter - (s.knob + s.inset * 2) - s.inset * 2;
    // A generous glyph width (0.6 em, wider than the average Latin glyph) at the 1.3× cap.
    const perChar = textStyles.button.fontSize * 0.6 * MAX_FONT_SIZE_MULTIPLIER * SLIDE_LABEL_MIN_SCALE;
    [DRIVER_RIDE_COPY.slideStart, DRIVER_RIDE_COPY.slideComplete].forEach((label) => expect(label.length * perChar).toBeLessThanOrEqual(room));
  });

  it('the label may shrink a little and is sized afresh for a new label', () => {
    const { rerender } = render(<SlideToConfirm label="Slide to start trip" onConfirm={jest.fn()} testID="slide" />);
    const first = screen.getByTestId('slide-label');
    expect(first.props.adjustsFontSizeToFit).toBe(true);
    expect(first.props.minimumFontScale).toBe(SLIDE_LABEL_MIN_SCALE);
    rerender(<SlideToConfirm label="Slide to complete trip" onConfirm={jest.fn()} testID="slide" />);
    expect(screen.getByTestId('slide-label')).not.toBe(first);
  });
});

describe('driver footer: one slide per action', () => {
  it('Start and Complete trip are separate slide instances (the knob never stays parked)', () => {
    const arrived = makeRide({ id: 41, status: 'arrived' });
    const { rerender } = render(<DriverTripSheet {...driverSheetProps({ ride: arrived, step: 'at_pickup' })} />);
    const start = screen.UNSAFE_getByType(SlideToConfirm);
    expect(start.props.testID).toBe('driver-ride-start');
    rerender(<DriverTripSheet {...driverSheetProps({ ride: makeRide({ id: 41, status: 'started' }), step: 'on_trip' })} />);
    const complete = screen.UNSAFE_getByType(SlideToConfirm);
    expect(complete.props.testID).toBe('driver-ride-complete');
    expect(complete).not.toBe(start);
  });
});

describe('7. cancelled receipt', () => {
  const renderPassenger = (ride: RideResource) => {
    const state = advanceRideStage(null, ride);
    if (!state) throw new Error('no stage');
    const store = configureStore({ reducer: { activeRide: activeRideReducer }, preloadedState: { activeRide: { ...initialActiveRideState, ride } } });
    render(
      <Provider store={store}>
        <PassengerTripSheet stageState={state} ride={ride} driverLocation={null} onCancel={jest.fn()} onFinish={jest.fn()} />
      </Provider>,
    );
  };
  const driverRide = (overrides: Partial<RideResource>) =>
    makeRide({ driver_id: 5, driver: { id: 5, name: 'Ali Raza', rating: 4.9 }, ...overrides } as Partial<RideResource>);

  it('without a fee draws no money group (no empty block taking the gap)', () => {
    renderPassenger(driverRide({ id: 13, status: 'cancelled', cancellation_reason: 'passenger' }));
    expect(screen.queryByTestId('receipt-money-group')).toBeNull();
  });

  it('with a fee keeps it', () => {
    renderPassenger(driverRide({ id: 14, status: 'cancelled', cancellation_reason: 'passenger', cancellation_fee: '50.00' } as Partial<RideResource>));
    expect(screen.getByTestId('receipt-money-group')).toBeTruthy();
  });
});

describe('8. plate pill', () => {
  it('a plate of up to 9 characters never shrinks', () => {
    expect(PLATE_FIT_CHARS).toBe(9);
    expect(plateShrinks('LEA-1234')).toBe(false);
    expect(plateShrinks('ABC-12345')).toBe(false);
    render(<PersonCard name="Ali" fallbackName="Driver" plate="LEA-1234" plateTestID="plate" />);
    expect(screen.getByTestId('plate').props.adjustsFontSizeToFit).toBe(false);
  });

  it('a long plate still shrinks to fit and is sized again on its measured pill width (after a swap)', () => {
    render(<PersonCard name="Ali" fallbackName="Driver" plate="QA-T522-BIKE-01" plateTestID="plate" />);
    const before = screen.getByTestId('plate');
    expect(before.props.adjustsFontSizeToFit).toBe(true);
    layoutOf(before.parent!, 28, 120);
    const after = screen.getByTestId('plate');
    expect(after).not.toBe(before);
    expect(after.props.adjustsFontSizeToFit).toBe(true);
  });
});

describe('9. the sender\'s cancel dialog (PA4 parcel rows)', () => {
  const parcel = (status: RideResource['status']) => makeRide({ id: 51, status, vehicle_type: 'parcel', is_parcel: true });

  it('"Cancel delivery?" with the rider on the way, waiting at the pickup, or not yet found', () => {
    const onTheWay = cancelQuestion(parcel('accepted')).options;
    expect(onTheWay.title).toBe('Cancel delivery?');
    expect(onTheWay.body).toBe('Your rider is already on the way.');
    expect(onTheWay.confirmLabel).toBe('Cancel delivery');
    expect(cancelQuestion(parcel('arrived')).options.body).toBe('Your rider is waiting at the pickup.');
    expect(cancelQuestion(parcel('requested')).options.body).toBe('Are you sure you want to cancel this delivery?');
  });

  it('Roman Urdu', () => {
    setLocale('ur-Latn');
    expect(cancelQuestion(parcel('accepted')).options).toMatchObject({ title: 'Delivery cancel karein?', body: 'Aap ka rider raste mein hai.' });
    expect(cancelQuestion(parcel('arrived')).options.body).toBe('Aap ka rider pickup par intezar kar raha hai.');
  });
});

describe('UI-R12 r3: cancelled receipt without a fee (PR2)', () => {
  const sheet = (peekText: string | null) => (
    <TripSheet
      mode="receipt"
      stateKey="cancelled"
      header={<AppText>Ride cancelled</AppText>}
      peek={peekText ? <AppText>{peekText}</AppText> : null}
      persistent={<AppText>Report</AppText>}
      testID="ts"
    />
  );
  const gapOf = () => StyleSheet.flatten(screen.getByTestId('ts-details', { includeHiddenElements: true }).props.style).marginTop;

  it('an empty peek group adds no 24 above the first block: it sits 16 under the header', () => {
    render(sheet(null));
    layoutOf(screen.getByTestId('ts-peek'), 0);
    layoutOf(screen.getByTestId('ts-details-content', { includeHiddenElements: true }), 48);
    expect(gapOf()).toBeUndefined();
    // The 16 is the receipt header's own bottom gap (PR2).
    const headerBlock = screen.getByTestId('ts-header').findAll((node) => StyleSheet.flatten(node.props.style)?.paddingBottom !== undefined)[0];
    expect(StyleSheet.flatten(headerBlock.props.style).paddingBottom).toBe(componentTokens.tripSheet.zoneGap);
  });

  it('with a peek group (the fee card) the details keep their 24', () => {
    render(sheet('Cancellation fee'));
    layoutOf(screen.getByTestId('ts-peek'), 90);
    layoutOf(screen.getByTestId('ts-details-content', { includeHiddenElements: true }), 48);
    expect(gapOf()).toBe(componentTokens.tripSheet.detailsGap);
  });
});

describe('UI-R12 r3 polish', () => {
  const parcelCancelled = makeRide({ id: 51, status: 'cancelled', vehicle_type: 'parcel', is_parcel: true, cancellation_reason: 'passenger' });
  const header = (ride: RideResource) => passengerTripHeader({ stage: 'cancelled', ride, parcel: null, offline: false, locationAge: null, now: 0 });

  it('a cancelled parcel says "Delivery cancelled"; a ride keeps "Ride cancelled"', () => {
    expect(header(parcelCancelled).title).toBe('Delivery cancelled');
    expect(header(makeRide({ id: 52, status: 'cancelled' })).title).toBe('Ride cancelled');
    setLocale('ur-Latn');
    expect(header(parcelCancelled).title).toBe('Delivery cancel ho gayi');
  });

  it('the PIN field label has a Roman Urdu string', () => {
    expect(t('safety.pinEntryLabel')).toBe('Ride PIN, 4 digits');
    setLocale('ur-Latn');
    expect(t('safety.pinEntryLabel')).toBe('Ride ka PIN, 4 digit');
  });
});
