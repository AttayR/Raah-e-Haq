/**
 * T-315 (QA 2026-10-11-regression): passenger location UX.
 * (a) location failures render inline (booking map wait state, Home header), never as alerts;
 * (b) a ride, above all its completed summary, wins over the "Finding your location" state;
 * (c) the driver-on-the-way camera keeps street context when driver and pickup are close.
 */
import React from 'react';
import { fireEvent, render, renderHook, act } from '@testing-library/react-native';
import type { LatLng } from 'react-native-maps';
import { bookingInitialRegion, locationRefused, showLocationWait } from '../../../src/features/ride-booking/locationGate';
import { LocationOffBanner, LocationWaitState } from '../../../src/features/ride-booking/components/BookingNotices';
import { HomeHeader } from '../../../src/features/passenger-home/components/HomeHeader';
import {
  BOOKING_REGION_DELTA,
  MIN_DRIVER_APPROACH_DELTA,
  usePassengerRideCamera,
  withMinimumSpan,
} from '../../../src/features/active-ride/camera';

const FALLBACK = { latitude: 31.5204, longitude: 74.3587, latitudeDelta: 0.0922, longitudeDelta: 0.0421 };

describe('showLocationWait (b)', () => {
  it('shows the wait state only without a ride, a location or a lookup in flight', () => {
    expect(showLocationWait({ hasLocation: false, locationLoading: false, rideShown: false })).toBe(true);
    expect(showLocationWait({ hasLocation: false, locationLoading: true, rideShown: false })).toBe(false);
    expect(showLocationWait({ hasLocation: true, locationLoading: false, rideShown: false })).toBe(false);
  });

  it('never covers a ride (the completed summary is shown even without a position)', () => {
    expect(showLocationWait({ hasLocation: false, locationLoading: false, rideShown: true })).toBe(false);
  });
});

describe('booking with location refused (T-580)', () => {
  it('denied or switched off keeps the map (no full-screen dead end); a plain wait still shows', () => {
    expect(locationRefused('denied')).toBe(true);
    expect(locationRefused('disabled')).toBe(true);
    expect(locationRefused('unavailable')).toBe(false);
    expect(locationRefused(null)).toBe(false);
    expect(showLocationWait({ hasLocation: false, locationLoading: false, rideShown: false, refused: true })).toBe(false);
    expect(showLocationWait({ hasLocation: false, locationLoading: false, rideShown: false, refused: false })).toBe(true);
  });

  it('the sheet Banner says to search the pickup and its action turns location on', () => {
    const onTurnOn = jest.fn();
    const { getByText, getByTestId } = render(<LocationOffBanner onTurnOn={onTurnOn} />);
    getByText('Location is off');
    getByText(/Search for your pickup below/);
    fireEvent.press(getByTestId('booking-location-turn-on'));
    expect(onTurnOn).toHaveBeenCalled();
  });

  it('the remaining full-screen wait has a back button', () => {
    const onBack = jest.fn();
    const { getByTestId } = render(<LocationWaitState onRetry={jest.fn()} onBack={onBack} />);
    fireEvent.press(getByTestId('location-wait-back'));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('bookingInitialRegion (b)', () => {
  it('opens on the passenger, else the ride pickup (decimal strings too), else the default', () => {
    expect(bookingInitialRegion({ latitude: 31.5, longitude: 74.3 }, null, FALLBACK)).toEqual({
      latitude: 31.5,
      longitude: 74.3,
      latitudeDelta: BOOKING_REGION_DELTA,
      longitudeDelta: BOOKING_REGION_DELTA,
    });
    expect(bookingInitialRegion(null, { pickup_latitude: '31.52000000', pickup_longitude: '74.35000000' }, FALLBACK)).toEqual({
      latitude: 31.52,
      longitude: 74.35,
      latitudeDelta: BOOKING_REGION_DELTA,
      longitudeDelta: BOOKING_REGION_DELTA,
    });
    expect(bookingInitialRegion(null, { pickup_latitude: null, pickup_longitude: 74.3 }, FALLBACK)).toBe(FALLBACK);
    expect(bookingInitialRegion(null, null, FALLBACK)).toBe(FALLBACK);
  });
});

describe('LocationWaitState (a)', () => {
  it('while waiting: "Finding your location" with Try again, no Settings button', () => {
    const onRetry = jest.fn();
    const { getByText, getByTestId, queryByTestId } = render(<LocationWaitState onRetry={onRetry} onOpenSettings={jest.fn()} />);
    getByText('Finding your location');
    expect(queryByTestId('location-open-settings')).toBeNull();
    fireEvent.press(getByTestId('location-retry'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('no fix: says so inline and offers Try again', () => {
    const { getByText, getByTestId, queryByTestId } = render(
      <LocationWaitState reason="unavailable" onRetry={jest.fn()} onOpenSettings={jest.fn()} />,
    );
    getByText("Can't find your location");
    getByTestId('location-retry');
    expect(queryByTestId('location-open-settings')).toBeNull();
  });

  it.each(['denied', 'disabled'] as const)('access %s: "Location is off" with Open settings', (reason) => {
    const onOpenSettings = jest.fn();
    const { getByText, getByTestId } = render(
      <LocationWaitState reason={reason} onRetry={jest.fn()} onOpenSettings={onOpenSettings} />,
    );
    getByText('Location is off');
    fireEvent.press(getByTestId('location-open-settings'));
    expect(onOpenSettings).toHaveBeenCalled();
  });
});

describe('LocationWaitState after "Not now" (UI-R8)', () => {
  it('denied but the OS can still ask: no Settings button, "Try again" asks', () => {
    const onRetry = jest.fn();
    const { queryByTestId, getByTestId } = render(
      <LocationWaitState reason="denied" canAskAgain onRetry={onRetry} onOpenSettings={jest.fn()} />,
    );
    expect(queryByTestId('location-open-settings')).toBeNull();
    fireEvent.press(getByTestId('location-retry'));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('HomeHeader location row (a)', () => {
  it('a failed lookup reads "Location unavailable" with Retry (no alert)', () => {
    const onEnableLocation = jest.fn();
    const { getByText, getByLabelText } = render(
      <HomeHeader
        greeting="Hello"
        location={{ kind: 'unavailable' }}
        onOpenProfile={jest.fn()}
        onOpenNotifications={jest.fn()}
        onEnableLocation={onEnableLocation}
      />,
    );
    getByText('Location unavailable');
    fireEvent.press(getByLabelText('Retry location'));
    expect(onEnableLocation).toHaveBeenCalled();
  });
});

const latSpan = (points: LatLng[]) => Math.max(...points.map((p) => p.latitude)) - Math.min(...points.map((p) => p.latitude));
const lngSpan = (points: LatLng[]) => Math.max(...points.map((p) => p.longitude)) - Math.min(...points.map((p) => p.longitude));

describe('driver-approach minimum zoom (c)', () => {
  const pickup = { latitude: 31.5204, longitude: 74.3587 };

  it('pads close points out to the minimum span around their centre', () => {
    const close = [{ latitude: 31.5206, longitude: 74.3589 }, pickup];
    const padded = withMinimumSpan(close)!;
    expect(padded.slice(0, 2)).toEqual(close);
    expect(latSpan(padded)).toBeCloseTo(MIN_DRIVER_APPROACH_DELTA, 10);
    expect(lngSpan(padded)).toBeCloseTo(MIN_DRIVER_APPROACH_DELTA, 10);
    // Centred on the two points.
    expect((Math.max(...padded.map((p) => p.latitude)) + Math.min(...padded.map((p) => p.latitude))) / 2).toBeCloseTo(31.5205, 10);
  });

  it('leaves points that already span enough alone, and keeps the larger side', () => {
    const far = [{ latitude: 31.53, longitude: 74.37 }, pickup];
    expect(withMinimumSpan(far)).toBe(far);
    const tallNarrow = [{ latitude: 31.54, longitude: 74.3588 }, pickup];
    const padded = withMinimumSpan(tallNarrow)!;
    expect(latSpan(padded)).toBeCloseTo(31.54 - 31.5204, 10);
    expect(lngSpan(padded)).toBeCloseTo(MIN_DRIVER_APPROACH_DELTA, 10);
    expect(withMinimumSpan(null)).toBeNull();
  });

  it('the ride camera never fits tighter than the minimum when the driver is next to the pickup', () => {
    const fit = jest.fn();
    const mapRef = { current: { fitToCoordinates: fit, animateToRegion: jest.fn() } };
    const ride = { pickup_latitude: pickup.latitude, pickup_longitude: pickup.longitude };
    const { result } = renderHook(() =>
      usePassengerRideCamera(mapRef, 'driver_en_route', { latitude: 31.52045, longitude: 74.35875 }, ride),
    );
    act(() => result.current.onMapReady());
    expect(fit).toHaveBeenCalledTimes(1);
    const fitted: LatLng[] = fit.mock.calls[0][0];
    expect(latSpan(fitted)).toBeGreaterThanOrEqual(MIN_DRIVER_APPROACH_DELTA - 1e-9);
    expect(lngSpan(fitted)).toBeGreaterThanOrEqual(MIN_DRIVER_APPROACH_DELTA - 1e-9);
  });
});
