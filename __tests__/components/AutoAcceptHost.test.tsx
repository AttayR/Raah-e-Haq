/**
 * T-587: the request host reports offer views (once the card has been on screen 1 s) and
 * declines, and shows "Ride accepted for you" when a ride is accepted for the driver
 * (auto-accept), never for the driver's own Accept.
 */
import React from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from '../../src/store/rootReducer';
import { RideRequestHost } from '../../src/components/driver/RideRequestHost';
import { AUTO_ACCEPTED_ADVANCE_MS } from '../../src/components/driver/AutoAcceptedCard';
import { driverRequestsApi } from '../../src/features/driver-requests/api';
import { PENDING_POLL_INTERVAL_MS } from '../../src/features/driver-requests/hooks';
import { driverStatusApi, type DriverAvailability } from '../../src/features/driver-status/api';
import { loadDriverStatus } from '../../src/features/driver-status/slice';
import { setDriverActiveRide } from '../../src/features/driver-ride/slice';
import { autoAcceptApi } from '../../src/features/driver-auto-accept/api';
import { loadAutoAccept } from '../../src/features/driver-auto-accept/slice';
import { OFFER_VIEWED_DELAY_MS, __resetOfferReportsForTests } from '../../src/features/driver-auto-accept/offerReports';
import locationTrackingService, { type LocationFix } from '../../src/services/locationTrackingService';
import { makePendingRequest } from '../../test-utils/driverRequestFixtures';
import { makeRide } from '../../test-utils/rideFixtures';
import { makeAutoAcceptSettings } from '../../test-utils/autoAcceptFixtures';

const mockNavigate = jest.fn();
let mockIsFocused = true;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
  useIsFocused: () => mockIsFocused,
}));

const FIX: LocationFix = { latitude: 31.5, longitude: 74.3, heading: null, speed: null, accuracy: 5, timestamp: 0 };

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

const statusInfo = (status: DriverAvailability, activeRideId: number | null = null) => ({
  status,
  activeRideId,
  changedAt: null,
});

const setAppState = (value: string) => {
  Object.defineProperty(AppState, 'currentState', { value, configurable: true, writable: true });
};

let viewed: jest.SpyInstance;
let declined: jest.SpyInstance;

const renderHost = async ({ autoAcceptOn = false } = {}) => {
  const store = configureStore({ reducer: rootReducer });
  jest.spyOn(driverStatusApi, 'get').mockResolvedValue(statusInfo('available'));
  await store.dispatch(loadDriverStatus());
  jest
    .spyOn(autoAcceptApi, 'get')
    .mockResolvedValue(makeAutoAcceptSettings({ enabled: autoAcceptOn, min_fare: autoAcceptOn ? 200 : null }));
  await store.dispatch(loadAutoAccept());
  const ui = () => (
    <Provider store={store}>
      <RideRequestHost bottomOffset={49} />
    </Provider>
  );
  const screen = render(ui());
  await flush();
  return { store, screen, rerender: () => screen.rerender(ui()) };
};

beforeEach(() => {
  jest.useFakeTimers();
  __resetOfferReportsForTests();
  mockIsFocused = true;
  mockNavigate.mockReset();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  setAppState('active');
  jest.spyOn(locationTrackingService, 'getLastLocation').mockReturnValue(FIX);
  jest.spyOn(driverRequestsApi, 'listPending').mockResolvedValue({ requests: [makePendingRequest({ id: 7 })] });
  viewed = jest.spyOn(autoAcceptApi, 'offerViewed').mockResolvedValue();
  declined = jest.spyOn(autoAcceptApi, 'offerDeclined').mockResolvedValue();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('offer reporting', () => {
  it('reports offer-viewed once, after the card has been on screen for 1 s', async () => {
    const { screen } = await renderHost();
    screen.getByTestId('incoming-request-card');
    await advance(OFFER_VIEWED_DELAY_MS - 1);
    expect(viewed).not.toHaveBeenCalled();
    await advance(1);
    expect(viewed).toHaveBeenCalledWith(7);
    // Later polls list the same request: no second report.
    await advance(PENDING_POLL_INTERVAL_MS * 3);
    expect(viewed).toHaveBeenCalledTimes(1);
  });

  it('does not report a view while the app is not active (lock screen, Control Centre)', async () => {
    setAppState('inactive');
    await renderHost();
    await advance(OFFER_VIEWED_DELAY_MS * 2);
    expect(viewed).not.toHaveBeenCalled();
  });

  it('reports offer-declined when the driver turns the request down', async () => {
    const { screen } = await renderHost();
    fireEvent.press(screen.getByTestId('incoming-request-reject'));
    await flush();
    expect(declined).toHaveBeenCalledWith(7);
    expect(screen.queryByTestId('incoming-request-card')).toBeNull();
  });
});

describe('Ride accepted for you', () => {
  const assign = async (store: ReturnType<typeof configureStore>, rideId: number) => {
    jest.spyOn(driverStatusApi, 'get').mockResolvedValue(statusInfo('on_ride', rideId));
    await act(async () => {
      await store.dispatch(loadDriverStatus() as never);
    });
    act(() => {
      store.dispatch(setDriverActiveRide(makeRide({ id: rideId, status: 'accepted', dropoff_address: 'Fake Dropoff Area' })));
    });
    await flush();
  };

  it('takes over when a ride is assigned while online with auto-accept on, then moves on after 5 s', async () => {
    const { store, screen } = await renderHost({ autoAcceptOn: true });
    await assign(store, 55);

    screen.getByTestId('auto-accepted-card');
    screen.getByText('Ride accepted for you');
    // SEC-33 item 9: the drop-off area is shown.
    screen.getByText('Fake Dropoff Area');
    expect(screen.queryByTestId('incoming-request-accept')).toBeNull();

    await advance(AUTO_ACCEPTED_ADVANCE_MS);
    expect(mockNavigate).toHaveBeenCalledWith('DriverRide');
    expect(store.getState().driverAutoAccept.takeoverRideId).toBeNull();
  });

  it('"Go to pickup" opens the trip at once', async () => {
    const { store, screen } = await renderHost({ autoAcceptOn: true });
    await assign(store, 56);
    fireEvent.press(screen.getByTestId('auto-accepted-go'));
    expect(mockNavigate).toHaveBeenCalledWith('DriverRide');
    expect(screen.queryByTestId('auto-accepted-card')).toBeNull();
  });

  it('is over once the tabs lose focus: it does not come back on return, nor navigate again', async () => {
    const { store, screen, rerender } = await renderHost({ autoAcceptOn: true });
    await assign(store, 58);
    screen.getByTestId('auto-accepted-card');

    mockIsFocused = false;
    rerender();
    await flush();
    expect(store.getState().driverAutoAccept.takeoverRideId).toBeNull();
    mockIsFocused = true;
    rerender();
    await flush();
    expect(screen.queryByTestId('auto-accepted-card')).toBeNull();
    await advance(AUTO_ACCEPTED_ADVANCE_MS * 2);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('raised under a stack screen (tabs not focused): waits, then shows when the tabs are back', async () => {
    const { store, screen, rerender } = await renderHost({ autoAcceptOn: true });
    mockIsFocused = false;
    rerender();
    await flush();
    await assign(store, 62);
    expect(screen.queryByTestId('auto-accepted-card')).toBeNull();
    expect(store.getState().driverAutoAccept.takeoverRideId).toBe(62);

    mockIsFocused = true;
    rerender();
    await flush();
    screen.getByTestId('auto-accepted-card');
    await advance(AUTO_ACCEPTED_ADVANCE_MS);
    expect(mockNavigate).toHaveBeenCalledWith('DriverRide');
  });

  it('with a screen reader on it waits for "Go to pickup" (no auto-advance)', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    const { store, screen } = await renderHost({ autoAcceptOn: true });
    await assign(store, 63);
    screen.getByTestId('auto-accepted-card');
    await advance(AUTO_ACCEPTED_ADVANCE_MS * 3);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('auto-accepted-auto-hint')).toBeNull();
    fireEvent.press(screen.getByTestId('auto-accepted-go'));
    expect(mockNavigate).toHaveBeenCalledWith('DriverRide');
  });

  it('is not shown once the ride has moved past accepted', async () => {
    const { store, screen } = await renderHost({ autoAcceptOn: true });
    await assign(store, 59);
    act(() => {
      store.dispatch(setDriverActiveRide(makeRide({ id: 59, status: 'arrived' })));
    });
    await flush();
    expect(screen.queryByTestId('auto-accepted-card')).toBeNull();
    expect(store.getState().driverAutoAccept.takeoverRideId).toBeNull();
  });

  it('is not shown while auto-accept is paused by a location check', async () => {
    const store = configureStore({ reducer: rootReducer });
    jest.spyOn(driverStatusApi, 'get').mockResolvedValue(statusInfo('available'));
    await store.dispatch(loadDriverStatus());
    jest.spyOn(autoAcceptApi, 'get').mockResolvedValue(makeAutoAcceptSettings({ enabled: true, min_fare: 200, paused: true }));
    await store.dispatch(loadAutoAccept());
    const screen = render(
      <Provider store={store}>
        <RideRequestHost bottomOffset={49} />
      </Provider>,
    );
    await flush();
    await assign(store, 60);
    expect(screen.queryByTestId('auto-accepted-card')).toBeNull();
  });

  it('never shows for the driver own Accept, nor with auto-accept off', async () => {
    jest.spyOn(driverRequestsApi, 'accept').mockResolvedValue(makeRide({ id: 7, status: 'accepted' }));
    const own = await renderHost({ autoAcceptOn: true });
    fireEvent.press(own.screen.getByTestId('incoming-request-accept'));
    await flush();
    expect(own.screen.queryByTestId('auto-accepted-card')).toBeNull();
    own.screen.unmount();

    const off = await renderHost({ autoAcceptOn: false });
    await assign(off.store, 57);
    expect(off.screen.queryByTestId('auto-accepted-card')).toBeNull();
  });
});
