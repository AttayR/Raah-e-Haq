/**
 * T-535 (PERF-14): passenger Home unmounts its Google Map while the Booking map is pushed over
 * it (one live map at a time) and shows it again, with the rider's marker, when it is back.
 */
import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Provider } from 'react-redux';
import MockAdapter from 'axios-mock-adapter';
import { act, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import { apiClient } from '../../src/services/api';
import PassengerHomeScreen from '../../src/screens/Passenger/PassengerHomeScreen';
import { MAP_RELEASE_DELAY_MS } from '../../src/hooks/useMapMounted';
import { __resetNearbyDriversThrottleForTests } from '../../src/hooks/useNearbyDrivers';
import { envelope, makeStore, page } from '../../test-utils/rideFixtures';

type Listener = () => void;
let mockFocused = true;
let mockStackRoutes: Array<{ name: string }> = [{ name: 'PassengerTabs' }];
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

jest.mock('../../src/hooks/useNativeLocation', () => ({
  useNativeLocation: () => ({
    currentLocation: { latitude: 31.5204, longitude: 74.3587 },
    isLoading: false,
    error: null,
    permissionStatus: { isGranted: true, canAskAgain: false, isLocationEnabled: true },
    requestLocationPermission: jest.fn(),
    refreshLocation: jest.fn(),
    getCurrentLocation: jest.fn(),
    openSettings: jest.fn(),
  }),
}));

const flush = async () => {
  await act(async () => {
    await new Promise<void>(resolve => setTimeout(() => resolve(), 20));
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
};

const ui = (store: ReturnType<typeof makeStore>) => (
  <Provider store={store}>
    <ThemeProvider>
      <PassengerHomeScreen />
    </ThemeProvider>
  </Provider>
);

/** A push or pop on the passenger stack, as the navigator reports it. */
const setStack = (names: string[]) => {
  mockStackRoutes = names.map(name => ({ name }));
  mockFocused = names.length === 1;
  mockStateListeners.forEach(fn => fn());
};

let mock: MockAdapter;

beforeEach(() => {
  mockFocused = true;
  mockStackRoutes = [{ name: 'PassengerTabs' }];
  mockStateListeners = [];
  (AppState as { currentState: AppStateStatus }).currentState = 'active';
  __resetNearbyDriversThrottleForTests();
  mock = new MockAdapter(apiClient);
  mock.onGet('/rides').reply(200, page([]));
  mock.onGet('/rides/nearby-drivers').reply(200, envelope([]));
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('passenger Home map while Booking is open (T-535)', () => {
  it('unmounts the Home map under Booking and mounts it again on return', async () => {
    const store = makeStore();
    const view = render(ui(store));
    await flush();
    expect(screen.getByTestId('home-user-marker')).toBeTruthy();
    expect(screen.queryByTestId('home-map-released')).toBeNull();

    await act(async () => {
      setStack(['PassengerTabs', 'Booking']);
    });
    view.rerender(ui(store));
    await act(async () => {
      await new Promise<void>(resolve => setTimeout(() => resolve(), MAP_RELEASE_DELAY_MS + 50));
    });
    expect(screen.getByTestId('home-map-released')).toBeTruthy();
    expect(screen.queryByTestId('home-user-marker')).toBeNull();

    await act(async () => {
      setStack(['PassengerTabs']);
    });
    view.rerender(ui(store));
    await flush();
    expect(screen.queryByTestId('home-map-released')).toBeNull();
    expect(screen.getByTestId('home-user-marker')).toBeTruthy();
  });

  it('keeps the map under a screen without one (Profile)', async () => {
    const store = makeStore();
    const view = render(ui(store));
    await flush();
    await act(async () => {
      setStack(['PassengerTabs', 'Profile']);
    });
    view.rerender(ui(store));
    await act(async () => {
      await new Promise<void>(resolve => setTimeout(() => resolve(), MAP_RELEASE_DELAY_MS + 50));
    });
    expect(screen.queryByTestId('home-map-released')).toBeNull();
    expect(screen.getByTestId('home-user-marker')).toBeTruthy();
  });
});
