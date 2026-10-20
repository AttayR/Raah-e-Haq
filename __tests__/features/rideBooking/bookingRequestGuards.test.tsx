/**
 * UI-R10 review: one POST /rides per Request. Back is held while a request is confirmed or sent
 * (no step back to "Choose a ride" under a request being created), a second confirm sends
 * nothing, each confirm carries its own Idempotency-Key (BE-113), Back with a planned trip asks
 * to discard, Back with a ride shown leaves, Android back follows the same rules. Plus the
 * choose-ride trip line (short names, the stop count kept), the offline footer, the footer
 * hairline and the reduced-motion bar.
 */
import React from 'react';
import { BackHandler, StyleSheet } from 'react-native';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import rideService from '../../../src/services/rideService';
import { useBookingRequest } from '../../../src/features/ride-booking/useBookingRequest';
import { useBookingHardwareBack, useDiscardOnLeave } from '../../../src/features/ride-booking/useBookingDraft';
import { useBookingFlow } from '../../../src/features/ride-booking/useBookingFlow';
import { ChooseRideFooter, ChooseRideStage, shortPlace } from '../../../src/features/ride-booking/components/BookingStages';
import { BookingSheet } from '../../../src/features/ride-booking/components/BookingSheet';
import { toVehicleOptions } from '../../../src/features/ride-booking/vehicleOptions';
import { clearLastVehicle, LAST_VEHICLE_KEY, saveLastVehicle } from '../../../src/features/ride-booking/vehicleSelection';
import { AppText } from '../../../src/components/ui/AppText';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { dialog, dialogStore } from '../../../src/core/dialog';
import { CLIENT_ID_PATTERN } from '../../../src/features/chat/clientId';
import type { FareEstimates, VehicleType } from '../../../src/features/ride-booking/api';
import type { FareOffer } from '../../../src/features/fare/hooks';
import { envelope, makeRide, makeRideRequest } from '../../../test-utils/rideFixtures';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockNetInfo = useNetInfo as jest.MockedFunction<typeof useNetInfo>;

const offer: FareOffer = { band: null, value: null, offeredFare: null, step: jest.fn(), reset: jest.fn(), applyBand: jest.fn(() => false) };
const PICKUP = { latitude: 31.52, longitude: 74.35, address: 'Liberty Market, Gulberg III, Lahore' };
const DROPOFF = { latitude: 31.48, longitude: 74.3, address: 'Emporium Mall, Johar Town, Lahore' };

const flowStub = (overrides: Partial<Parameters<typeof useBookingRequest>[0]['flow']> = {}) => ({
  pickup: PICKUP,
  destination: DROPOFF,
  stops: [],
  selectedVehicle: 'car',
  femaleDriverOnly: false,
  setError: jest.fn(),
  setStage: jest.fn(),
  ...overrides,
});

describe('useBookingRequest: one POST /rides per Request', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('a second confirm while the first is sending sends nothing; each confirm has its own key', async () => {
    let resolve: () => void = () => undefined;
    const requestRide = jest.fn(() => new Promise<void>((r) => { resolve = r; }));
    const { result } = renderHook(() => useBookingRequest({ flow: flowStub(), offer, requestRide }));

    act(() => result.current.confirm());
    expect(result.current.busy).toBe(true);
    act(() => {
      jest.advanceTimersByTime(100);
    });
    await waitFor(() => expect(requestRide).toHaveBeenCalledTimes(1));
    expect(result.current.sending).toBe(true);

    act(() => result.current.confirm());
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(requestRide).toHaveBeenCalledTimes(1);

    const [, firstKey] = requestRide.mock.calls[0] as unknown as [unknown, string];
    expect(firstKey).toMatch(CLIENT_ID_PATTERN);

    await act(async () => {
      resolve();
    });
    expect(result.current.busy).toBe(false);

    act(() => result.current.confirm());
    act(() => {
      jest.advanceTimersByTime(100);
    });
    await waitFor(() => expect(requestRide).toHaveBeenCalledTimes(2));
    const [, secondKey] = requestRide.mock.calls[1] as unknown as [unknown, string];
    expect(secondKey).toMatch(CLIENT_ID_PATTERN);
    expect(secondKey).not.toBe(firstKey);
  });
});

describe('POST /rides carries the Idempotency-Key header', () => {
  it('sends the key as a header, never in the body', async () => {
    const mock = new MockAdapter(apiClient);
    mock.onPost('/rides').reply(201, envelope(makeRide()));
    await rideService.createRide(makeRideRequest(), { idempotencyKey: 'abc-123' });
    expect(mock.history.post[0].headers?.['Idempotency-Key']).toBe('abc-123');
    expect(JSON.parse(mock.history.post[0].data)).not.toHaveProperty('idempotencyKey');
    await rideService.createRide(makeRideRequest());
    expect(mock.history.post[1].headers?.['Idempotency-Key']).toBeUndefined();
    mock.restore();
  });
});

describe('Back on the booking map', () => {
  const leaveHook = (opts: { stage?: boolean; rideShown?: boolean; blocked?: boolean; destination?: boolean }) => {
    const stepBack = jest.fn(() => opts.stage === true);
    const onLeave = jest.fn();
    const { result } = renderHook(() =>
      useDiscardOnLeave({
        flow: { stepBack, destination: opts.destination ? DROPOFF : null, stops: [] },
        rideShown: opts.rideShown ?? false,
        blocked: opts.blocked,
        onLeave,
      }),
    );
    return { back: result.current, stepBack, onLeave };
  };

  afterEach(() => act(() => dialog.dismissAll()));

  it('does nothing while a request is being sent (no step back, no question, no leave)', () => {
    const { back, stepBack, onLeave } = leaveHook({ blocked: true, destination: true });
    back();
    expect(stepBack).not.toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
    expect(dialogStore.getCurrent()).toBeNull();
  });

  it('with a planned trip at the first state asks "Discard this trip?" before leaving', async () => {
    const { back, onLeave } = leaveHook({ destination: true });
    act(() => back());
    await waitFor(() => expect(dialogStore.getCurrent()).not.toBeNull());
    expect(dialogStore.getCurrent()).toMatchObject({
      title: 'Discard this trip?',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      destructive: true,
    });
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('with a ride shown it leaves without asking', () => {
    const { back, onLeave } = leaveHook({ rideShown: true, destination: true });
    back();
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(dialogStore.getCurrent()).toBeNull();
  });

  it('flow: Back while the request is being created stays on finding a driver', () => {
    const directions = { fetchRoute: jest.fn(), fetchRouteWithWaypoints: jest.fn(), clearRoute: jest.fn() };
    const prefill = { pickup: null, destination: null, pickupQuery: '', destQuery: '', stage: 'home' as const, routePending: false, stops: [] };
    const { result } = renderHook(() => useBookingFlow({ prefill, currentLocation: null, rideShown: false, directions }));
    act(() => result.current.setStage('requesting'));
    let handled = false;
    act(() => {
      handled = result.current.stepBack();
    });
    expect(handled).toBe(true);
    expect(result.current.stage).toBe('requesting');
  });

  it('Android back runs the same handler while focused, and is released when not', () => {
    const listeners: Array<() => boolean> = [];
    const remove = jest.fn();
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_e: string, cb: () => boolean) => {
      listeners.push(cb);
      return { remove };
    }) as never);
    const onBack = jest.fn();
    const { rerender } = renderHook(({ on }: { on: boolean }) => useBookingHardwareBack(on, onBack), { initialProps: { on: true } });
    expect(listeners[0]()).toBe(true);
    expect(onBack).toHaveBeenCalledTimes(1);
    rerender({ on: false });
    expect(remove).toHaveBeenCalled();
  });
});

describe('choose-ride details (UI-R10 design review)', () => {
  const types: VehicleType[] = [{ key: 'car', label: 'Car', capacity: 4 }];
  const estimates: FareEstimates = {
    distance_km: 5,
    duration_min: 12,
    fare_notice: null,
    estimates: [
      { vehicle_type: 'car', fare: 230, currency: 'PKR', breakdown: { base: 50, distance: 150, time: 30, stops: 0, min_fare_adjustment: 0, booking_fee: 0 }, offer_band: null, fare_policy: null },
    ],
  };
  const loaded = { status: 'ready' as const, data: estimates, error: null, retry: jest.fn() };
  const options = toVehicleOptions(types, estimates);

  afterEach(() => mockNetInfo.mockReturnValue({ isConnected: true, isInternetReachable: true } as ReturnType<typeof useNetInfo>));

  it('short place names; the stop count stays outside the truncating text', () => {
    expect(shortPlace('Liberty Market, Gulberg III, Lahore')).toBe('Liberty Market');
    expect(shortPlace('Current location')).toBe('Current location');
    const { getByText, getByTestId } = render(
      <ChooseRideStage
        pickupLabel={PICKUP.address}
        dropoffLabel={DROPOFF.address}
        stops={[{ latitude: 1, longitude: 1, address: 'Model Town' }, { latitude: 2, longitude: 2 }]}
        vehicleTypes={{ ...loaded, data: types, notice: null }}
        estimates={loaded}
        options={options}
        selectedVehicle="car"
        onSelectVehicle={jest.fn()}
        onEditTrip={jest.fn()}
      />,
    );
    const route = getByText('Liberty Market → Emporium Mall');
    expect(route.props.numberOfLines).toBe(1);
    expect(getByText(' · 2 stops')).toBeTruthy();
    expect(getByTestId('trip-details-line').props.accessibilityLabel).toBe('Liberty Market → Emporium Mall · 2 stops');
  });

  it('offline: the footer says "You\'re offline", disabled; null counts as online', () => {
    mockNetInfo.mockReturnValue({ isConnected: false, isInternetReachable: false } as ReturnType<typeof useNetInfo>);
    const { getByTestId, rerender } = render(
      <ChooseRideFooter options={options} estimates={loaded} selectedVehicle="car" onConfirm={jest.fn()} />,
    );
    expect(getByTestId('fare-request')).toHaveTextContent("You're offline");
    expect(getByTestId('fare-request').props.accessibilityState).toMatchObject({ disabled: true });
    mockNetInfo.mockReturnValue({ isConnected: null, isInternetReachable: null } as ReturnType<typeof useNetInfo>);
    rerender(<ChooseRideFooter options={options} estimates={loaded} selectedVehicle="car" onConfirm={jest.fn()} />);
    expect(getByTestId('fare-request')).toHaveTextContent('Request Car · Rs 230');
    rerender(<ChooseRideFooter options={options} estimates={loaded} selectedVehicle="car" onConfirm={jest.fn()} disabled />);
    expect(getByTestId('fare-request').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('the footer hairline shows only while content runs beneath it', () => {
    const { getByTestId } = render(
      <BookingSheet footer={<AppText>Request</AppText>}>
        <AppText>content</AppText>
      </BookingSheet>,
    );
    const footerStyle = () => StyleSheet.flatten(getByTestId('booking-sheet-footer').props.style);
    expect(footerStyle().borderTopWidth).toBeUndefined();
    const scroll = getByTestId('booking-sheet-scroll');
    fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { x: 0, y: 0 }, layoutMeasurement: { height: 300, width: 375 }, contentSize: { height: 700, width: 375 } } });
    expect(footerStyle().borderTopWidth).toBeGreaterThan(0);
    fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { x: 0, y: 400 }, layoutMeasurement: { height: 300, width: 375 }, contentSize: { height: 700, width: 375 } } });
    expect(footerStyle().borderTopWidth).toBeUndefined();
  });

  it('compact ErrorState title uses the `title` style, like the compact EmptyState', () => {
    const { getByText } = render(<ErrorState size="compact" title="Couldn't get prices" onRetry={jest.fn()} />);
    const title = StyleSheet.flatten(getByText("Couldn't get prices").props.style);
    expect(title).toMatchObject({ fontSize: 17, fontWeight: '600' });
  });

  it('sign-out forgets the last requested tier', async () => {
    saveLastVehicle('rickshaw');
    await waitFor(async () => expect(await AsyncStorage.getItem(LAST_VEHICLE_KEY)).toBe('rickshaw'));
    await clearLastVehicle();
    expect(await AsyncStorage.getItem(LAST_VEHICLE_KEY)).toBeNull();
  });
});
