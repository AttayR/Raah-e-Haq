/**
 * T-535 (PERF-14): the driver's Drive map is unmounted while the DriverRide trip map is pushed
 * over it (one live Google Map at a time), without touching the shared GPS watcher, and comes
 * back with the driver's marker when the driver returns.
 */
import React from 'react';
import { AppState } from 'react-native';
import { act, render } from '@testing-library/react-native';
import type { FollowCamera } from '../../src/hooks/useFollowCamera';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import Geolocation from '@react-native-community/geolocation';
import { rootReducer } from '../../src/store/rootReducer';
import { driverStatusApi } from '../../src/features/driver-status/api';
import locationTrackingService from '../../src/services/locationTrackingService';
import { statsApi } from '../../src/features/stats/api';
import DriverDriveScreen from '../../src/screens/Driver/DriverDriveScreen';
import { MAP_RELEASE_DELAY_MS } from '../../src/hooks/useMapMounted';

type Listener = () => void;
let mockFocused = true;
let mockStackRoutes: Array<{ name: string }> = [{ name: 'DriverTabs' }];
let mockStateListeners: Listener[] = [];
const mockParent = {
  getState: () => ({ routes: mockStackRoutes }),
  addListener: (_type: 'state', cb: Listener) => {
    mockStateListeners.push(cb);
    return () => {
      mockStateListeners = mockStateListeners.filter(fn => fn !== cb);
    };
  },
};
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), getParent: () => mockParent }),
  useIsFocused: () => mockFocused,
}));

// The real follow camera, with its last result kept so the test can pan and read `following`.
let mockFollow: FollowCamera | null = null;
jest.mock('../../src/hooks/useFollowCamera', () => {
  const actual = jest.requireActual('../../src/hooks/useFollowCamera');
  return {
    ...actual,
    useFollowCamera: (...args: Parameters<typeof actual.useFollowCamera>) => {
      mockFollow = actual.useFollowCamera(...args);
      return mockFollow;
    },
  };
});

const geo = Geolocation as jest.Mocked<typeof Geolocation>;
type PositionCallback = (position: { coords: Record<string, number>; timestamp: number }) => void;

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
};
const wait = async (ms: number) => {
  await act(async () => {
    await new Promise<void>(resolve => setTimeout(() => resolve(), ms));
  });
};
/** A push or pop on the driver stack, as the navigator reports it. */
const setStack = (names: string[]) => {
  mockStackRoutes = names.map(name => ({ name }));
  mockFocused = names.length === 1;
  mockStateListeners.forEach(fn => fn());
};

beforeEach(() => {
  mockFocused = true;
  mockStackRoutes = [{ name: 'DriverTabs' }];
  mockStateListeners = [];
  geo.watchPosition.mockReset();
  geo.watchPosition.mockImplementation(() => 1);
  geo.clearWatch.mockClear();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  jest.spyOn(statsApi, 'getMyStats').mockRejectedValue(new Error('not in this test'));
  jest.spyOn(driverStatusApi, 'get').mockResolvedValue({ status: 'offline', activeRideId: null, changedAt: null });
});

afterEach(() => {
  locationTrackingService.reset();
  jest.restoreAllMocks();
});

it('unmounts the Drive map under DriverRide and mounts it again on return; the GPS watch stays', async () => {
  const store = configureStore({ reducer: rootReducer });
  const ui = (
    <Provider store={store}>
      <DriverDriveScreen />
    </Provider>
  );
  const screen = render(ui);
  await flush();
  const onPosition = geo.watchPosition.mock.calls[0][0] as unknown as PositionCallback;
  await act(async () => {
    onPosition({ coords: { latitude: 31.52, longitude: 74.35 }, timestamp: Date.now() });
  });
  expect(screen.getByTestId('drive-driver-marker')).toBeTruthy();
  // The driver pans the map: following stops.
  await act(async () => {
    mockFollow?.onRegionChangeComplete(
      { latitude: 31.6, longitude: 74.4, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      { isGesture: true },
    );
  });
  expect(mockFollow?.following).toBe(false);

  await act(async () => {
    setStack(['DriverTabs', 'DriverRide']);
  });
  screen.rerender(ui);
  await wait(MAP_RELEASE_DELAY_MS + 50);
  expect(screen.getByTestId('drive-map-released')).toBeTruthy();
  expect(screen.queryByTestId('drive-driver-marker')).toBeNull();
  expect(geo.clearWatch).not.toHaveBeenCalled();

  await act(async () => {
    setStack(['DriverTabs']);
  });
  screen.rerender(ui);
  await flush();
  expect(screen.queryByTestId('drive-map-released')).toBeNull();
  expect(screen.getByTestId('drive-driver-marker')).toBeTruthy();
  // The remounted map follows the driver again.
  expect(mockFollow?.following).toBe(true);
  screen.unmount();
});
