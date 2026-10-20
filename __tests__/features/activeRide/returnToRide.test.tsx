/**
 * T-543 (QA X1/X2): the passenger can always get back into a live ride. Home's sheet shows
 * "Return to your ride" (with the ride's status) instead of "Where to?" while a ride is in
 * progress, and a ride in progress opened from Activity goes to the live ride screen (Booking),
 * not the static details; finished rides, and every driver ride, still open the details.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { Provider } from 'react-redux';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { apiClient } from '../../../src/services/api';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { HomeSheetBody } from '../../../src/features/passenger-home/components/HomeSheet';
import { useOpenRide } from '../../../src/features/active-ride/useOpenRide';
import { liveRideStatusText } from '../../../src/features/active-ride/status';
import { createActiveRide } from '../../../src/features/active-ride/slice';
import { toRide } from '../../../src/features/ride-history/api';
import type { Ride } from '../../../src/features/ride-history/types';
import rideService from '../../../src/services/rideService';
import { makeRide, makeRideRequest, makeStore, page, type TestStore } from '../../../test-utils/rideFixtures';
import { homeBodyProps } from '../../../test-utils/homeFixtures';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mockNavigate.mockClear();
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

const historyRide = (status: string, id = 41): Ride => toRide({ ...makeRide({ id }), status })!;

const withStore = (store: TestStore) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };

/** A store whose active ride is `ride` (as after booking it here). */
const storeWithActiveRide = async (status: 'requested' | 'accepted' | 'ongoing', id = 41) => {
  const store = makeStore();
  jest.spyOn(rideService, 'createRide').mockResolvedValueOnce(makeRide({ id, status }));
  await store.dispatch(createActiveRide(makeRideRequest()));
  return store;
};

describe('Home: Return to your ride', () => {
  // UI-R20b: "Where to?" moved to the pinned header (HomeSheetTop); the body carries "Return".
  const body = (liveRide: { status: string } | null, onReturnToRide = jest.fn()) => (
    <ThemeProvider>
      <HomeSheetBody {...homeBodyProps({ liveRide, onReturnToRide })} />
    </ThemeProvider>
  );

  /** The theme provider reads the stored appearance first. */
  const settle = () =>
    act(async () => {
      for (let i = 0; i < 5; i += 1) await Promise.resolve();
    });

  it('a ride in progress replaces "Where to?" with "Return to your ride" and its status', async () => {
    const onReturn = jest.fn();
    render(body({ status: liveRideStatusText('accepted') }, onReturn));
    await settle();
    expect(screen.queryByText('Where to?')).toBeNull();
    fireEvent.press(screen.getByTestId('home-return-to-ride'));
    expect(onReturn).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('home-live-ride-status')).toHaveTextContent('Driver is on the way');
  });

  it('no ride: no "Return" block (the header shows "Where to?")', async () => {
    render(body(null));
    await settle();
    expect(screen.queryByTestId('home-return-to-ride')).toBeNull();
    expect(screen.queryByTestId('home-live-ride')).toBeNull();
  });

  it('the status line follows the ride', () => {
    expect(liveRideStatusText('requested')).toBe('Finding you a driver…');
    expect(liveRideStatusText('arrived')).toBe('Your driver is here');
    expect(liveRideStatusText('ongoing')).toBe('Trip in progress');
  });
});

describe('Activity: opening a ride (useOpenRide)', () => {
  it('a passenger ride in progress opens the live ride screen', async () => {
    const store = await storeWithActiveRide('accepted');
    const { result } = renderHook(() => useOpenRide('passenger'), { wrapper: withStore(store) });

    await act(() => result.current(41, historyRide('accepted')));

    expect(mockNavigate).toHaveBeenCalledWith('Booking');
  });

  it('a finished ride opens its details', async () => {
    const store = makeStore();
    const ride = historyRide('completed', 12);
    const { result } = renderHook(() => useOpenRide('passenger'), { wrapper: withStore(store) });

    await act(() => result.current(12, ride));

    expect(mockNavigate).toHaveBeenCalledWith('RideDetails', { rideId: 12, ride });
  });

  it('a driver ride always opens its details', async () => {
    const store = makeStore();
    const ride = historyRide('accepted', 12);
    const { result } = renderHook(() => useOpenRide('driver'), { wrapper: withStore(store) });

    await act(() => result.current(12, ride));

    expect(mockNavigate).toHaveBeenCalledWith('RideDetails', { rideId: 12, ride });
  });

  it('not in the store yet: asks the server for the active ride, then opens it live', async () => {
    mock.onGet('/rides').reply(200, page([makeRide({ id: 55, status: 'ongoing' })]));
    const store = makeStore();
    const { result } = renderHook(() => useOpenRide('passenger'), { wrapper: withStore(store) });

    await act(() => result.current(55, historyRide('started', 55)));

    expect(store.getState().activeRide.ride?.id).toBe(55);
    expect(mockNavigate).toHaveBeenCalledWith('Booking');
  });

  it('the server says it is over after all: the details open', async () => {
    mock.onGet('/rides').reply(200, page([]));
    const store = makeStore();
    const ride = historyRide('accepted', 56);
    const { result } = renderHook(() => useOpenRide('passenger'), { wrapper: withStore(store) });

    await act(() => result.current(56, ride));

    expect(mockNavigate).toHaveBeenCalledWith('RideDetails', { rideId: 56, ride });
  });
});
