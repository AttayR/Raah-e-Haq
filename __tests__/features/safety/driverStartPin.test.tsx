/**
 * T-520 (BE-81): while the ride says `pin_required`, the driver's Start trip opens a 4-digit PIN
 * entry and sends `{pin: "0427"}` as a string; PIN_INVALID shows the attempts left, PIN_LOCKED
 * counts down from retry_after with the entry disabled, PIN_BLOCKED (or `pin_blocked`) hides the
 * entry for "Contact support". Before, Start sent no PIN and every start failed once the server
 * switched the PIN on.
 */
import React from 'react';
import { Linking, TextInput } from 'react-native';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { refreshDriverRide, selectDriverActiveRide, setDriverActiveRide } from '../../../src/features/driver-ride/slice';
import type { RideResource } from '../../../src/services/rideService';
import DriverRideScreen from '../../../src/screens/Driver/DriverRideScreen';
import { formatCountdown, pinRefusalOf } from '../../../src/features/safety/pin';
import { toast } from '../../../src/core/toast';
import { envelope, makeRide } from '../../../test-utils/rideFixtures';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true }),
  useIsFocused: () => true,
}));

let mock: MockAdapter;
let serverRide: RideResource;

const pinRide = (overrides: Partial<RideResource> = {}) =>
  makeRide({ status: 'arrived', driver_id: 3, passenger: { id: 9, name: 'Ayesha', rating: 4.8 }, pin_required: true, ...overrides });

const renderScreen = async (ride: RideResource) => {
  serverRide = ride;
  mock.onGet('/rides/41').reply(() => [200, envelope(serverRide)]);
  const store = configureStore({ reducer: rootReducer });
  store.dispatch(setDriverActiveRide(ride));
  const screen = render(
    <Provider store={store}>
      <DriverRideScreen />
    </Provider>,
  );
  await waitFor(() => expect(store.getState().driverRide.pendingAction).toBeNull());
  return { store, screen };
};

const enterPin = (screen: ReturnType<typeof render>, pin: string) => {
  fireEvent.changeText(screen.getByTestId('pin-entry-input-input'), pin);
};

const startPosts = () => mock.history.post.filter((r) => r.url === '/rides/41/start');

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mock.onGet('/driver/status').reply(200, { success: true, data: { status: 'on_ride', active_ride_id: 41 } });
  jest.spyOn(toast, 'error').mockImplementation(() => '');
  jest.spyOn(toast, 'success').mockImplementation(() => '');
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('driver start PIN', () => {
  it('opens the PIN entry and sends the 4 digits as a string; success starts the trip', async () => {
    const { store, screen } = await renderScreen(pinRide());
    fireEvent.press(screen.getByTestId('driver-ride-start'));
    expect(startPosts()).toHaveLength(0);
    screen.getByTestId('pin-entry-sheet');
    expect(screen.getByTestId('pin-entry-input-input').props.keyboardType).toBe('number-pad');
    expect(screen.getByTestId('pin-entry-input-input').props.autoFocus).toBe(true);
    expect(screen.getByTestId('pin-entry-input-input').props.textContentType).toBe('none');

    mock.onPost('/rides/41/start').reply(200, envelope(makeRide({ status: 'started' })));
    enterPin(screen, '0427');

    await waitFor(() => expect(selectDriverActiveRide(store.getState())?.status).toBe('started'));
    expect(startPosts()).toHaveLength(1);
    expect(JSON.parse(startPosts()[0].data)).toEqual({ pin: '0427' });
    expect(typeof JSON.parse(startPosts()[0].data).pin).toBe('string');
  });

  it('PIN_INVALID shows the attempts left and clears the boxes, without a generic toast', async () => {
    const { screen } = await renderScreen(pinRide());
    fireEvent.press(screen.getByTestId('driver-ride-start'));
    mock.onPost('/rides/41/start').reply(422, {
      success: false,
      message: 'Wrong PIN',
      error: { code: 'PIN_INVALID', message: 'Wrong PIN', attempts_left: 3 },
    });
    enterPin(screen, '1111');

    await waitFor(() => expect(screen.getByText("That PIN isn't right. 3 attempts left.")).toBeTruthy());
    expect(screen.getByTestId('pin-entry-input-input').props.value).toBe('');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('PIN_LOCKED counts down from retry_after with the entry disabled, then refocuses for a retry', async () => {
    jest.useFakeTimers();
    const focusSpy = jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => undefined);
    const { screen } = await renderScreen(pinRide());
    fireEvent.press(screen.getByTestId('driver-ride-start'));
    mock.onPost('/rides/41/start').reply(423, { success: false, error: { code: 'PIN_LOCKED', retry_after: 65 } }, { 'retry-after': '65' });
    enterPin(screen, '2222');

    await waitFor(() => screen.getByTestId('pin-entry-locked'));
    expect(screen.getByTestId('pin-entry-locked')).toHaveTextContent(/Too many wrong PINs\. Try again in 1:05\.$/);
    expect(screen.getByTestId('pin-entry-submit').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('pin-entry-input-input').props.editable).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId('pin-entry-locked')).toHaveTextContent(/Try again in 1:00\.$/);

    await act(async () => {
      jest.advanceTimersByTime(61_000);
    });
    expect(screen.queryByTestId('pin-entry-locked')).toBeNull();
    expect(screen.getByTestId('pin-entry-input-input').props.editable).toBe(true);
    // The keypad comes back on its own once the lock runs out.
    expect(focusSpy).toHaveBeenCalled();
  });

  it('PIN_BLOCKED hides the entry and offers Contact support; the panel shows it too', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    openURL.mockClear();
    const { screen } = await renderScreen(pinRide());
    fireEvent.press(screen.getByTestId('driver-ride-start'));
    mock.onPost('/rides/41/start').reply(423, { success: false, error: { code: 'PIN_BLOCKED', message: 'Blocked' } });
    serverRide = pinRide({ pin_blocked: true });
    enterPin(screen, '3333');

    await waitFor(() => screen.getByTestId('pin-entry-support'));
    expect(screen.queryByTestId('pin-entry-input')).toBeNull();
    expect(screen.queryByTestId('driver-ride-start')).toBeNull();
    screen.getByTestId('driver-ride-pin-blocked');

    fireEvent.press(screen.getByTestId('pin-entry-support'));
    expect(openURL.mock.calls[0][0]).toMatch(/^mailto:help@raahehaq\.com\?subject=Ride%2041/);
  });

  it('after an admin clears the block, a refresh with pin_blocked false brings Start trip back', async () => {
    const { store, screen } = await renderScreen(pinRide());
    fireEvent.press(screen.getByTestId('driver-ride-start'));
    mock.onPost('/rides/41/start').replyOnce(423, { success: false, error: { code: 'PIN_BLOCKED', message: 'Blocked' } });
    serverRide = pinRide({ pin_blocked: true });
    enterPin(screen, '3333');
    await waitFor(() => screen.getByTestId('pin-entry-support'));
    fireEvent.press(screen.getByTestId('pin-entry-close'));
    await waitFor(() => expect(store.getState().driverRide.pendingAction).toBeNull());
    expect(screen.queryByTestId('driver-ride-start')).toBeNull();

    // An admin clears the block: the next read says pin_blocked false.
    serverRide = pinRide({ pin_blocked: false });
    await act(async () => {
      store.dispatch(refreshDriverRide(41));
    });
    await waitFor(() => screen.getByTestId('driver-ride-start'));
    expect(screen.queryByTestId('driver-ride-pin-blocked')).toBeNull();
    fireEvent.press(screen.getByTestId('driver-ride-start'));
    screen.getByTestId('pin-entry-input-input');
    expect(screen.queryByTestId('pin-entry-support')).toBeNull();
  });

  it('a ride that is already pin_blocked offers no Start and no PIN entry', async () => {
    const { screen } = await renderScreen(pinRide({ pin_blocked: true }));
    expect(screen.queryByTestId('driver-ride-start')).toBeNull();
    screen.getByTestId('driver-ride-pin-blocked');
    screen.getByTestId('driver-ride-support');
  });

  it('without pin_required, Start posts no body; a PIN_REQUIRED answer opens the entry', async () => {
    const { screen } = await renderScreen(pinRide({ pin_required: false }));
    mock.onPost('/rides/41/start').reply(422, { success: false, error: { code: 'PIN_REQUIRED', message: 'PIN needed' } });
    fireEvent.press(screen.getByTestId('driver-ride-start'));

    await waitFor(() => screen.getByTestId('pin-entry-sheet'));
    expect(startPosts()[0].data).toBeUndefined();
    expect(screen.getByText('Enter the 4-digit PIN to start the trip.')).toBeTruthy();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe('pinRefusalOf', () => {
  const rejection = (code: string, extra?: Record<string, number>, retryAfter?: number) => ({
    message: 'x',
    kind: 'validation' as const,
    code,
    fieldErrors: {},
    extra,
    retryAfter,
  });

  it('maps the four codes and a malformed pin', () => {
    expect(pinRefusalOf(rejection('PIN_REQUIRED'))).toEqual({ kind: 'required' });
    expect(pinRefusalOf(rejection('PIN_INVALID', { attempts_left: 2 }))).toEqual({ kind: 'invalid', attemptsLeft: 2 });
    expect(pinRefusalOf(rejection('PIN_INVALID'))).toEqual({ kind: 'invalid', attemptsLeft: null });
    expect(pinRefusalOf(rejection('PIN_LOCKED', { retry_after: 119.2 }))).toEqual({ kind: 'locked', retryAfterSeconds: 120 });
    expect(pinRefusalOf(rejection('PIN_LOCKED', undefined, 30))).toEqual({ kind: 'locked', retryAfterSeconds: 30 });
    expect(pinRefusalOf(rejection('PIN_LOCKED'))).toEqual({ kind: 'locked', retryAfterSeconds: 120 });
    expect(pinRefusalOf(rejection('PIN_BLOCKED'))).toEqual({ kind: 'blocked' });
    expect(pinRefusalOf({ message: 'x', kind: 'validation', fieldErrors: { pin: ['4 digits'] } })).toEqual({ kind: 'malformed' });
    expect(pinRefusalOf(rejection('INVALID_STATUS_TRANSITION'))).toBeNull();
    expect(pinRefusalOf(undefined)).toBeNull();
  });

  it('formats the countdown as m:ss', () => {
    expect(formatCountdown(120)).toBe('2:00');
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(0)).toBe('0:00');
  });
});
