/**
 * T-408: ride requests arrive on every driver tab. The host is mounted once by DriverBottomTabs;
 * T-708: the feed is polled by DriverRequestLayer's DriverRequestFeedPoller (rendered next to the
 * host here), and the host draws the request on the Drive tab only. UI-R4: a request reports itself through
 * `onRequestShownChange` (the tabs switch to Drive and hide the tab bar); loading and "no
 * requests" are left to the Drive sheet.
 */
import React from 'react';
import { AppState, BackHandler } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ApiError } from '../../src/core/api/errors';
import { rootReducer } from '../../src/store/rootReducer';
import { RideRequestHost } from '../../src/components/driver/RideRequestHost';
import { DriverRequestFeedPoller } from '../../src/components/driver/DriverRequestLayer';
import { driverRequestsApi } from '../../src/features/driver-requests/api';
import { PENDING_POLL_INTERVAL_MS } from '../../src/features/driver-requests/hooks';
import { REQUEST_DECISION_SECONDS } from '../../src/features/driver-requests/countdown';
import { autoAcceptApi } from '../../src/features/driver-auto-accept/api';
import { __resetOfferReportsForTests } from '../../src/features/driver-auto-accept/offerReports';
import { toast } from '../../src/core/toast';
import { driverStatusApi, type DriverAvailability } from '../../src/features/driver-status/api';
import { loadDriverStatus } from '../../src/features/driver-status/slice';
import { setDriverActiveRide } from '../../src/features/driver-ride/slice';
import locationTrackingService, { type LocationFix } from '../../src/services/locationTrackingService';
import { makePendingRequest } from '../../test-utils/driverRequestFixtures';
import { makeRide } from '../../test-utils/rideFixtures';

const mockNavigate = jest.fn();
let mockIsFocused = true;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
  useIsFocused: () => mockIsFocused,
}));

const FIX: LocationFix = {
  latitude: 31.5,
  longitude: 74.3,
  heading: null,
  speed: null,
  accuracy: 5,
  timestamp: 0,
};

const statusInfo = (status: DriverAvailability) => ({
  status,
  activeRideId: null,
  changedAt: null,
});

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
  });
};

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
};

let listPending: jest.SpyInstance;

const renderHost = async (status: DriverAvailability, onRequestShownChange?: (shown: boolean) => void) => {
  const store = configureStore({ reducer: rootReducer });
  jest.spyOn(driverStatusApi, 'get').mockResolvedValue(statusInfo(status));
  await store.dispatch(loadDriverStatus());
  const screen = render(
    <Provider store={store}>
      <DriverRequestFeedPoller />
      <RideRequestHost onRequestShownChange={onRequestShownChange} />
    </Provider>,
  );
  await flush();
  return { store, screen };
};

beforeEach(() => {
  jest.useFakeTimers();
  __resetOfferReportsForTests();
  mockIsFocused = true;
  mockNavigate.mockReset();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  jest.spyOn(locationTrackingService, 'getLastLocation').mockReturnValue(FIX);
  listPending = jest.spyOn(driverRequestsApi, 'listPending').mockResolvedValue({
    requests: [makePendingRequest({ id: 7 })],
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('RideRequestHost', () => {
  it('polls while online on any tab and shows the request card, with the tracker position', async () => {
    const { screen } = await renderHost('available');
    expect(listPending).toHaveBeenCalledTimes(1);
    expect(listPending).toHaveBeenLastCalledWith({
      latitude: 31.5,
      longitude: 74.3,
    });
    screen.getByTestId('incoming-request-card');

    await advance(PENDING_POLL_INTERVAL_MS);
    expect(listPending).toHaveBeenCalledTimes(2);
  });

  it('does nothing while offline', async () => {
    const { screen } = await renderHost('offline');
    await advance(PENDING_POLL_INTERVAL_MS * 3);
    expect(listPending).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ride-request-host')).toBeNull();
  });

  it('stops and hides once the driver has an accepted ride', async () => {
    const { store, screen } = await renderHost('available');
    expect(listPending).toHaveBeenCalledTimes(1);

    act(() => {
      store.dispatch(setDriverActiveRide(makeRide({ id: 41, status: 'accepted' })));
    });
    await advance(PENDING_POLL_INTERVAL_MS * 3);
    expect(listPending).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('ride-request-host')).toBeNull();
  });

  it('stops polling on unmount', async () => {
    const { screen } = await renderHost('available');
    screen.unmount();
    await advance(PENDING_POLL_INTERVAL_MS * 3);
    expect(listPending).toHaveBeenCalledTimes(1);
  });

  it('accepting opens the DriverRide screen', async () => {
    jest.spyOn(driverRequestsApi, 'accept').mockResolvedValue(makeRide({ id: 7, status: 'accepted' }));
    const { screen } = await renderHost('available');

    fireEvent.press(screen.getByTestId('incoming-request-accept'));
    await flush();
    expect(driverRequestsApi.accept).toHaveBeenCalledWith(7);
    expect(mockNavigate).toHaveBeenCalledWith('DriverRide');
  });

  it('shows no card while there are no requests (the Drive sheet says it is looking)', async () => {
    listPending.mockResolvedValue({ requests: [] });
    const { screen } = await renderHost('available');
    expect(screen.queryByTestId('ride-request-host')).toBeNull();
    expect(screen.queryByTestId('ride-requests-empty')).toBeNull();
  });

  it('reports a shown request so the tabs hide the tab bar, and its end so they bring it back (UI-R4)', async () => {
    const shown = jest.fn();
    const { store } = await renderHost('available', shown);
    expect(shown).toHaveBeenLastCalledWith(true);

    act(() => {
      store.dispatch(setDriverActiveRide(makeRide({ id: 7, status: 'accepted' })));
    });
    await flush();
    expect(shown).toHaveBeenLastCalledWith(false);
  });

  it('a feed error draws no card here (the Drive subtitle says it) and the tab bar stays', async () => {
    listPending.mockRejectedValue(new ApiError({ kind: 'server', status: 500, message: 'Server error' }));
    const shown = jest.fn();
    const { screen } = await renderHost('available', shown);
    expect(screen.queryByTestId('ride-request-host')).toBeNull();
    expect(shown).not.toHaveBeenCalledWith(true);
  });

  it('draws nothing while the tabs are covered by another driver screen (the banner shows it, T-708)', async () => {
    mockIsFocused = false;
    const { screen } = await renderHost('available');
    await advance(PENDING_POLL_INTERVAL_MS * 2);
    expect(screen.queryByTestId('ride-request-host')).toBeNull();
  });

  it('T-708: off the Drive tab it draws no sheet, never switches tabs, and does not run the clock', async () => {
    const declined = jest.spyOn(autoAcceptApi, 'offerDeclined').mockResolvedValue();
    const store = configureStore({ reducer: rootReducer });
    jest.spyOn(driverStatusApi, 'get').mockResolvedValue(statusInfo('available'));
    await store.dispatch(loadDriverStatus());
    const shown = jest.fn();
    const screen = render(
      <Provider store={store}>
        <DriverRequestFeedPoller />
        <RideRequestHost onDriveTab={false} onRequestShownChange={shown} />
      </Provider>,
    );
    await flush();
    expect(store.getState().driverRequests.items.map(item => item.id)).toEqual([7]);
    expect(screen.queryByTestId('ride-request-host')).toBeNull();
    expect(shown).not.toHaveBeenCalledWith(true);
    await advance(REQUEST_DECISION_SECONDS * 1000 + 1_000);
    expect(declined).not.toHaveBeenCalled();
  });
});

describe('RideRequestHost request sheet (UI-R11)', () => {
  it('lets touches outside the sheet through to the map below', async () => {
    const { screen } = await renderHost('available');
    expect(screen.getByTestId('ride-request-host').props.pointerEvents).toBe('box-none');
    screen.getByTestId('ride-request-sheet');
  });

  it('R3: the 20 s countdown runs out as a decline (offer-declined report), and the sheet leaves', async () => {
    const declined = jest.spyOn(autoAcceptApi, 'offerDeclined').mockResolvedValue();
    jest.spyOn(autoAcceptApi, 'offerViewed').mockResolvedValue();
    const shown = jest.fn();
    const { store, screen } = await renderHost('available', shown);
    // Polls keep listing it; the device hides it once declined.
    await advance(REQUEST_DECISION_SECONDS * 1000 - 100);
    expect(declined).not.toHaveBeenCalled();
    screen.getByTestId('incoming-request-card');
    await advance(200);
    expect(declined).toHaveBeenCalledWith(7);
    expect(store.getState().driverRequests.dismissedIds).toContain(7);
    expect(screen.queryByTestId('incoming-request-card')).toBeNull();
    expect(shown).toHaveBeenLastCalledWith(false);
  });

  it('R3: the server offer window (meta.offer_seconds) wins over 20 s', async () => {
    const declined = jest.spyOn(autoAcceptApi, 'offerDeclined').mockResolvedValue();
    jest.spyOn(autoAcceptApi, 'offerViewed').mockResolvedValue();
    listPending.mockResolvedValue({
      requests: [makePendingRequest({ id: 7, offerSeconds: 12 })],
    });
    await renderHost('available');
    await advance(11_900);
    expect(declined).not.toHaveBeenCalled();
    await advance(200);
    expect(declined).toHaveBeenCalledWith(7);
  });

  it('R3: the clock pauses while accepting; a failed accept resumes it with the time left', async () => {
    const declined = jest.spyOn(autoAcceptApi, 'offerDeclined').mockResolvedValue();
    jest.spyOn(autoAcceptApi, 'offerViewed').mockResolvedValue();
    let fail: (error: unknown) => void = () => undefined;
    jest.spyOn(driverRequestsApi, 'accept').mockImplementation(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    const { screen } = await renderHost('available');
    await advance(5_000);
    fireEvent.press(screen.getByTestId('incoming-request-accept'));
    await flush();
    await advance(30_000);
    expect(declined).not.toHaveBeenCalled();
    await act(async () => {
      fail(new ApiError({ kind: 'network', message: 'Network error' }));
    });
    await flush();
    screen.getByTestId('incoming-request-card');
    await advance(14_900);
    expect(declined).not.toHaveBeenCalled();
    await advance(200);
    expect(declined).toHaveBeenCalledWith(7);
  });

  it('R5: a 409 "already accepted" swaps to "Another driver took this ride" (no toast) and leaves after 2 s', async () => {
    jest.spyOn(autoAcceptApi, 'offerViewed').mockResolvedValue();
    const error = jest.spyOn(toast, 'error');
    jest.spyOn(driverRequestsApi, 'accept').mockRejectedValue(
      new ApiError({
        kind: 'conflict',
        status: 409,
        code: 'RIDE_ALREADY_ACCEPTED',
        message: 'taken',
      }),
    );
    listPending
      .mockResolvedValueOnce({ requests: [makePendingRequest({ id: 7 })] })
      .mockResolvedValue({ requests: [] });
    const shown = jest.fn();
    const { screen } = await renderHost('available', shown);
    fireEvent.press(screen.getByTestId('incoming-request-accept'));
    await flush();
    screen.getByText('Another driver took this ride');
    expect(screen.queryByTestId('incoming-request-accept')).toBeNull();
    expect(error).not.toHaveBeenCalled();
    await advance(2_000);
    expect(screen.queryByText('Another driver took this ride')).toBeNull();
    expect(shown).toHaveBeenLastCalledWith(false);
  });

  it('R1: Android back declines the request (offer-declined report) and stays on the tab', async () => {
    const declined = jest.spyOn(autoAcceptApi, 'offerDeclined').mockResolvedValue();
    jest.spyOn(autoAcceptApi, 'offerViewed').mockResolvedValue();
    let onBack: (() => boolean | null | undefined) | undefined;
    const remove = jest.fn();
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      onBack = handler;
      return { remove };
    });
    const { store, screen } = await renderHost('available');
    screen.getByTestId('incoming-request-card');
    let handled: boolean | null | undefined;
    act(() => {
      handled = onBack?.();
    });
    expect(handled).toBe(true);
    expect(declined).toHaveBeenCalledWith(7);
    expect(store.getState().driverRequests.dismissedIds).toContain(7);
    expect(mockNavigate).not.toHaveBeenCalled();
    await flush();
    expect(screen.queryByTestId('incoming-request-card')).toBeNull();
    expect(remove).toHaveBeenCalled();
  });

  it('reports the offer on screen for the Drive map framing, and null for the taken state', async () => {
    jest.spyOn(autoAcceptApi, 'offerViewed').mockResolvedValue();
    jest
      .spyOn(driverRequestsApi, 'accept')
      .mockRejectedValue(new ApiError({ kind: 'conflict', status: 409, code: 'RIDE_ALREADY_ACCEPTED', message: 'taken' }));
    listPending.mockResolvedValue({ requests: [makePendingRequest({ id: 7 }), makePendingRequest({ id: 9 })] });
    const onShownOffer = jest.fn();
    const store = configureStore({ reducer: rootReducer });
    jest.spyOn(driverStatusApi, 'get').mockResolvedValue(statusInfo('available'));
    await store.dispatch(loadDriverStatus());
    const screen = render(
      <Provider store={store}>
        <DriverRequestFeedPoller />
        <RideRequestHost onShownOfferChange={onShownOffer} />
      </Provider>,
    );
    await flush();
    expect(onShownOffer).toHaveBeenLastCalledWith(7);
    fireEvent.press(screen.getByTestId('incoming-request-accept'));
    await flush();
    // Ride 9 is next in the queue, but the taken state frames nothing.
    screen.getByText('Another driver took this ride');
    expect(onShownOffer).toHaveBeenLastCalledWith(null);
    await advance(2_000);
    expect(onShownOffer).toHaveBeenLastCalledWith(9);
  });

  it('reports the sheet height for the Drive map framing', async () => {
    const onHeight = jest.fn();
    const store = configureStore({ reducer: rootReducer });
    jest.spyOn(driverStatusApi, 'get').mockResolvedValue(statusInfo('available'));
    await store.dispatch(loadDriverStatus());
    const screen = render(
      <Provider store={store}>
        <DriverRequestFeedPoller />
        <RideRequestHost onSheetHeightChange={onHeight} />
      </Provider>,
    );
    await flush();
    fireEvent(screen.getByTestId('ride-request-sheet'), 'layout', {
      nativeEvent: { layout: { height: 518 } },
    });
    expect(onHeight).toHaveBeenCalledWith(518);
  });
});

describe('useDriverLastLocation (through the poller and the host)', () => {
  it('follows the tracker listener and removes it on unmount', async () => {
    const unsubscribe = jest.fn();
    const listeners: ((fix: LocationFix) => void)[] = [];
    jest.spyOn(locationTrackingService, 'getLastLocation').mockReturnValue(null);
    jest.spyOn(locationTrackingService, 'addLocationListener').mockImplementation(fn => {
      listeners.push(fn);
      return unsubscribe;
    });
    const { screen } = await renderHost('available');
    expect(listPending).toHaveBeenLastCalledWith(null);

    act(() => listeners.forEach(listener => listener({ ...FIX, latitude: 31.6 })));
    await advance(PENDING_POLL_INTERVAL_MS);
    expect(listPending).toHaveBeenLastCalledWith({
      latitude: 31.6,
      longitude: 74.3,
    });

    screen.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(listeners.length);
  });
});
