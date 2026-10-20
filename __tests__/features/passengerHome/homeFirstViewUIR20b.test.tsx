/**
 * UI-R20b (passenger-home § Services v2 V1–V13): the Home first view. Layout maths (peek 274 /
 * 190, SE 254 / 170, live 198, half ≥ peek + 180), the order (greeting + tagline → "Where to?" →
 * chips → cards), every state (parcel on / off / unknown, live ride, offline, compact height),
 * the service row's on/off swap, the cold-open entrance once per session (and Reduce Motion),
 * the greeting clock, the brand-tinted map and blue user dot, the chip fade, RTL, en + Roman
 * Urdu copy and the retired keys. Kept from UI-R20: the last known parcel tier (S7) and one push
 * per tap (S8).
 */
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetInfo } from '@react-native-community/netinfo';
import * as Reanimated from 'react-native-reanimated';
import { AccessibilityInfo, AppState, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Provider } from 'react-redux';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { apiClient } from '../../../src/services/api';
import { clearQueryCache } from '../../../src/core/api/queryCache';
import PassengerHomeScreen from '../../../src/screens/Passenger/PassengerHomeScreen';
import { HomeSheetTop } from '../../../src/features/passenger-home/components/HomeSheetTop';
import { HomeServiceRow } from '../../../src/features/passenger-home/components/HomeServiceRow';
import { HomeSheetBody } from '../../../src/features/passenger-home/components/HomeSheet';
import { HomeMap } from '../../../src/features/passenger-home/components/HomeMap';
import {
  HOME_HEADER_ESTIMATE,
  HOME_PEEK_GROUP_ESTIMATE,
  headerKindFor,
  homeHalfMinHeight,
  homePeekHeight,
  isCompactHeight,
  taglineSlot,
} from '../../../src/features/passenger-home/layout';
import { useHomePeek } from '../../../src/features/passenger-home/useHomePeek';
import { HOME_VEIL_MAX_MS, homeEntranceDone, resetHomeEntranceForTests, useHomeEntrance } from '../../../src/features/passenger-home/useHomeEntrance';
import { msToNextGreeting, useGreetingClock } from '../../../src/features/passenger-home/useGreetingClock';
import { ONE_PUSH_MS, useOnePush } from '../../../src/features/passenger-home/useOnePush';
import {
  PARCEL_TILE_STORAGE_KEY,
  lastKnownParcelTile,
  rememberParcelTile,
  resetParcelTileForTests,
  restoreParcelTile,
} from '../../../src/features/parcel/lastKnown';
import { createActiveRide } from '../../../src/features/active-ride/slice';
import { en } from '../../../src/i18n/en';
import { urLatn } from '../../../src/i18n/ur-Latn';
import { setLocale, t } from '../../../src/i18n';
import { contrastRatio, darkColors, lightColors, mapBackgrounds, mapStyles } from '../../../src/theme';
import { makeRide, makeRideRequest, makeStore, page, type TestStore } from '../../../test-utils/rideFixtures';
import { homeBodyProps } from '../../../test-utils/homeFixtures';

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
  resetHomeEntranceForTests();
  await AsyncStorage.clear();
  setLocale('en');
});
afterEach(() => {
  mock.restore();
  jest.useRealTimers();
  jest.restoreAllMocks();
  (useNetInfo as jest.Mock).mockImplementation(() => ({ isConnected: true, isInternetReachable: true }));
});

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
};

const homeTree = (store: TestStore) => (
  <Provider store={store}>
    <ThemeProvider>
      <PassengerHomeScreen />
    </ThemeProvider>
  </Provider>
);

const renderHome = async (store: TestStore = makeStore()) => {
  const view = render(homeTree(store));
  await flush();
  return view;
};

const layoutContainer = (height: number) =>
  act(() => {
    fireEvent(screen.getByTestId('home-sheet').parent!.parent!, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 402, height } },
    });
  });

const flat = (style: StyleProp<ViewStyle | TextStyle>): ViewStyle & TextStyle => (StyleSheet.flatten(style) ?? {}) as ViewStyle & TextStyle;

describe('V1: layout maths', () => {
  it('estimates and peeks: 274 / 190 on iPhone 17, 254 / 170 on SE, 198 live; half ≥ peek + 180', () => {
    expect(HOME_HEADER_ESTIMATE).toEqual({ tagline: 122, compact: 102, live: 34 });
    expect(HOME_PEEK_GROUP_ESTIMATE).toEqual({ services: 128, plain: 44, live: 140 });
    const peek = (header: number, group: number) => homePeekHeight({ headerHeight: header, peekGroupHeight: group });
    expect(peek(122, 128)).toBe(274);
    expect(peek(122, 44)).toBe(190);
    expect(peek(102, 128)).toBe(254);
    expect(peek(102, 44)).toBe(170);
    expect(peek(34, 140)).toBe(198);
    // half = max(50 % of the container, peek + 180): iPhone 17 (780) → 454, SE (604) → 434.
    expect(Math.max(780 / 2, homeHalfMinHeight(274))).toBe(454);
    expect(Math.max(604 / 2, homeHalfMinHeight(254))).toBe(434);
  });

  it('compact below 700 pt; the tagline slot by state, first match wins', () => {
    expect(isCompactHeight(667)).toBe(true);
    expect(isCompactHeight(874)).toBe(false);
    expect(taglineSlot({ live: true, offline: true, compact: false })).toBe('none');
    expect(taglineSlot({ live: false, offline: true, compact: true })).toBe('offline');
    expect(taglineSlot({ live: false, offline: false, compact: true })).toBe('none');
    expect(taglineSlot({ live: false, offline: false, compact: false })).toBe('tagline');
    expect(headerKindFor(true, 'none')).toBe('live');
    expect(headerKindFor(false, 'none')).toBe('compact');
    expect(headerKindFor(false, 'offline')).toBe('tagline');
  });

  it('useHomePeek: estimates until measured; 1.3× grows it; sub-point changes ignored; one height per kind', () => {
    const { result, rerender } = renderHook(
      (props: { headerKind: 'tagline' | 'compact' | 'live'; live: boolean; servicesInPeek: boolean }) => useHomePeek(props),
      { initialProps: { headerKind: 'tagline', live: false, servicesInPeek: true } },
    );
    expect(result.current.peek).toBe(274);
    expect(result.current.halfMin).toBe(454);
    // 1.3× text: greeting 29 + tagline 26 + 12 + 56 + 12; chips ≈ 38 + 12; cards 72 + 12.
    act(() => result.current.onHeaderHeight(135, 'tagline'));
    act(() => result.current.onGroupHeight(50, 'plain'));
    expect(result.current.peek).toBe(24 + 135 + 50 + 84);
    act(() => result.current.onHeaderHeight(135.4, 'tagline'));
    expect(result.current.peek).toBe(293);
    // Parcel off: the row leaves the peek.
    rerender({ headerKind: 'tagline', live: false, servicesInPeek: false });
    expect(result.current.peek).toBe(24 + 135 + 50);
    // A ride starts: the live kinds were never measured, so their estimates (no 1.3× carry-over).
    rerender({ headerKind: 'live', live: true, servicesInPeek: true });
    expect(result.current.peek).toBe(198);
  });
});

describe('V1/V10: the first view on Home', () => {
  it('parcel on: greeting + tagline, then "Where to?" in the header; chips then the cards in the body', async () => {
    mock.onGet('/public/vehicle-types').reply(200, { success: true, data: [car, parcel] });
    await renderHome();
    const header = screen.getByTestId('home-sheet-top');
    expect(within(header).getByTestId('home-greeting')).toHaveTextContent(/Fake$/);
    expect(within(header).getByTestId('home-tagline')).toHaveTextContent('Fixed fares, within the city');
    expect(within(header).getByTestId('home-where-to')).toBeTruthy();
    const body = screen.getByTestId('home-sheet-body');
    expect(within(body).queryByTestId('home-where-to')).toBeNull();
    // Chips come before the cards.
    const group = within(body).getByTestId('home-peek-group');
    expect(within(group).getByTestId('home-saved-places-row')).toBeTruthy();
    expect(within(group).queryByTestId('home-service-row')).toBeNull();
    expect(within(body).getByTestId('home-service-row')).toBeTruthy();
    expect(screen.queryByTestId('home-ride-only-heading')).toBeNull();
    // Ride books like "Where to?"; Parcel opens the form.
    fireEvent.press(screen.getByTestId('home-service-ride'));
    expect(mockNavigate).toHaveBeenLastCalledWith('Booking', { entry: 'whereTo' });
  });

  it('peek 274 with the cards, half max(50 %, peek + 180)', async () => {
    const spring = jest.spyOn(Reanimated, 'withSpring');
    mock.onGet('/public/vehicle-types').reply(200, { success: true, data: [car, parcel] });
    await renderHome();
    await layoutContainer(874);
    expect(spring.mock.calls.map(call => call[0])).toContain(874 - 274);
    spring.mockClear();
    act(() => fireEvent(screen.getByTestId('home-sheet-handle'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } }));
    expect(spring.mock.calls.map(call => call[0])).toEqual([874 - 454]);
  });

  it('parcel off: no cards and no heading; the tagline still says "within the city"; peek 190', async () => {
    const spring = jest.spyOn(Reanimated, 'withSpring');
    mock.onGet('/public/vehicle-types').reply(200, { success: true, data: [car] });
    await renderHome();
    await layoutContainer(874);
    expect(screen.queryByTestId('home-service-row')).toBeNull();
    expect(screen.queryByTestId('home-send-parcel')).toBeNull();
    expect(screen.getByTestId('home-tagline')).toBeTruthy();
    expect(spring.mock.calls.map(call => call[0])).toContain(874 - 190);
  });

  it('a ride in progress: greeting only (no tagline), "Return to your ride", no cards whatever the tier', async () => {
    mock.onGet('/public/vehicle-types').reply(200, { success: true, data: [car, parcel] });
    mock.onGet('/rides/21').reply(200, { success: true, data: makeRide({ id: 21, status: 'accepted', driver_id: 5 }) });
    const store = makeStore();
    store.dispatch(createActiveRide.fulfilled(makeRide({ id: 21, status: 'accepted', driver_id: 5 }), 'req', makeRideRequest()));
    await renderHome(store);
    expect(screen.getByTestId('home-greeting')).toBeTruthy();
    expect(screen.queryByTestId('home-tagline')).toBeNull();
    expect(screen.queryByTestId('home-where-to')).toBeNull();
    expect(screen.getByTestId('home-return-to-ride')).toBeTruthy();
    expect(screen.queryByTestId('home-service-row')).toBeNull();
  });

  it('offline: the offline line takes the tagline slot (no Banner, no count chip)', async () => {
    (useNetInfo as jest.Mock).mockImplementation(() => ({ isConnected: false, isInternetReachable: false }));
    mock.onGet('/public/vehicle-types').reply(200, { success: true, data: [car, parcel] });
    await renderHome();
    expect(screen.getByTestId('home-offline-tagline')).toHaveTextContent(/You're offline. Showing saved info.$/);
    expect(screen.queryByTestId('home-tagline')).toBeNull();
    expect(screen.queryByTestId('offline-banner')).toBeNull();
    expect(screen.queryByTestId('nearby-drivers-status')).toBeNull();
  });

  it('no name: the salutation alone', () => {
    render(<HomeSheetTop greeting={t('home.greetingMorning')} slot="tagline" live={false} onWhereTo={jest.fn()} onHeight={jest.fn()} />);
    expect(screen.getByRole('header', { name: 'Good morning' })).toBeTruthy();
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
    expect(mockNavigate).toHaveBeenLastCalledWith('Booking', { entry: 'whereTo' });
  });
});

describe('V6: the service row switching on and off', () => {
  const row = (visible: boolean, extra: Partial<React.ComponentProps<typeof HomeServiceRow>> = {}) => (
    <HomeServiceRow visible={visible} onRide={jest.fn()} onParcel={jest.fn()} onShown={jest.fn()} onHeight={jest.fn()} {...extra} />
  );

  it('on → off: no taps from the first frame of the fade; it leaves the peek only once faded, then unmounts', () => {
    let finishFade: ((finished?: boolean) => void) | undefined;
    jest.spyOn(Reanimated, 'withTiming').mockImplementation(((value: number, _config: unknown, done?: (finished?: boolean) => void) => {
      if (value === 0 && !finishFade) finishFade = done;
      else done?.(true);
      return value;
    }) as typeof Reanimated.withTiming);
    const onShown = jest.fn();
    const view = render(row(true, { onShown }));
    view.rerender(row(false, { onShown }));
    expect(screen.getByTestId('home-service-row-inner').props.pointerEvents).toBe('none');
    expect(onShown).not.toHaveBeenCalled();
    act(() => finishFade?.(true));
    expect(onShown).toHaveBeenLastCalledWith(false);
    expect(screen.queryByTestId('home-service-row')).toBeNull();
  });

  it('off → on: joins the peek at once (the sheet grows with it) and fades in after the resize', () => {
    const delay = jest.spyOn(Reanimated, 'withDelay');
    const onShown = jest.fn();
    const view = render(row(false, { onShown }));
    expect(screen.queryByTestId('home-service-row')).toBeNull();
    view.rerender(row(true, { onShown }));
    expect(onShown).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('home-service-row')).toBeTruthy();
    expect(delay.mock.calls.map(call => call[0])).toEqual([250, 250]);
  });

  it('waits while the sheet is dragged and swaps when the drag ends', () => {
    const reactions: Array<(now: boolean, previous: boolean | null) => void> = [];
    jest.spyOn(Reanimated, 'useAnimatedReaction').mockImplementation(((_prepare: unknown, react: (now: boolean, previous: boolean | null) => void) => {
      reactions.push(react);
    }) as typeof Reanimated.useAnimatedReaction);
    const hold = { value: true } as Reanimated.SharedValue<boolean>;
    const view = render(row(false, { hold }));
    view.rerender(row(true, { hold }));
    expect(screen.queryByTestId('home-service-row')).toBeNull();
    hold.value = false;
    act(() => reactions[reactions.length - 1](false, true));
    expect(screen.getByTestId('home-service-row')).toBeTruthy();
  });

  it('reports its natural height (with the 12 gap) once per change of 1pt or more', () => {
    const onHeight = jest.fn();
    render(row(true, { onHeight }));
    const node = screen.getByTestId('home-service-row');
    const layout = (height: number) => fireEvent(node, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 370, height } } });
    layout(84);
    layout(84.4);
    layout(90);
    expect(onHeight.mock.calls).toEqual([[84], [90]]);
  });
});

describe('S7: cold start and unknown availability (kept)', () => {
  it('the stored last known value shows the cards before the catalogue answers; a failed read keeps them', async () => {
    await AsyncStorage.setItem(PARCEL_TILE_STORAGE_KEY, '1');
    await restoreParcelTile();
    mock.onGet('/public/vehicle-types').reply(500, { success: false, message: 'Server error' });
    await renderHome();
    expect(screen.getByTestId('home-service-row')).toBeTruthy();
  });

  it('nothing known (first launch): no cards, never a skeleton card', async () => {
    mock.onGet('/public/vehicle-types').reply(500, { success: false, message: 'Server error' });
    await renderHome();
    expect(screen.queryByTestId('home-service-row')).toBeNull();
    expect(screen.getByTestId('home-where-to')).toBeTruthy();
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

  it('a storage read that rejects leaves the tier unknown and never rejects itself; garbage is ignored', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(restoreParcelTile()).resolves.toBeUndefined();
    expect(lastKnownParcelTile()).toBeNull();
    await AsyncStorage.setItem(PARCEL_TILE_STORAGE_KEY, 'yes');
    await restoreParcelTile();
    expect(lastKnownParcelTile()).toBeNull();
  });
});

describe('V7: cold-open entrance', () => {
  it('plays once per session: blocks at 60/100/140/180/220, controls at 200; a later mount starts settled', async () => {
    const delay = jest.spyOn(Reanimated, 'withDelay');
    mock.onGet('/public/vehicle-types').reply(200, { success: true, data: [car, parcel] });
    const view = await renderHome();
    expect(homeEntranceDone()).toBe(true);
    const delays = delay.mock.calls.map(call => call[0]);
    expect(delays).toEqual(expect.arrayContaining([60, 100, 140, 180, 220, 200]));
    expect(screen.getByTestId('home-map-veil', { includeHiddenElements: true }).props.pointerEvents).toBe('none');
    // Every control is pressable from frame 0.
    fireEvent.press(screen.getByTestId('home-where-to'));
    expect(mockNavigate).toHaveBeenLastCalledWith('Booking', { entry: 'whereTo' });

    view.unmount();
    delay.mockClear();
    await renderHome();
    expect(delay.mock.calls.filter(call => [60, 100, 140, 180, 220].includes(call[0]))).toEqual([]);
    expect(screen.queryByTestId('home-map-veil', { includeHiddenElements: true })).toBeNull();
  });

  it('skipped while Home is not focused, then plays on the first focus only', () => {
    mockFocused = false;
    const { rerender } = renderHook(({ focused }: { focused: boolean }) => useHomeEntrance({ focused, mapReady: false }), {
      initialProps: { focused: false },
    });
    expect(homeEntranceDone()).toBe(false);
    rerender({ focused: true });
    expect(homeEntranceDone()).toBe(true);
  });

  it('Reduce Motion: no spring and no delayed blocks; the veil fades in 150 once the map is ready', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const cancel = jest.spyOn(Reanimated, 'cancelAnimation');
    const { rerender } = renderHook(({ ready }: { ready: boolean }) => useHomeEntrance({ focused: true, mapReady: ready }), {
      initialProps: { ready: false },
    });
    await flush();
    // The setting arrives asynchronously: anything already started is cancelled and settled.
    expect(cancel).toHaveBeenCalled();
    timing.mockClear();
    rerender({ ready: true });
    expect(timing.mock.calls.map(call => call[1]?.duration)).toEqual([150]);
  });
});

describe('V7: map veil cap', () => {
  it('the veil lifts at onMapReady, and after 4000 ms at the latest if the map never reports ready', () => {
    const delay = jest.spyOn(Reanimated, 'withDelay');
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const { rerender } = renderHook(({ ready }: { ready: boolean }) => useHomeEntrance({ focused: true, mapReady: ready }), {
      initialProps: { ready: false },
    });
    expect(HOME_VEIL_MAX_MS).toBe(4000);
    // The capped fade: withDelay(4000, withTiming(0, 250)).
    const capIndex = delay.mock.calls.findIndex(call => call[0] === HOME_VEIL_MAX_MS);
    expect(capIndex).toBeGreaterThanOrEqual(0);
    expect(timing.mock.calls.some(call => call[0] === 0 && call[1]?.duration === 250)).toBe(true);
    // The map draws: the veil fades straight away (no delay).
    delay.mockClear();
    timing.mockClear();
    rerender({ ready: true });
    expect(delay).not.toHaveBeenCalled();
    expect(timing.mock.calls.map(call => [call[0], call[1]?.duration])).toEqual([[0, 250]]);
  });
});

describe('V3: greeting clock', () => {
  it('re-reads the time at the next boundary; the timer and the AppState listener go on blur and unmount', () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 20, 11, 59, 30) });
    const remove = jest.fn();
    const listen = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove } as ReturnType<typeof AppState.addEventListener>);
    const { result, rerender, unmount } = renderHook(({ focused }: { focused: boolean }) => useGreetingClock(focused), {
      initialProps: { focused: true },
    });
    expect(result.current.getHours()).toBe(11);
    act(() => jest.advanceTimersByTime(31_000));
    expect(result.current.getHours()).toBe(12);
    expect(jest.getTimerCount()).toBe(1);
    // Back in the foreground: re-read at once.
    const onChange = listen.mock.calls[listen.mock.calls.length - 1][1] as (state: string) => void;
    act(() => jest.advanceTimersByTime(60_000));
    act(() => onChange('active'));
    expect(result.current.getMinutes()).toBe(1);
    rerender({ focused: false });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    rerender({ focused: true });
    unmount();
    expect(remove).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('the next boundary is 05:00, 12:00, 17:00 or 22:00', () => {
    const at = (h: number, m = 0) => new Date(2026, 9, 20, h, m, 0, 0);
    expect(msToNextGreeting(at(9, 30))).toBe(150 * 60_000);
    expect(msToNextGreeting(at(16, 59))).toBe(60_000);
    expect(msToNextGreeting(at(23))).toBe(6 * 3_600_000);
    expect(msToNextGreeting(at(4))).toBe(3_600_000);
  });
});

describe('V8/V9: map style and chrome', () => {
  it('brand-tinted land and module-constant styles; the user dot stands out on both', () => {
    expect(mapBackgrounds).toEqual({ light: '#F3F5F9', dark: '#1B2233' });
    expect(mapStyles.light).toContainEqual({ featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#E3EEE6' }] });
    expect(mapStyles.dark).toContainEqual({ featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#34426B' }] });
    expect(contrastRatio(lightColors.userLocation, mapBackgrounds.light)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(darkColors.userLocation, mapBackgrounds.dark)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(lightColors.routeLine, mapBackgrounds.light)).toBeGreaterThan(13);
    expect(contrastRatio(lightColors.pickupPin, mapBackgrounds.light)).toBeGreaterThanOrEqual(4.5);
  });

  it('the status-bar scrim shows at peek (insets.top + 24, surface 0.85 → 0)', async () => {
    mock.onGet('/public/vehicle-types').reply(200, { success: true, data: [car] });
    await renderHome();
    const scrim = screen.getByTestId('home-status-scrim', { includeHiddenElements: true });
    expect(flat(scrim.props.style).height).toBe(24);
  });

  it('the user dot is `userLocation` (14) in a 20 ring and a 40 halo, not navy `primary`', async () => {
    render(
      <ThemeProvider>
        <HomeMap
          mapRef={{ current: null }}
          mounted
          currentLocation={{ latitude: 31.5, longitude: 74.3 }}
          onMapReady={jest.fn()}
          drivers={[]}
          freshness="fresh"
          showVeil={false}
        />
      </ThemeProvider>,
    );
    await flush();
    const dot = flat(screen.getByTestId('home-user-dot', { includeHiddenElements: true }).props.style);
    expect(dot).toMatchObject({ width: 14, height: 14, backgroundColor: lightColors.userLocation });
    expect(dot.backgroundColor).not.toBe(lightColors.primary);
  });
});

describe('V5: the chip row', () => {
  it('the trailing fade shows only while the chips are wider than the row', async () => {
    render(
      <ThemeProvider>
        <HomeSheetBody {...homeBodyProps()} />
      </ThemeProvider>,
    );
    await flush();
    const rowNode = screen.getByTestId('home-saved-places-row');
    expect(screen.queryByTestId('home-saved-places-fade', { includeHiddenElements: true })).toBeNull();
    act(() => fireEvent(rowNode.parent!, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 402, height: 32 } } }));
    act(() => fireEvent(rowNode, 'contentSizeChange', 300, 32));
    expect(screen.queryByTestId('home-saved-places-fade', { includeHiddenElements: true })).toBeNull();
    act(() => fireEvent(rowNode, 'contentSizeChange', 520, 32));
    expect(screen.getByTestId('home-saved-places-fade', { includeHiddenElements: true })).toBeTruthy();
    // Outline chips: "Saved places" on `surface` with a border.
    expect(flat(screen.getByTestId('home-saved-places').props.style)).toMatchObject({ backgroundColor: lightColors.surface, borderWidth: 1 });
  });
});

describe('V11: copy (en, Roman Urdu) and RTL', () => {
  const top = () => render(<HomeSheetTop greeting="Hello" slot="tagline" live={false} onWhereTo={jest.fn()} onHeight={jest.fn()} />);

  it('English card names, hints and the tagline; "Where to?" books a ride', () => {
    render(<HomeSheetBody {...homeBodyProps({ servicesVisible: true })} />);
    const ride = screen.getByRole('button', { name: 'Ride. You travel, within the city.' });
    expect(ride.props.accessibilityHint).toBe('Opens Where to?');
    expect(screen.getByRole('button', { name: "Parcel. A bike rider takes your item. You don't travel." }).props.accessibilityHint).toBe(
      'Opens Send a parcel',
    );
    expect(screen.getByText('Ride')).toBeTruthy();
    expect(screen.getByText('Parcel')).toBeTruthy();
    expect(t('home.whereToA11y')).toBe('Where to? Book a ride within the city');
    expect(t('home.tagline')).toBe('Fixed fares, within the city');
  });

  it('Roman Urdu: greeting words, tagline, offline line, loanword card names', () => {
    setLocale('ur-Latn');
    top();
    expect(screen.getByTestId('home-tagline')).toHaveTextContent('Tay shuda kiraya, shehar ke andar');
    expect(screen.getByText('Kahan jana hai?')).toBeTruthy();
    expect(t('home.offlineTagline')).toBe('Aap offline hain. Mehfooz maloomat dikha rahe hain.');
    expect(t('home.greetingMorning')).toBe('Subah bakhair');
    expect(t('home.serviceRideTitle')).toBe('Ride');
    expect(t('home.serviceParcelTitle')).toBe('Parcel');
  });

  it('the three retired keys are gone from both tables', () => {
    for (const table of [en, urLatn]) {
      const home = table.home as Record<string, unknown>;
      expect(home.serviceRideSub).toBeUndefined();
      expect(home.serviceParcelSub).toBeUndefined();
      expect(home.rideOnlyHeading).toBeUndefined();
    }
  });
});

describe('S8: one push per tap (kept)', () => {
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
