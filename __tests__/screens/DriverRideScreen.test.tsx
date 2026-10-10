/**
 * T-405 (DRV-14/DRV-15): the driver ride screen walks pickup → arrived → start → stops →
 * complete on the BE-04 endpoints and shows the server's fare summary. Before, the screen was
 * not routed and start/complete sent a PUT with a client fare.
 */
import React from 'react';
import { Linking, Platform } from 'react-native';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../../src/services/api';
import { rootReducer } from '../../src/store/rootReducer';
import { selectDriverActiveRide, setDriverActiveRide } from '../../src/features/driver-ride/slice';
import type { RideResource, RideStopResource } from '../../src/services/rideService';
import DriverRideScreen from '../../src/screens/Driver/DriverRideScreen';
import { OpenRideCard } from '../../src/components/driver/OpenRideCard';
import { envelope, makeRide } from '../../test-utils/rideFixtures';

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack, canGoBack: () => true }),
}));

const stop = (overrides: Partial<RideStopResource>): RideStopResource => ({
  id: 5,
  ride_id: 41,
  address: 'Fake Stop Lane',
  latitude: 31.5,
  longitude: 74.32,
  stop_order: 1,
  status: 'active',
  status_label: 'Active',
  status_color: 'blue',
  created_at: '2026-10-09T10:00:00Z',
  updated_at: '2026-10-09T10:00:00Z',
  ...overrides,
});

const passenger = { id: 9, name: 'Ayesha', phone: '+923001234567', rating: 4.8 };

let mock: MockAdapter;

/** The server's copy of the ride for GET /rides/41 (what the mount refresh reads). */
let serverRide: RideResource;

const renderScreen = (ride: RideResource) => {
  serverRide = ride;
  mock.onGet('/rides/41').reply(() => [200, envelope(serverRide)]);
  const store = configureStore({ reducer: rootReducer });
  store.dispatch(setDriverActiveRide(ride));
  const screen = render(
    <Provider store={store}>
      <DriverRideScreen />
    </Provider>,
  );
  return { store, screen };
};

const settle = async (store: ReturnType<typeof configureStore>) =>
  waitFor(() => expect((store.getState() as ReturnType<typeof rootReducer>).driverRide.pendingAction).toBeNull());

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mockGoBack.mockReset();
  mock.onGet('/driver/status').reply(200, { success: true, data: { status: 'available', active_ride_id: null } });
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('DriverRideScreen', () => {
  it('walks pickup → arrived → start → stop → complete, posting no fare', async () => {
    const { store, screen } = renderScreen(makeRide({ status: 'accepted', passenger, stops: [stop({})] }));
    await settle(store);
    expect(screen.getByTestId('driver-ride-title').props.children).toBe('Head to pickup');
    expect(screen.getByTestId('driver-ride-passenger').props.children).toBe('Ayesha');

    mock.onPost('/rides/41/arrived').reply(200, envelope(makeRide({ status: 'arrived', passenger, stops: [stop({})] })));
    fireEvent.press(screen.getByTestId('driver-ride-arrived'));
    await waitFor(() => expect(screen.getByTestId('driver-ride-title').props.children).toBe('Waiting for the passenger'));

    mock.onPost('/rides/41/start').reply(200, envelope(makeRide({ status: 'started', passenger, stops: [stop({})] })));
    fireEvent.press(screen.getByTestId('driver-ride-start'));
    await waitFor(() => screen.getByTestId('driver-ride-complete-stop'));
    expect(screen.queryByTestId('driver-ride-cancel')).toBeNull();

    // The stop answer is not a ride: the screen reads the ride again.
    mock.onPost('/rides/41/stops/5/complete').reply(200, envelope({ id: 41, remaining_stops: 0 }));
    serverRide = makeRide({ status: 'started', passenger, stops: [stop({ status: 'completed' })] });
    fireEvent.press(screen.getByTestId('driver-ride-complete-stop'));
    await waitFor(() => screen.getByTestId('driver-ride-complete'));

    mock.onPost('/rides/41/complete').reply(
      200,
      envelope(
        makeRide({
          status: 'completed',
          total_fare: '435.00' as unknown as number,
          driver_earnings: '348.00' as unknown as number,
          fare_breakdown: { base: 50, distance: '250', time: '60', stops: '75', min_fare_adjustment: 0, total: '435.00' },
        }),
      ),
    );
    fireEvent.press(screen.getByTestId('driver-ride-complete'));
    await waitFor(() => screen.getByTestId('driver-ride-summary'));

    expect(mock.history.put).toHaveLength(0);
    const posted = mock.history.post.filter((r) => /\/(arrived|start|complete)$/.test(r.url ?? ''));
    expect(posted.map((r) => r.url)).toEqual([
      '/rides/41/arrived',
      '/rides/41/start',
      '/rides/41/stops/5/complete',
      '/rides/41/complete',
    ]);
    posted.forEach((r) => expect(r.data).toBeUndefined());

    expect(screen.getByTestId('driver-ride-total').props.children).toBe('PKR 435');
    expect(screen.getByTestId('driver-ride-collect').props.children).toBe('Collect in cash');
    expect(screen.getByTestId('driver-ride-earnings').props.children).toBe('PKR 348');
    screen.getByTestId('driver-ride-breakdown-stops');
    expect(screen.queryByTestId('driver-ride-breakdown-min')).toBeNull();

    fireEvent.press(screen.getByTestId('driver-ride-done'));
    expect(selectDriverActiveRide(store.getState())).toBeNull();
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });

  it('a 409 shows the latest server status', async () => {
    const { store, screen } = renderScreen(makeRide({ status: 'arrived', passenger }));
    await settle(store);
    mock.onPost('/rides/41/start').reply(409, {
      success: false,
      message: 'Cannot mark the ride started while it is cancelled',
      error: { code: 'INVALID_STATUS_TRANSITION', current_status: 'cancelled' },
    });
    serverRide = makeRide({ status: 'cancelled' });

    fireEvent.press(screen.getByTestId('driver-ride-start'));

    await waitFor(() => screen.getByTestId('driver-ride-cancelled'));
  });

  it('cancel needs a 3-character reason and sends it as the note', async () => {
    const { store, screen } = renderScreen(makeRide({ status: 'accepted', passenger }));
    await settle(store);
    mock.onPost('/rides/41/cancel').reply(200, envelope(makeRide({ status: 'cancelled' })));

    fireEvent.press(screen.getByTestId('driver-ride-cancel'));
    fireEvent.changeText(screen.getByTestId('cancel-reason-input'), 'no');
    fireEvent.press(screen.getByTestId('cancel-reason-submit'));
    expect(screen.getByTestId('cancel-reason-error').props.children).toBe('Please write at least 3 characters.');
    expect(mock.history.post).toHaveLength(0);

    fireEvent.changeText(screen.getByTestId('cancel-reason-input'), 'Flat tyre');
    fireEvent.press(screen.getByTestId('cancel-reason-submit'));

    await waitFor(() => expect(selectDriverActiveRide(store.getState())).toBeNull());
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ note: 'Flat tyre' });
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });

  it('calls the passenger and opens directions in the platform maps app', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { store, screen } = renderScreen(makeRide({ status: 'accepted', passenger }));
    await settle(store);

    fireEvent.press(screen.getByTestId('driver-ride-call'));
    expect(openURL).toHaveBeenCalledWith('tel:%2B923001234567');

    fireEvent.press(screen.getByTestId('driver-ride-navigate'));
    const expected = Platform.OS === 'ios' ? 'http://maps.apple.com/' : 'https://www.google.com/maps/dir/';
    expect(openURL.mock.calls[1][0]).toContain(expected);
    expect(openURL.mock.calls[1][0]).toContain('31.52%2C74.35');
  });

  it('hides the call button when the server sent no phone', async () => {
    const { store, screen } = renderScreen(makeRide({ status: 'accepted', passenger: { id: 9, name: 'Ayesha', phone: '' } }));
    await settle(store);
    expect(screen.queryByTestId('driver-ride-call')).toBeNull();
  });

  it('shows an empty state without a ride', () => {
    const store = configureStore({ reducer: rootReducer });
    const screen = render(
      <Provider store={store}>
        <DriverRideScreen />
      </Provider>,
    );
    screen.getByTestId('driver-ride-empty');
    act(() => fireEvent.press(screen.getByTestId('driver-ride-back-to-map')));
    expect(mockGoBack).toHaveBeenCalled();
  });
});

describe('OpenRideCard', () => {
  it('shows the step and opens the ride', () => {
    const onOpen = jest.fn();
    const screen = render(<OpenRideCard ride={makeRide({ status: 'started', passenger })} onOpen={onOpen} />);
    expect(screen.getByTestId('open-ride-step').props.children).toBe('On trip');
    fireEvent.press(screen.getByTestId('open-ride-button'));
    expect(onOpen).toHaveBeenCalled();
  });
});
