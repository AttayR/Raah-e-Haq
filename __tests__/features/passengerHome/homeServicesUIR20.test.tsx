/**
 * UI-R20 (passenger-home § Services S1–S9): the Home sheet header by state (service row, the
 * ride-only heading, the greeting with a live ride), the peek from the measured header, the
 * animated swap when the parcel tier changes (no taps on a leaving tile, waits for a drag),
 * the last known tier at a cold start, one push per tap, and en + Roman Urdu copy.
 */
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Reanimated from 'react-native-reanimated';
import { Provider } from 'react-redux';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { apiClient } from '../../../src/services/api';
import { clearQueryCache } from '../../../src/core/api/queryCache';
import PassengerHomeScreen from '../../../src/screens/Passenger/PassengerHomeScreen';
import { HomeSheetTop } from '../../../src/features/passenger-home/components/HomeSheetTop';
import { HOME_HEADER_ESTIMATE, HOME_PEEK_BODY, type HomeHeaderKind } from '../../../src/features/passenger-home/components/HomeSheet';
import { useHomePeek } from '../../../src/features/passenger-home/useHomePeek';
import { ONE_PUSH_MS, useOnePush } from '../../../src/features/passenger-home/useOnePush';
import {
  PARCEL_TILE_STORAGE_KEY,
  lastKnownParcelTile,
  rememberParcelTile,
  resetParcelTileForTests,
  restoreParcelTile,
} from '../../../src/features/parcel/lastKnown';
import { createActiveRide } from '../../../src/features/active-ride/slice';
import { setLocale, t } from '../../../src/i18n';
import { makeRide, makeRideRequest, makeStore, page, type TestStore } from '../../../test-utils/rideFixtures';

jest.mock('react-native-reanimated', () => {
  const mock = jest.requireActual('react-native-reanimated/mock');
  const { useState } = jest.requireActual('react');
  return { ...mock, useSharedValue: (init: unknown) => useState(() => mock.useSharedValue(init))[0] };
});

const mockNavigate = jest.fn();
let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useIsFocused: () => mockFocused,
}));

const fare = { currency: 'PKR', base_fare: 50, per_km: 25, per_min: 2, min_fare: 100, per_stop: 20 };
const car = { key: 'car', label: 'Car', capacity: 4, icon: 'car', fare };
const parcel = { key: 'parcel', label: 'Parcel', capacity: 1, icon: 'parcel', fare, parcel: true };

let mock: MockAdapter;
beforeEach(async () => {
  mock = new MockAdapter(apiClient);
  mock.onGet('/rides').reply(200, page([]));
  mockNavigate.mockClear();
  mockFocused = true;
  clearQueryCache();
  resetParcelTileForTests();
  await AsyncStorage.clear();
  setLocale('en');
});
afterEach(() => {
  mock.restore();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
};

const renderHome = async (store: TestStore = makeStore()) => {
  render(
    <Provider store={store}>
      <ThemeProvider>
        <PassengerHomeScreen />
      </ThemeProvider>
    </Provider>,
  );
  await flush();
};

const layoutContainer = (height: number) =>
  act(() => {
    fireEvent(screen.getByTestId('home-sheet').parent!.parent!, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 402, height } },
    });
  });

describe('S1: the header by state on Home', () => {
  it('parcel tier on: Ride + Parcel tiles, no greeting; Ride books like "Where to?", Parcel opens the form', async () => {
    mock.onGet('/public/vehicle-types').reply(200, { success: true, data: [car, parcel] });
    await renderHome();
    expect(screen.getByTestId('home-service-row')).toBeTruthy();
    expect(screen.queryByTestId('home-greeting')).toBeNull();
    expect(screen.queryByTestId('home-ride-only-heading')).toBeNull();
    // The chip row has no parcel chip any more: the only home-send-parcel is the tile.
    expect(screen.getAllByTestId('home-send-parcel')).toHaveLength(1);

    fireEvent.press(screen.getByTestId('home-service-ride'));
    expect(mockNavigate).toHaveBeenLastCalledWith('Booking');
  });

  it('one push per tap: a double tap opens one screen; a later tap works again', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    mock.onGet('/public/vehicle-types').reply(200, { success: true, data: [car, parcel] });
    await renderHome();
    fireEvent.press(screen.getByTestId('home-send-parcel'));
    fireEvent.press(screen.getByTestId('home-send-parcel'));
    fireEvent.press(screen.getByTestId('home-where-to'));
    expect(mockNavigate.mock.calls).toEqual([['SendParcel']]);
    act(() => jest.advanceTimersByTime(ONE_PUSH_MS));
    fireEvent.press(screen.getByTestId('home-where-to'));
    expect(mockNavigate).toHaveBeenLastCalledWith('Booking');
  });

  it('parcel tier off: the ride-only heading, no tiles', async () => {
    mock.onGet('/public/vehicle-types').reply(200, { success: true, data: [car] });
    await renderHome();
    expect(screen.getByTestId('home-ride-only-heading')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Rides within the city' })).toBeTruthy();
    expect(screen.queryByTestId('home-service-row')).toBeNull();
    expect(screen.queryByTestId('home-send-parcel')).toBeNull();
  });

  it('a ride in progress: the greeting and "Return to your ride", no tiles, whatever the tier', async () => {
    mock.onGet('/public/vehicle-types').reply(200, { success: true, data: [car, parcel] });
    mock.onGet('/rides/21').reply(200, { success: true, data: makeRide({ id: 21, status: 'accepted', driver_id: 5 }) });
    const store = makeStore();
    store.dispatch(createActiveRide.fulfilled(makeRide({ id: 21, status: 'accepted', driver_id: 5 }), 'req', makeRideRequest()));
    await renderHome(store);
    expect(screen.getByTestId('home-greeting')).toBeTruthy();
    expect(screen.getByTestId('home-return-to-ride')).toBeTruthy();
    expect(screen.queryByTestId('home-service-row')).toBeNull();
  });

  it('peek follows the header: 244 with the service row, half max(50 %, peek + 180)', async () => {
    const spring = jest.spyOn(Reanimated, 'withSpring');
    mock.onGet('/public/vehicle-types').reply(200, { success: true, data: [car, parcel] });
    await renderHome();
    await layoutContainer(667);
    expect(spring.mock.calls.map(call => call[0])).toContain(667 - 244);
    // At half on an SE-sized container: max(333.5, 424) = 424.
    spring.mockClear();
    act(() => fireEvent(screen.getByTestId('home-sheet-handle'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } }));
    expect(spring.mock.calls.map(call => call[0])).toEqual([667 - 424]);
  });
});

describe('S7: cold start and unknown availability', () => {
  it('the stored last known value picks the header before the catalogue answers; a failed read keeps it', async () => {
    await AsyncStorage.setItem(PARCEL_TILE_STORAGE_KEY, '1');
    await restoreParcelTile();
    mock.onGet('/public/vehicle-types').reply(500, { success: false, message: 'Server error' });
    await renderHome();
    expect(screen.getByTestId('home-service-row')).toBeTruthy();
  });

  it('nothing known (first launch): the ride-only heading', async () => {
    mock.onGet('/public/vehicle-types').reply(500, { success: false, message: 'Server error' });
    await renderHome();
    expect(screen.getByTestId('home-ride-only-heading')).toBeTruthy();
  });

  it('a successful read is stored, and only when it changed; a late storage read never overwrites it', async () => {
    const setItem = jest.spyOn(AsyncStorage, 'setItem');
    setItem.mockClear();
    rememberParcelTile(true);
    rememberParcelTile(true);
    expect(setItem.mock.calls).toEqual([[PARCEL_TILE_STORAGE_KEY, '1']]);
    rememberParcelTile(false);
    expect(setItem).toHaveBeenLastCalledWith(PARCEL_TILE_STORAGE_KEY, '0');

    resetParcelTileForTests();
    await AsyncStorage.setItem(PARCEL_TILE_STORAGE_KEY, '1');
    rememberParcelTile(false);
    await restoreParcelTile();
    expect(lastKnownParcelTile()).toBe(false);
  });

  it('a storage read that rejects leaves the tier unknown and never rejects itself', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(restoreParcelTile()).resolves.toBeUndefined();
    expect(lastKnownParcelTile()).toBeNull();
    // A later successful catalogue read still counts.
    rememberParcelTile(true);
    expect(lastKnownParcelTile()).toBe(true);
  });

  it('a garbled stored value is ignored', async () => {
    await AsyncStorage.setItem(PARCEL_TILE_STORAGE_KEY, 'yes');
    await restoreParcelTile();
    expect(lastKnownParcelTile()).toBeNull();
  });
});

describe('S5: peek from the measured header', () => {
  it('estimates until measured; 1.3× and wrapped subtitles grow it; sub-point changes are ignored', () => {
    expect(HOME_PEEK_BODY).toBe(124);
    expect(HOME_HEADER_ESTIMATE.services).toBe(96);
    const { result } = renderHook(() => useHomePeek('services'));
    expect(result.current.peek).toBe(244);
    expect(result.current.halfMin).toBe(424);
    act(() => result.current.onHeaderHeight(102, 'services'));
    expect(result.current.peek).toBe(250);
    act(() => result.current.onHeaderHeight(102.6, 'services'));
    expect(result.current.peek).toBe(250);
    act(() => result.current.onHeaderHeight(128, 'services'));
    expect(result.current.peek).toBe(276);

    expect(renderHook(() => useHomePeek('rideOnly')).result.current.peek).toBe(170);
    expect(renderHook(() => useHomePeek('greeting')).result.current.peek).toBe(202);
  });

  it('one height per kind: a shown kind uses its own measurement, else its estimate', () => {
    const { result } = renderHook(() => useHomePeek('services'));
    act(() => result.current.onHeaderHeight(102, 'services'));
    // A ride starts: the greeting has never been measured, so its estimate, not the tiles' 102.
    act(() => result.current.onHeaderShown('greeting'));
    expect(result.current.peek).toBe(202);
    act(() => result.current.onHeaderHeight(29, 'greeting'));
    expect(result.current.peek).toBe(209);
    // Back to the tiles: their own 1.3× height straight away.
    act(() => result.current.onHeaderShown('services'));
    expect(result.current.peek).toBe(250);
  });

  /** HomeSheetTop and useHomePeek together, recording every peek the sheet was given. */
  function Harness({ kind, peeks, initial = 'services' }: { kind: HomeHeaderKind; peeks: number[]; initial?: HomeHeaderKind }) {
    const { peek, onHeaderHeight, onHeaderShown } = useHomePeek(initial);
    peeks.push(peek);
    return (
      <HomeSheetTop kind={kind} greeting="Hello" onRide={jest.fn()} onParcel={jest.fn()} onHeight={onHeaderHeight} onShown={onHeaderShown} />
    );
  }
  const layoutTop = (height: number) =>
    fireEvent(screen.getByTestId('home-sheet-top'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 402, height } } });
  const distinct = (peeks: number[]) => peeks.filter((p, i) => i === 0 || p !== peeks[i - 1]);

  it('a ride starting and ending while Home is visible eases the peek once each way (no 276 / 170 step)', () => {
    let finishFade: ((finished?: boolean) => void) | undefined;
    jest.spyOn(Reanimated, 'withTiming').mockImplementation(((value: number, _config: unknown, done?: (finished?: boolean) => void) => {
      if (value === 0) finishFade = done;
      return value;
    }) as typeof Reanimated.withTiming);
    const peeks: number[] = [];
    const view = render(<Harness kind="services" peeks={peeks} />);
    layoutTop(96);

    // Ride starts: the tiles fade out; the peek holds until the greeting is shown, then 202 once.
    view.rerender(<Harness kind="greeting" peeks={peeks} />);
    expect(peeks[peeks.length - 1]).toBe(244);
    act(() => finishFade?.(true));
    layoutTop(22);
    // Ride ends: straight back to 244.
    view.rerender(<Harness kind="services" peeks={peeks} />);
    expect(peeks[peeks.length - 1]).toBe(202);
    act(() => finishFade?.(true));
    layoutTop(96);
    expect(distinct(peeks)).toEqual([244, 202, 244]);
  });

  it('greeting → ride-only (same height, no new layout) still drops the live extra, once', () => {
    const peeks: number[] = [];
    const view = render(<Harness kind="greeting" initial="greeting" peeks={peeks} />);
    view.rerender(<Harness kind="rideOnly" initial="greeting" peeks={peeks} />);
    expect(distinct(peeks)).toEqual([202, 170]);
  });
});

describe('S6: switching the header', () => {
  const top = (kind: HomeHeaderKind, extra: Partial<React.ComponentProps<typeof HomeSheetTop>> = {}) => (
    <HomeSheetTop kind={kind} greeting="Hello" onRide={jest.fn()} onParcel={jest.fn()} onHeight={jest.fn()} {...extra} />
  );

  it('the leaving tiles take no taps from the first frame of the fade; the heading comes once it ends', () => {
    let finishFade: ((finished?: boolean) => void) | undefined;
    const timing = jest.spyOn(Reanimated, 'withTiming').mockImplementation(((value: number, _config: unknown, done?: (finished?: boolean) => void) => {
      if (value === 0) finishFade = done;
      return value;
    }) as typeof Reanimated.withTiming);
    const view = render(top('services'));
    view.rerender(top('rideOnly'));
    expect(screen.getByTestId('home-sheet-top').props.pointerEvents).toBe('none');
    expect(screen.getByTestId('home-service-row')).toBeTruthy();
    act(() => finishFade?.(true));
    expect(screen.queryByTestId('home-service-row')).toBeNull();
    expect(screen.getByTestId('home-ride-only-heading')).toBeTruthy();
    expect(screen.getByTestId('home-sheet-top').props.pointerEvents).toBe('auto');
    timing.mockRestore();
  });

  it('waits while the sheet is dragged and swaps when the drag ends', () => {
    const reactions: Array<(now: boolean, previous: boolean | null) => void> = [];
    jest.spyOn(Reanimated, 'useAnimatedReaction').mockImplementation(((_prepare: unknown, react: (now: boolean, previous: boolean | null) => void) => {
      reactions.push(react);
    }) as typeof Reanimated.useAnimatedReaction);
    const hold = { value: true } as Reanimated.SharedValue<boolean>;
    const view = render(top('rideOnly', { hold }));
    view.rerender(top('services', { hold }));
    expect(screen.getByTestId('home-ride-only-heading')).toBeTruthy();
    hold.value = false;
    act(() => reactions[reactions.length - 1](false, true));
    expect(screen.getByTestId('home-service-row')).toBeTruthy();
  });

  it('reports its natural height once per change of 1pt or more', () => {
    const onHeight = jest.fn();
    render(top('services', { onHeight }));
    const node = screen.getByTestId('home-sheet-top');
    const layout = (height: number) => fireEvent(node, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 402, height } } });
    layout(96);
    layout(96.4);
    layout(102);
    expect(onHeight.mock.calls).toEqual([
      [96, 'services'],
      [102, 'services'],
    ]);
  });
});

describe('S4: copy and accessibility (en, Roman Urdu)', () => {
  const tiles = () =>
    render(<HomeSheetTop kind="services" greeting="" onRide={jest.fn()} onParcel={jest.fn()} onHeight={jest.fn()} />);

  it('English names and hints; "Where to?" books a ride', () => {
    tiles();
    const ride = screen.getByRole('button', { name: 'Ride. You travel, within the city.' });
    expect(ride.props.accessibilityHint).toBe('Opens Where to?');
    const parcelTile = screen.getByRole('button', { name: "Parcel. A bike rider takes your item. You don't travel." });
    expect(parcelTile.props.accessibilityHint).toBe('Opens Send a parcel');
    expect(screen.getByText('Within the city')).toBeTruthy();
    expect(screen.getByText('Send an item')).toBeTruthy();
    expect(t('home.whereToA11y')).toBe('Where to? Book a ride within the city');
  });

  it('Roman Urdu', () => {
    setLocale('ur-Latn');
    tiles();
    expect(screen.getByText('Shehar ke andar')).toBeTruthy();
    expect(screen.getByText('Saman bhejein')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ride. Aap khud safar karein, shehar ke andar.' })).toBeTruthy();
    expect(t('home.rideOnlyHeading')).toBe('Shehar ke andar rides');
    expect(t('home.whereToA11y')).toBe('Kahan jana hai? Shehar ke andar ride book karein');
  });
});

describe('S8: one push per tap', () => {
  it('ignores a second push within the window and frees it when the screen loses focus', () => {
    jest.useFakeTimers();
    const push = jest.fn();
    const { result, rerender } = renderHook(({ focused }: { focused: boolean }) => useOnePush(focused), {
      initialProps: { focused: true },
    });
    result.current(push);
    result.current(push);
    expect(push).toHaveBeenCalledTimes(1);
    rerender({ focused: false });
    result.current(push);
    expect(push).toHaveBeenCalledTimes(2);
    act(() => jest.advanceTimersByTime(ONE_PUSH_MS));
    result.current(push);
    expect(push).toHaveBeenCalledTimes(3);
  });
});
