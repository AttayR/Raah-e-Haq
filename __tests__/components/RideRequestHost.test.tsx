/**
 * T-408: ride requests arrive on every driver tab. The host is mounted once by DriverBottomTabs
 * (the single GET /rides/pending poller). UI-R4: a request reports itself through
 * `onRequestShownChange` (the tabs switch to Drive and hide the tab bar); loading and "no
 * requests" are left to the Drive sheet.
 */
import React from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ApiError } from '../../src/core/api/errors';
import { rootReducer } from '../../src/store/rootReducer';
import { RideRequestHost } from '../../src/components/driver/RideRequestHost';
import { driverRequestsApi } from '../../src/features/driver-requests/api';
import { PENDING_POLL_INTERVAL_MS } from '../../src/features/driver-requests/hooks';
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

const statusInfo = (status: DriverAvailability) => ({ status, activeRideId: null, changedAt: null });

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
      <RideRequestHost bottomOffset={49} onRequestShownChange={onRequestShownChange} />
    </Provider>,
  );
  await flush();
  return { store, screen };
};

beforeEach(() => {
  jest.useFakeTimers();
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
    expect(listPending).toHaveBeenLastCalledWith({ latitude: 31.5, longitude: 74.3 });
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

  it('an error card is not a request: the tab bar stays', async () => {
    listPending.mockRejectedValue(new ApiError({ kind: 'server', status: 500, message: 'Server error' }));
    const shown = jest.fn();
    const { screen } = await renderHost('available', shown);
    screen.getByTestId('ride-requests-error');
    expect(shown).not.toHaveBeenCalledWith(true);
  });

  it('does not poll while the tabs are covered by another driver screen', async () => {
    mockIsFocused = false;
    const { screen } = await renderHost('available');
    await advance(PENDING_POLL_INTERVAL_MS * 2);
    expect(listPending).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ride-request-host')).toBeNull();
  });
});

describe('RideRequestHost layout', () => {
  it('lets touches outside the card through to the screen below', async () => {
    const { screen } = await renderHost('available');
    expect(screen.getByTestId('ride-request-host').props.pointerEvents).toBe('box-none');
  });

  it('applies the offset to the panel position', async () => {
    const store = configureStore({ reducer: rootReducer });
    jest.spyOn(driverStatusApi, 'get').mockResolvedValue(statusInfo('available'));
    await store.dispatch(loadDriverStatus());
    const screen = render(
      <Provider store={store}>
        <RideRequestHost bottomOffset={34} />
      </Provider>,
    );
    await flush();
    const style = Object.assign({}, ...[screen.getByTestId('ride-request-host').props.style].flat());
    // The home-indicator inset (tab bar hidden) + space[4] (16).
    expect(style.bottom).toBe(34 + 16);
  });
});

describe('RideRequestHost error before the first fix', () => {
  const locationRequired = () =>
    new ApiError({ kind: 'validation', status: 422, code: 'LOCATION_REQUIRED', message: 'Location required' });

  it('waits for a second failure in a row when there is no fix yet', async () => {
    jest.spyOn(locationTrackingService, 'getLastLocation').mockReturnValue(null);
    listPending.mockRejectedValue(locationRequired());
    const { screen } = await renderHost('available');
    expect(listPending).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('ride-requests-error')).toBeNull();

    await advance(PENDING_POLL_INTERVAL_MS);
    expect(listPending).toHaveBeenCalledTimes(2);
    screen.getByTestId('ride-requests-error');
  });

  it('a good poll after the first failure shows the request and never the error', async () => {
    jest.spyOn(locationTrackingService, 'getLastLocation').mockReturnValue(null);
    listPending.mockRejectedValueOnce(locationRequired());
    const { screen } = await renderHost('available');
    expect(screen.queryByTestId('ride-requests-error')).toBeNull();

    await advance(PENDING_POLL_INTERVAL_MS);
    screen.getByTestId('incoming-request-card');
  });

  it('once there is a fix, the error shows at once', async () => {
    listPending.mockRejectedValue(locationRequired());
    const withFix = await renderHost('available');
    withFix.screen.getByTestId('ride-requests-error');
  });
});

describe('useDriverLastLocation (through the host)', () => {
  it('follows the tracker listener and removes it on unmount', async () => {
    const unsubscribe = jest.fn();
    let listener: ((fix: LocationFix) => void) | undefined;
    jest.spyOn(locationTrackingService, 'getLastLocation').mockReturnValue(null);
    jest.spyOn(locationTrackingService, 'addLocationListener').mockImplementation((fn) => {
      listener = fn;
      return unsubscribe;
    });
    const { screen } = await renderHost('available');
    expect(listPending).toHaveBeenLastCalledWith(null);

    act(() => listener?.({ ...FIX, latitude: 31.6 }));
    await advance(PENDING_POLL_INTERVAL_MS);
    expect(listPending).toHaveBeenLastCalledWith({ latitude: 31.6, longitude: 74.3 });

    screen.unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
