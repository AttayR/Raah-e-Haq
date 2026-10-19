/**
 * T-581 (QA 2026-10-19 follow-ups, docs/qa-reports/2026-10-19-uir14-t580-qa):
 * 1. a long press on an unread notification only marks it read (no open on release);
 * 2. the empty chat-thread note is upright in the inverted list;
 * 3. an old requeued "driver cancelled" row opens the ride's details, not Booking, once the ride
 *    is no longer live;
 * 6. the map's default region is the service area (Lahore);
 * 7. Messages re-reads its list while on screen, on the shared poll engine (no bursts);
 * 8. Send reads the latest text (a tap racing the last keystroke is not lost);
 * 9. copy: failed send per spec, "Ride ID" in Roman Urdu; the parcel chip re-checks the
 *    catalogue when the app returns to the foreground.
 * (4 and 5 are in __tests__/hooks/useNativeLocation.test.ts and __tests__/core/api/logApiFailure.test.ts.)
 */
import React, { useState } from 'react';
import { AppState, FlatList, StyleSheet, type AppStateStatus } from 'react-native';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { apiClient } from '../../src/services/api';
import rideService from '../../src/services/rideService';
import { NotificationRow } from '../../src/features/notifications/components/NotificationRow';
import type { AppNotification } from '../../src/features/notifications/types';
import { confirmPassengerLiveRide } from '../../src/features/notifications/liveRideTarget';
import { routeForTarget } from '../../src/features/notifications/navigation';
import { cancelActiveRide, createActiveRide, restoreActiveRide } from '../../src/features/active-ride/slice';
import { ChatThreadEmptyNote } from '../../src/features/chat/components/ChatThreadStates';
import { ChatComposer } from '../../src/features/chat/components/ChatComposer';
import { MessageBubble } from '../../src/features/chat/components/MessageBubble';
import { CHAT_LIST_POLL_INTERVAL_MS, useChatList } from '../../src/features/chat/hooks';
import { chatApi } from '../../src/features/chat/api';
import { CHAT_COPY } from '../../src/features/chat/copy';
import type { ChatSendError, ThreadItem } from '../../src/features/chat/thread';
import { RIDE_HISTORY_COPY } from '../../src/features/ride-history/copy';
import { useParcelAvailable } from '../../src/features/parcel/hooks';
import { CACHE_TTL, clearQueryCache } from '../../src/core/api/queryCache';
import { MAPS_CONFIG } from '../../src/config/mapsConfig';
import { getDefaultLocation } from '../../src/utils/locationUtils';
import { setLocale } from '../../src/i18n';
import { resetLanguagePreferenceForTests } from '../../src/i18n/languagePreference';
import '../../src/i18n/copy-ur-Latn';
import { makeRide, makeRideRequest, makeStore, page } from '../../test-utils/rideFixtures';

const notification = (overrides: Partial<AppNotification> = {}): AppNotification => ({
  id: 5,
  type: 'driver_arrived',
  category: 'ride',
  title: 'Title 5',
  body: 'Body 5',
  data: { rideId: 1, stopId: null, messageId: null, fare: null, cancelledBy: null, requeued: false },
  imageUrl: null,
  actionUrl: null,
  actionText: null,
  isBroadcast: false,
  readAt: null,
  createdAt: '2026-10-19T09:30:00.000Z',
  ...overrides,
});

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
  jest.useRealTimers();
  resetLanguagePreferenceForTests();
});

describe('1. long press on an unread notification', () => {
  /** Like the list: marking read re-renders the row as read while the finger is still down. */
  function Harness({ onPress }: { onPress: (item: AppNotification) => void }) {
    const [item, setItem] = useState(notification());
    return (
      <NotificationRow
        item={item}
        onPress={onPress}
        onMarkRead={() => setItem((current) => ({ ...current, readAt: '2026-10-19T10:00:00.000Z' }))}
      />
    );
  }

  const touch = { nativeEvent: { touches: [], changedTouches: [], pageX: 10, pageY: 10, locationX: 10, locationY: 10, timestamp: 0 } };

  it('marks read and does not open on release (Pressability press cycle)', () => {
    jest.useFakeTimers();
    const onPress = jest.fn();
    render(<Harness onPress={onPress} />);
    const row = () => screen.getByTestId('notification-row-5');

    fireEvent(row(), 'responderGrant', { ...touch, persist: jest.fn(), currentTarget: 1 });
    act(() => {
      jest.advanceTimersByTime(800);
    });
    // Read now: the dot went with the long press.
    expect(screen.queryByTestId('notification-unread-5')).toBeNull();
    fireEvent(row(), 'responderRelease', { ...touch, persist: jest.fn(), currentTarget: 1 });
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(onPress).not.toHaveBeenCalled();
  });

  it('a plain tap still opens', () => {
    const onPress = jest.fn();
    render(<Harness onPress={onPress} />);
    fireEvent.press(screen.getByTestId('notification-row-5'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('2. empty chat-thread note in the inverted list', () => {
  it('receives the list flip back upright (VirtualizedList passes it as style)', () => {
    render(
      <FlatList
        inverted
        data={[] as string[]}
        renderItem={() => null}
        ListEmptyComponent={<ChatThreadEmptyNote text="Messages are shared only with your driver for this ride." />}
      />,
    );
    const style = StyleSheet.flatten(screen.getByTestId('chat-thread-empty').props.style);
    expect(style.transform).toEqual(expect.arrayContaining([expect.objectContaining({ scaleY: -1 })]));
  });
});

describe('3. a ride notification for a ride that is no longer live', () => {
  const rideTarget = (rideId: number) => ({ kind: 'ride' as const, rideId });

  it('the live ride in the store opens Booking, with no request', async () => {
    const store = makeStore();
    jest.spyOn(rideService, 'createRide').mockResolvedValueOnce(makeRide({ id: 41, status: 'requested' }));
    await store.dispatch(createActiveRide(makeRideRequest()));
    const before = mock.history.get.length;
    await expect(confirmPassengerLiveRide(rideTarget(41), store)).resolves.toEqual(rideTarget(41));
    expect(mock.history.get.length).toBe(before);
  });

  it('a long-cancelled ride (the server has no live ride) opens its details, after one read', async () => {
    mock.onGet('/rides').reply(200, page([]));
    const store = makeStore();
    const target = await confirmPassengerLiveRide(rideTarget(249), store);
    expect(target).toEqual({ kind: 'rideDetails', rideId: 249 });
    expect(mock.history.get.filter((r) => r.url === '/rides')).toHaveLength(1);
    expect(routeForTarget('passenger', target, true)).toEqual({ screen: 'RideDetails', params: { rideId: 249 }, initial: false });
  });

  it('a ride live on the server but not in the store yet still opens Booking', async () => {
    mock.onGet('/rides').reply(200, page([makeRide({ id: 55, status: 'requested' })]));
    const store = makeStore();
    await expect(confirmPassengerLiveRide(rideTarget(55), store)).resolves.toEqual(rideTarget(55));
  });

  it('the same ride held but already finished opens its details with no request', async () => {
    const store = makeStore();
    jest.spyOn(rideService, 'createRide').mockResolvedValueOnce(makeRide({ id: 42, status: 'requested' }));
    await store.dispatch(createActiveRide(makeRideRequest()));
    jest.spyOn(rideService, 'cancelRide').mockResolvedValueOnce(makeRide({ id: 42, status: 'cancelled' }));
    await store.dispatch(cancelActiveRide(42));
    const before = mock.history.get.length;
    await expect(confirmPassengerLiveRide(rideTarget(42), store)).resolves.toEqual({ kind: 'rideDetails', rideId: 42 });
    expect(mock.history.get.length).toBe(before);
  });

  it('a launch restore already running is waited for (no second read), then decides', async () => {
    let release!: (value: [number, unknown]) => void;
    mock.onGet('/rides').replyOnce(() => new Promise<[number, unknown]>((resolve) => { release = resolve; }));
    const store = makeStore();
    const restoring = store.dispatch(restoreActiveRide());
    expect(store.getState().activeRide.restoreStatus).toBe('loading');
    const decided = confirmPassengerLiveRide(rideTarget(60), store);
    await act(async () => {
      await Promise.resolve();
    });
    release([200, page([makeRide({ id: 60, status: 'accepted' })])]);
    await restoring;
    await expect(decided).resolves.toEqual(rideTarget(60));
    expect(mock.history.get.filter((r) => r.url === '/rides')).toHaveLength(1);
  });

  it('other targets pass through untouched', async () => {
    const store = makeStore();
    await expect(confirmPassengerLiveRide({ kind: 'rideHistory' }, store)).resolves.toEqual({
      kind: 'rideHistory',
    });
    expect(mock.history.get).toHaveLength(0);
  });
});

describe('6. map default region', () => {
  it('is the service area (Lahore), the same city as getDefaultLocation', () => {
    expect(MAPS_CONFIG.DEFAULT_REGION.latitude).toBeCloseTo(31.5204, 3);
    expect(MAPS_CONFIG.DEFAULT_REGION.longitude).toBeCloseTo(74.3587, 3);
    expect(getDefaultLocation()).toMatchObject({
      latitude: MAPS_CONFIG.DEFAULT_REGION.latitude,
      longitude: MAPS_CONFIG.DEFAULT_REGION.longitude,
    });
  });
});

describe('7. Messages refreshes while on screen', () => {
  const flush = async () => {
    await act(async () => {
      for (let i = 0; i < 5; i += 1) await Promise.resolve();
    });
  };

  it('re-reads every interval while visible, one request at a time, and stops when hidden', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    const list = jest.spyOn(chatApi, 'listChats').mockResolvedValue([]);
    const { rerender, unmount } = renderHook(({ visible }: { visible: boolean }) => useChatList(visible), {
      initialProps: { visible: true },
    });
    await flush();
    expect(list).toHaveBeenCalledTimes(1);

    // Not before the interval.
    await act(async () => {
      jest.advanceTimersByTime(CHAT_LIST_POLL_INTERVAL_MS - 1000);
    });
    expect(list).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await flush();
    expect(list).toHaveBeenCalledTimes(2);

    // Hidden: nothing more.
    rerender({ visible: false });
    await act(async () => {
      jest.advanceTimersByTime(CHAT_LIST_POLL_INTERVAL_MS * 3);
    });
    expect(list).toHaveBeenCalledTimes(2);

    // Back after a long time: one read on return, not a second one from the poll at once.
    rerender({ visible: true });
    await flush();
    expect(list).toHaveBeenCalledTimes(3);
    await act(async () => {
      jest.advanceTimersByTime(CHAT_LIST_POLL_INTERVAL_MS - 1000);
    });
    expect(list).toHaveBeenCalledTimes(3);
    unmount();
  });
});

describe('7b. a pull while the poll is due', () => {
  it('the poll skips its read while the pull is in flight; the spinner ends with the pull', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    const list = jest.spyOn(chatApi, 'listChats').mockResolvedValueOnce([]);
    const { result, unmount } = renderHook(() => useChatList(true));
    await act(async () => {
      for (let i = 0; i < 5; i += 1) await Promise.resolve();
    });
    expect(list).toHaveBeenCalledTimes(1);

    let release!: (value: never[]) => void;
    list.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    act(() => result.current.refresh());
    expect(result.current.refreshing).toBe(true);
    // Past the interval while the pull is pending: no second request.
    await act(async () => {
      jest.advanceTimersByTime(CHAT_LIST_POLL_INTERVAL_MS * 2);
    });
    expect(list).toHaveBeenCalledTimes(2);
    list.mockResolvedValue([]);
    await act(async () => {
      release([]);
      for (let i = 0; i < 5; i += 1) await Promise.resolve();
    });
    expect(result.current.refreshing).toBe(false);
    unmount();
  });
});

describe('8. Send reads the latest text', () => {
  it('a Send handler from the render before the last keystroke still sends what was typed', () => {
    jest.useFakeTimers();
    const onSend = jest.fn(() => true);
    render(<ChatComposer onSend={onSend} bottomInset={0} />);
    // The press handler as it was before the keystroke re-rendered the composer.
    const staleSend = screen.UNSAFE_getByProps({ testID: 'chat-send', accessibilityRole: 'button' }).props.onPress as () => void;
    const input = screen.getByTestId('chat-input');
    act(() => {
      (input.props.onChangeText as (text: string) => void)('Hello');
    });
    act(() => staleSend());
    // T-582: Send goes out one frame after the tap.
    act(() => {
      jest.advanceTimersByTime(16);
    });
    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('an empty draft sends nothing, and the button says it is disabled', () => {
    const onSend = jest.fn(() => true);
    render(<ChatComposer onSend={onSend} bottomInset={0} />);
    fireEvent.press(screen.getByTestId('chat-send'));
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByTestId('chat-send').props.accessibilityState).toEqual({ disabled: true });
  });
});

describe('9. copy and the parcel chip', () => {
  const failed = (error: ChatSendError): ThreadItem => ({
    kind: 'pending',
    key: 'c1',
    pending: { clientId: 'c1', body: 'Hi', createdAt: '2026-10-19T09:05:00.000Z', status: 'failed', error },
  });

  it('a failed send reads "Not sent. Tap to retry." (spec); a refusal keeps its reason', () => {
    const { unmount } = render(<MessageBubble item={failed('network')} seen={false} onRetry={jest.fn()} />);
    expect(screen.getByText('Not sent. Tap to retry.')).toBeTruthy();
    unmount();
    render(<MessageBubble item={failed('closed')} seen={false} onRetry={jest.fn()} />);
    expect(screen.getByText('Not sent. Chat closed for this ride.')).toBeTruthy();
  });

  it('Roman Urdu: the failed-send line and "Ride ID" are translated', () => {
    act(() => setLocale('ur-Latn'));
    expect(CHAT_COPY.notSentRetry).toBe('Nahi gaya. Dobara ke liye tap karein.');
    expect(RIDE_HISTORY_COPY.rideCode).not.toBe('Ride ID');
  });

  it('back in the foreground on Home, an old catalogue is re-read: a tier switched off drops the chip', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    clearQueryCache();
    const handlers: Array<(state: AppStateStatus) => void> = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      handlers.push(handler as (state: AppStateStatus) => void);
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    const fare = { currency: 'PKR', base_fare: 50, per_km: 25, per_min: 2, min_fare: 100, per_stop: 20 };
    const car = { key: 'car', label: 'Car', capacity: 4, icon: 'car', fare };
    const parcel = { key: 'parcel', label: 'Parcel', capacity: 1, icon: 'parcel', fare };
    mock
      .onGet('/public/vehicle-types')
      .replyOnce(200, { success: true, data: [car, parcel] })
      .onGet('/public/vehicle-types')
      .reply(200, { success: true, data: [car] });
    const { result } = renderHook(() => useParcelAvailable(true));
    await act(async () => {
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
    });
    expect(result.current).toBe(true);

    // Backgrounded with Home focused; the admin switches the tier off; back after the recheck age.
    act(() => handlers.forEach((handler) => handler('background')));
    jest.setSystemTime(Date.now() + CACHE_TTL.vehicleTypesRecheck + 1000);
    act(() => handlers.forEach((handler) => handler('active')));
    await act(async () => {
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
    });
    expect(result.current).toBe(false);
    expect(mock.history.get.filter((r) => r.url === '/public/vehicle-types')).toHaveLength(2);
  });
});
