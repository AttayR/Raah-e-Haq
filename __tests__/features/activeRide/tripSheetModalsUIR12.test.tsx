/**
 * UI-R12 review follow-ups (T-565 rule: a presented modal sheet is never unmounted):
 * - the report sheets live in the trip sheet's persistent slot, so in_trip → completed keeps the
 *   open AC report sheet's instance and it closes through `visible`;
 * - women mode keeps one state and one choice sheet per ride outside both sheets: the booking
 *   sheet only places its status block, so a driver taking the ride while the sheet is open
 *   slides it out instead of unmounting it;
 * - the new BottomSheet props (handle tap toggles, draggable={false}, openFrom) and the 700 pt
 *   compact layout switch;
 * - every failed rating submit is a toast.
 */
import React from 'react';
import { Modal, Text, View, useWindowDimensions } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import MockAdapter from 'axios-mock-adapter';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { State } from 'react-native-gesture-handler';
import { apiClient } from '../../../src/services/api';
import activeRideReducer, { initialActiveRideState } from '../../../src/features/active-ride/slice';
import { PassengerTripSheet } from '../../../src/features/active-ride/trip/PassengerTripSheet';
import ActiveRidePanel from '../../../src/features/active-ride/components/ActiveRidePanel';
import { advanceRideStage, type PassengerRideStageState } from '../../../src/features/active-ride/stage';
import {
  WomenModeChoiceSheet,
  WomenModeStatus,
  useWomenModeSearching,
} from '../../../src/features/women-mode/components/WomenModeSearching';
import { BottomSheet } from '../../../src/components/ui';
import { modalQueue } from '../../../src/components/ui/modalQueue';
import { openingTop } from '../../../src/components/ui/sheetSnaps';
import { resetRatingSessionState } from '../../../src/features/rating/hooks';
import { toast } from '../../../src/core/toast';
import type { RideResource } from '../../../src/services/rideService';
import { makeRide } from '../../../test-utils/rideFixtures';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 402, height: 874, scale: 3, fontScale: 1 })),
}));
const windowSize = useWindowDimensions as jest.MockedFunction<typeof useWindowDimensions>;

type Finish = (finished?: boolean) => void;
/** Springs that run until the test finishes them (a close spring keeps its Modal up meanwhile). */
const holdSprings = () => {
  let running: Finish | null = null;
  jest.spyOn(Reanimated, 'withSpring').mockImplementation(((toValue: number, _config: unknown, callback?: Finish) => {
    const previous = running;
    running = callback ?? null;
    previous?.(false);
    return toValue;
  }) as unknown as typeof Reanimated.withSpring);
  return {
    finish: () => {
      const done = running;
      running = null;
      act(() => done?.(true));
    },
  };
};

const stateOf = (ride: RideResource): PassengerRideStageState => {
  const state = advanceRideStage(null, ride);
  if (!state) throw new Error('no stage');
  return state;
};

const acRide = (overrides: Partial<RideResource> = {}): RideResource =>
  makeRide({
    id: 77,
    status: 'started',
    vehicle_type: 'car_ac',
    driver_id: 5,
    driver: { id: 5, name: 'Ali', rating: 4.9 },
    total_fare: 300,
    ac_report: { can_report: true, report: null },
    ...overrides,
  } as Partial<RideResource>);

let mock: MockAdapter;
beforeEach(() => {
  modalQueue.reset();
  mock = new MockAdapter(apiClient);
  mock.onGet('/rating-tags').reply(200, {
    success: true,
    data: { window_days: 7, max_tags: 2, max_comment_length: 500, positive_min_stars: 4, negative_max_stars: 4, tags: { passenger: { positive: [], negative: [] }, driver: { positive: [], negative: [] } } },
  });
  resetRatingSessionState();
  jest.spyOn(toast, 'success').mockImplementation(() => '');
  jest.spyOn(toast, 'error').mockImplementation(() => '');
  windowSize.mockReturnValue({ width: 402, height: 874, scale: 3, fontScale: 1 });
});
afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('the report sheets survive the trip → receipt swap (T-565)', () => {
  const Host = ({ ride }: { ride: RideResource }) => (
    <Provider store={configureStore({ reducer: { activeRide: activeRideReducer }, preloadedState: { activeRide: { ...initialActiveRideState, ride } } })}>
      <PassengerTripSheet stageState={stateOf(ride)} ride={ride} driverLocation={null} onCancel={jest.fn()} onFinish={jest.fn()} />
    </Provider>
  );

  it('an AC report sheet opened on the trip stays the same instance on the receipt, then closes through `visible`', async () => {
    const springs = holdSprings();
    const view = render(<Host ride={acRide()} />);
    await act(async () => {});
    fireEvent.press(screen.getByTestId('active-ride-ac-report-button'));
    await act(async () => {});
    springs.finish();
    expect(screen.getByTestId('ac-report-sheet')).toBeTruthy();

    // The ride completes while the sheet is up: same instance (its open state is kept).
    view.rerender(<Host ride={acRide({ status: 'completed' })} />);
    await act(async () => {});
    expect(screen.getByText("You've arrived")).toBeTruthy();
    expect(screen.getByTestId('ac-report-sheet')).toBeTruthy();

    // The server closes the window: the sheet slides out through `visible`, its Modal still up
    // until the close spring ends, and then it is gone.
    view.rerender(<Host ride={acRide({ status: 'completed', ac_report: { can_report: false, report: null } } as Partial<RideResource>)} />);
    await act(async () => {});
    expect(screen.UNSAFE_queryAllByType(Modal).length).toBeGreaterThan(0);
    springs.finish();
    await act(async () => {});
    expect(screen.queryByTestId('ac-report-sheet')).toBeNull();
  });
});

describe('women mode: one state and choice sheet per ride, outside both sheets (T-565)', () => {
  const raw = {
    female_driver_only: true,
    state: 'no_female_drivers_nearby',
    female_drivers_nearby: false,
    ask_fallback_at: null,
    can_allow_any_driver: true,
    released_at: null,
  };

  /** The booking map's structure: the status inside whichever sheet shows, the choice sheet beside them. */
  const Screen = ({ ride }: { ride: RideResource }) => {
    const searching = ride.status === 'requested';
    const women = useWomenModeSearching({ rideId: ride.id, raw: ride.women_mode, searching });
    return (
      <>
        {searching ? (
          <View testID="booking-sheet">
            <ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={jest.fn()} cancelInFooter womenModeStatus={<WomenModeStatus state={women} />} />
          </View>
        ) : (
          <View testID="trip-sheet">
            <Text>Trip</Text>
          </View>
        )}
        <WomenModeChoiceSheet state={women} />
      </>
    );
  };

  it('the panel places the status block only; accepting while the sheet is open slides it out', async () => {
    const springs = holdSprings();
    const requested = makeRide({ id: 88, status: 'requested', women_mode: raw } as Partial<RideResource>);
    const view = render(<Screen ride={requested} />);
    await act(async () => {});
    springs.finish();
    expect(within(screen.getByTestId('booking-sheet')).getByTestId('women-mode-status')).toBeTruthy();
    expect(screen.getByTestId('women-mode-ask-text')).toBeTruthy();

    // A driver takes it: the booking sheet (and the status) go; the choice sheet is still the same
    // instance, sliding out with its last wording, then gone.
    view.rerender(<Screen ride={makeRide({ id: 88, status: 'accepted', driver_id: 5, women_mode: { ...raw, state: 'matched' } } as Partial<RideResource>)} />);
    await act(async () => {});
    expect(screen.queryByTestId('booking-sheet')).toBeNull();
    expect(screen.queryByTestId('women-mode-status')).toBeNull();
    expect(screen.getByTestId('women-mode-ask-text')).toBeTruthy();
    springs.finish();
    await act(async () => {});
    expect(screen.queryByTestId('women-mode-ask-text')).toBeNull();
  });

  it('the panel never mounts a women-mode sheet of its own', () => {
    const requested = makeRide({ id: 89, status: 'requested', women_mode: raw } as Partial<RideResource>);
    render(<ActiveRidePanel stageState={stateOf(requested)} ride={requested} onCancel={jest.fn()} />);
    expect(screen.queryByTestId('women-mode-sheet')).toBeNull();
    expect(screen.queryByTestId('women-mode-status')).toBeNull();
  });
});

describe('BottomSheet trip props (TS13)', () => {
  const layout = (testID: string, height: number) =>
    fireEvent(screen.getByTestId(testID), 'layout', { nativeEvent: { layout: { width: 402, height, x: 0, y: 0 } } });

  it('a tap on the handle toggles the lowest snap and the next one', () => {
    const onSnapChange = jest.fn();
    render(
      <BottomSheet snapPoints={['peek', 'full']} peekHeight={200} handleTapToggles onSnapChange={onSnapChange} testID="sheet">
        <Text>Body</Text>
      </BottomSheet>,
    );
    // The map sheet's container (its parent's full size).
    const container = screen.getByTestId('sheet').parent?.parent;
    if (!container) throw new Error('no container');
    act(() => {
      fireEvent(container, 'layout', { nativeEvent: { layout: { width: 402, height: 874, x: 0, y: 0 } } });
    });
    expect(onSnapChange).toHaveBeenLastCalledWith('peek', 200);
    const tap = () =>
      act(() => {
        fireGestureHandler(getByGestureTestId('sheet-handle-tap'), [{ state: State.BEGAN }, { state: State.ACTIVE }, { state: State.END }]);
      });
    tap();
    expect(onSnapChange).toHaveBeenLastCalledWith('full', expect.any(Number));
    tap();
    expect(onSnapChange).toHaveBeenLastCalledWith('peek', 200);
  });

  it('draggable={false} draws no handle (the 24 band stays as padding)', () => {
    render(
      <BottomSheet snapPoints={['content']} draggable={false} testID="sheet">
        <Text>Body</Text>
      </BottomSheet>,
    );
    expect(screen.queryByTestId('sheet-handle')).toBeNull();
    expect(screen.getByTestId('sheet-top')).toBeTruthy();
    layout('sheet-body', 100);
  });

  it('openFrom: an opening sheet starts that far above the bottom edge (clamped), else at the edge', () => {
    expect(openingTop(874)).toBe(874);
    expect(openingTop(874, 300)).toBe(574);
    expect(openingTop(874, 2000)).toBe(0);
    expect(openingTop(874, -10)).toBe(874);
  });
});

describe('compact layout under 700 pt (PA1, PT1)', () => {
  const ride = makeRide({ status: 'arrived', driver_id: 5, driver: { id: 5, name: 'Ali' }, accepted_fare: '152.00', fare_locked: true });

  it('iPhone 17: the fare row is in the peek group and the progress shows at arrival', () => {
    render(<ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={jest.fn()} />);
    expect(within(screen.getByTestId('active-ride-driver_arrived')).getByTestId('trip-fare-row')).toBeTruthy();
    expect(screen.getByTestId('active-ride-progress')).toBeTruthy();
  });

  it('iPhone SE (667): the fare row moves to the details and the arrived progress hides', () => {
    windowSize.mockReturnValue({ width: 375, height: 667, scale: 2, fontScale: 1 });
    render(<ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={jest.fn()} />);
    expect(within(screen.getByTestId('active-ride-driver_arrived')).queryByTestId('trip-fare-row')).toBeNull();
    expect(screen.getByTestId('trip-fare-row')).toBeTruthy();
    expect(screen.queryByTestId('active-ride-progress')).toBeNull();
  });
});

describe('rating failures (PR5)', () => {
  it('every failed submit is a toast, also the same failure twice', async () => {
    mock.onPost('/rides/12/rate').reply(500, { success: false, message: 'Server error' });
    const ride = makeRide({ id: 12, status: 'completed', driver_id: 5, driver: { id: 5, name: 'Ali' }, total_fare: 310, can_rate: true, my_rating: null } as Partial<RideResource>);
    render(
      <Provider store={configureStore({ reducer: { activeRide: activeRideReducer }, preloadedState: { activeRide: { ...initialActiveRideState, ride } } })}>
        <PassengerTripSheet stageState={stateOf(ride)} ride={ride} driverLocation={null} onCancel={jest.fn()} onFinish={jest.fn()} />
      </Provider>,
    );
    await act(async () => {});
    const row = screen.getByTestId('rate-ride-stars-row');
    fireEvent(row, 'layout', { nativeEvent: { layout: { width: 240, height: 48 } } });
    act(() => {
      fireEvent(row, 'responderGrant', { nativeEvent: { locationX: 4 * 48 - 10 } });
    });
    for (let i = 0; i < 2; i += 1) {
      await act(async () => {
        fireEvent.press(screen.getByTestId('rate-ride-submit'));
      });
      await act(async () => {
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 0));
      });
    }
    expect(toast.error).toHaveBeenCalledTimes(2);
    expect(toast.error).toHaveBeenCalledWith("Couldn't send your rating. Try again.");
  });
});
