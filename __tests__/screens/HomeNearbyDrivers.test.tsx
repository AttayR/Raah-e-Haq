/**
 * T-524 (QA t-517 c2/c3, passenger-home spec map item 2): passenger Home shows the nearby
 * drivers (GET /rides/nearby-drivers, BE-20) around the rider as vehicle markers, turned to the
 * BE-76 heading, and only asks while Home is focused. T-586: the count chip and overlap spread.
 */
import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Provider } from 'react-redux';
import MockAdapter from 'axios-mock-adapter';
import { act, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import { apiClient } from '../../src/services/api';
import PassengerHomeScreen from '../../src/screens/Passenger/PassengerHomeScreen';
import { __resetNearbyDriversThrottleForTests } from '../../src/hooks/useNearbyDrivers';
import { envelope, makeStore, page } from '../../test-utils/rideFixtures';

let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
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

/** Lets the first poll (scheduled with a 0 ms timer) and its response land. */
const flush = async () => {
  await act(async () => {
    await new Promise<void>(resolve => setTimeout(() => resolve(), 20));
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
};

const renderHome = async () => {
  render(
    <Provider store={makeStore()}>
      <ThemeProvider>
        <PassengerHomeScreen />
      </ThemeProvider>
    </Provider>,
  );
  await flush();
};

const nearby = (id: string, heading: number | null, vehicle_type = 'car') => ({
  id,
  vehicle_type,
  distance_km: 1.2,
  estimated_arrival_min: 3,
  location: { latitude: 31.522, longitude: 74.356 },
  heading,
});

let mock: MockAdapter;

beforeEach(() => {
  mockFocused = true;
  // Foreground (the jest preset leaves AppState.currentState unset).
  (AppState as { currentState: AppStateStatus }).currentState = 'active';
  __resetNearbyDriversThrottleForTests();
  mock = new MockAdapter(apiClient);
  mock.onGet('/rides').reply(200, page([]));
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('passenger Home nearby drivers (T-524)', () => {
  it('shows each nearby driver as a vehicle marker around the rider, rotated to its heading', async () => {
    mock.onGet('/rides/nearby-drivers').reply(200, envelope([nearby('a1', 90), nearby('b2', null, 'bike')]));
    await renderHome();
    const request = mock.history.get.find(r => r.url === '/rides/nearby-drivers');
    expect(request?.params).toMatchObject({ latitude: 31.52, longitude: 74.359 });
    expect(screen.getByTestId('nearby-driver-a1').props.rotation).toBe(90);
    expect(screen.getByTestId('nearby-driver-a1').props.zIndex).toBe(0);
    // No heading: north for a new marker.
    expect(screen.getByTestId('nearby-driver-b2').props.rotation).toBe(0);
    // T-586 §4: the count chip on the map (no BE-116 counts yet: the list's length).
    expect(screen.getByText('2 drivers online near you')).toBeTruthy();
  });

  it('T-586: both vehicles on one grid point are spread apart, so the map shows the two the chip counts', async () => {
    mock.onGet('/rides/nearby-drivers').reply(200, envelope([nearby('a1', 90), nearby('b2', null, 'bike')]));
    await renderHome();
    const a = screen.getByTestId('nearby-driver-a1').props.coordinate;
    const b = screen.getByTestId('nearby-driver-b2').props.coordinate;
    expect(a).not.toEqual(b);
  });

  it('T-586: prefers the server count when BE-116 sends it', async () => {
    mock.onGet('/rides/nearby-drivers').reply(200, { ...envelope([nearby('a1', 90)]), counts: { by_tier: { car: 1 }, online_total: 23 } });
    await renderHome();
    expect(screen.getByText('23 drivers online near you')).toBeTruthy();
  });

  it('does not ask while Home is covered by another screen', async () => {
    mockFocused = false;
    mock.onGet('/rides/nearby-drivers').reply(200, envelope([nearby('a1', 90)]));
    await renderHome();
    expect(mock.history.get.some(r => r.url === '/rides/nearby-drivers')).toBe(false);
    expect(screen.queryByTestId('nearby-driver-a1')).toBeNull();
  });
});
