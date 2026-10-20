/**
 * UI-R12: the passenger trip sheet (shared-trip-sheet.md; passenger-driver-assigned PA1–PA7,
 * passenger-trip-in-progress PT1–PT6, passenger-trip-complete PR1–PR6).
 * - The status sentence, subtitle and ETA come from the ride only: the BE-128 `eta` for this
 *   stage's target, hidden without it, never `estimated_arrival`; stale location and offline
 *   replace the subtitle and hide the tile.
 * - Call · Message · Share on a plain PersonCard; the PIN, waiting timer and the FareTag fare row.
 * - Cancel only in the details, as a ghost button; on the trip there is none.
 * - Receipt: money card, Fare details collapsed, inline rating with one footer (Submit / Done).
 * - The vehicle → pickup leg follows the T-549 fetch rules (no straight line, no bursts).
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../../../src/services/api';
import activeRideReducer, { initialActiveRideState } from '../../../src/features/active-ride/slice';
import ActiveRidePanel from '../../../src/features/active-ride/components/ActiveRidePanel';
import { PassengerTripSheet } from '../../../src/features/active-ride/trip/PassengerTripSheet';
import { FARE_WAIT_MS } from '../../../src/features/active-ride/trip/PassengerReceipt';
import {
  isTripStage,
  passengerTripHeader,
  rideEtaMinutes,
  shortPlace,
  tripStopsOf,
} from '../../../src/features/active-ride/trip/tripModel';
import { passengerTripView } from '../../../src/features/active-ride/trip/usePassengerTripView';
import { tripAnnouncement } from '../../../src/features/active-ride/trip/useTripMoments';
import { nextLegRequest } from '../../../src/features/active-ride/routeLeg';
import { MIN_ROUTE_REFETCH_MS, ROUTE_REFRESH_MS } from '../../../src/features/active-ride/tripRoute';
import { advanceRideStage, type PassengerRideStage, type PassengerRideStageState } from '../../../src/features/active-ride/stage';
import { resetRatingSessionState } from '../../../src/features/rating/hooks';
import { setLocale } from '../../../src/i18n';
import '../../../src/i18n/copy-ur-Latn';
import { toast } from '../../../src/core/toast';
import type { RideResource } from '../../../src/services/rideService';
import { makeRide } from '../../../test-utils/rideFixtures';

const NOW = Date.parse('2026-10-20T12:00:00Z');

const driverRide = (overrides: Partial<RideResource> = {}): RideResource =>
  makeRide({
    status: 'accepted',
    driver_id: 5,
    driver: { id: 5, name: 'Ali Raza', rating: 4.9 },
    vehicle: { id: 2, make: 'Honda', model: 'City', color: 'Grey', license_plate: 'LEC-9' },
    pickup_address: 'Liberty Market, Gulberg III, Lahore',
    dropoff_address: 'Emporium Mall, Johar Town, Lahore',
    accepted_fare: '152.00',
    fare_locked: true,
    ...overrides,
  });

const stateOf = (ride: RideResource): PassengerRideStageState => {
  const state = advanceRideStage(null, ride);
  if (!state) throw new Error('no stage');
  return state;
};

const header = (stage: PassengerRideStage, ride: RideResource | null, extra: { offline?: boolean; locationAge?: number | null } = {}) =>
  passengerTripHeader({ stage, ride, parcel: null, offline: extra.offline ?? false, locationAge: extra.locationAge ?? null, now: NOW });

afterEach(() => setLocale('en'));

describe('trip model (PA2, PT2, PR2)', () => {
  it('the short place is the first part of the address', () => {
    expect(shortPlace('Liberty Market, Gulberg III, Lahore')).toBe('Liberty Market');
    expect(shortPlace('Model Town')).toBe('Model Town');
    expect(shortPlace(null)).toBe('');
  });

  it('only the trip stages use the trip sheet', () => {
    expect(isTripStage('searching')).toBe(false);
    expect(isTripStage('driver_en_route')).toBe(true);
    expect(isTripStage('completed')).toBe(true);
    expect(isTripStage(null)).toBe(false);
  });

  it('on the way: "Driver is on the way" · "Meet at {pickup}" with the server ETA to the pickup', () => {
    const ride = driverRide({ eta: { minutes: 6, distance_km: 2.1, target: 'pickup', updated_at: 'x' }, estimated_arrival: '12 minutes' });
    expect(header('driver_en_route', ride)).toEqual({
      title: 'Driver is on the way',
      subtitle: 'Meet at Liberty Market',
      tone: 'textSecondary',
      icon: null,
      etaMinutes: 6,
    });
  });

  it('never guesses: no `eta` (or one for another target) hides the tile; estimated_arrival is ignored', () => {
    expect(header('driver_en_route', driverRide({ estimated_arrival: '12 minutes' })).etaMinutes).toBeNull();
    expect(rideEtaMinutes(driverRide({ eta: { minutes: 6, distance_km: 2, target: 'dropoff', updated_at: 'x' } }), 'driver_en_route')).toBeNull();
    expect(rideEtaMinutes(driverRide({ eta: null }), 'driver_en_route')).toBeNull();
  });

  it('a stale driver position or being offline replaces the subtitle and hides the ETA', () => {
    const ride = driverRide({ eta: { minutes: 6, distance_km: 2.1, target: 'pickup', updated_at: 'x' } });
    expect(header('driver_en_route', ride, { locationAge: 130 })).toMatchObject({
      subtitle: 'Location updated 2 min ago',
      tone: 'textMuted',
      etaMinutes: null,
    });
    expect(header('driver_en_route', ride, { offline: true })).toMatchObject({
      subtitle: "You're offline. Showing the last update.",
      tone: 'warning',
      icon: 'offline',
      etaMinutes: null,
    });
  });

  it('arrived: "Your driver is here" · "Meet your driver at {pickup}", no tile', () => {
    const ride = driverRide({ status: 'arrived', eta: { minutes: 1, distance_km: 0, target: 'pickup', updated_at: 'x' } });
    expect(header('driver_arrived', ride)).toMatchObject({
      title: 'Your driver is here',
      subtitle: 'Meet your driver at Liberty Market',
      etaMinutes: null,
    });
  });

  it('on trip: heading to the drop-off, "Arriving at" from the ETA, else the driver and plate', () => {
    const withEta = driverRide({ status: 'started', eta: { minutes: 15, distance_km: 7, target: 'dropoff', updated_at: 'x' } });
    const h = header('in_trip', withEta);
    expect(h.title).toBe('Heading to Emporium Mall');
    expect(h.subtitle).toMatch(/^Arriving at \d{1,2}:15 (AM|PM)$/);
    expect(h.etaMinutes).toBe(15);
    expect(header('in_trip', driverRide({ status: 'started' })).subtitle).toBe('Ali · LEC-9');
  });

  it('on trip with a stop still ahead: "Heading to stop n", the stop as subtitle, no drop-off ETA', () => {
    const stop = (id: number, order: number, status: 'active' | 'completed', address: string) =>
      ({ id, ride_id: 41, address, latitude: 31.5, longitude: 74.3, stop_order: order, status, status_label: '', status_color: '', created_at: '', updated_at: '' });
    const ride = driverRide({
      status: 'started',
      eta: { minutes: 15, distance_km: 7, target: 'dropoff', updated_at: 'x' },
      stops: [stop(2, 2, 'active', 'Packages Mall, Walton'), stop(1, 1, 'completed', 'Kalma Chowk, Lahore')],
    });
    expect(tripStopsOf(ride).map((s) => [s.n, s.done])).toEqual([[1, true], [2, false]]);
    expect(header('in_trip', ride)).toMatchObject({ title: 'Heading to stop 2', subtitle: 'Packages Mall', etaMinutes: null });
  });

  it('receipt: "You\'ve arrived" with time · distance · duration (missing parts dropped)', () => {
    const ride = driverRide({ status: 'completed', completed_at: '2026-10-20T12:30:00Z', distance_km: 8.4, duration_minutes: 23 });
    const h = header('completed', ride);
    expect(h.title).toBe("You've arrived");
    expect(h.subtitle).toMatch(/^\d{1,2}:30 (AM|PM) · 8\.4 km · 23 min$/);
    expect(header('completed', driverRide({ status: 'completed' })).subtitle).toBeNull();
  });

  it('Roman Urdu', () => {
    setLocale('ur-Latn');
    const ride = driverRide({ eta: { minutes: 6, distance_km: 2.1, target: 'pickup', updated_at: 'x' } });
    expect(header('driver_en_route', ride)).toMatchObject({ title: 'Driver aa raha hai', subtitle: 'Liberty Market par milein' });
    expect(header('driver_arrived', driverRide({ status: 'arrived' })).title).toBe('Aap ka driver pohanch gaya');
    expect(header('in_trip', driverRide({ status: 'started' })).title).toBe('Emporium Mall ki taraf');
    expect(header('completed', driverRide({ status: 'completed' })).title).toBe('Aap pohanch gaye');
  });

  it('announces each stage once in words a screen reader can say', () => {
    const view = passengerTripView('driver_en_route', driverRide({ eta: { minutes: 4, distance_km: 1, target: 'pickup', updated_at: 'x' } }), {}, false);
    expect(tripAnnouncement('driver_en_route', view)).toBe('Driver found. Ali, Honda City · Grey, plate LEC-9. 4 minutes away.');
    expect(tripAnnouncement('driver_arrived', passengerTripView('driver_arrived', driverRide({ status: 'arrived' }), {}, false))).toBe(
      'Your driver is here. Plate LEC-9.',
    );
    expect(tripAnnouncement('completed', passengerTripView('completed', driverRide({ status: 'completed', total_fare: 310, accepted_fare: null }), {}, false))).toBe(
      "You've arrived. Pay Rs 310 in cash.",
    );
  });
});

const renderPanel = (ride: RideResource, extra: Partial<React.ComponentProps<typeof ActiveRidePanel>> = {}) =>
  render(<ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={jest.fn()} {...extra} />);

describe('trip sections (PA1, PA3, PT3)', () => {
  it('on the way: unlabelled progress, plain PersonCard with Call · Message · Share, PIN, then the FareTag fare row', () => {
    const share = { key: 'share', icon: 'share' as const, label: 'Share trip', onPress: jest.fn(), testID: 'trip-share-button' };
    renderPanel(driverRide({ pin: '4821' }), { onCall: jest.fn(), shareAction: share });
    expect(screen.getByTestId('active-ride-progress-segment-1')).toBeTruthy();
    expect(screen.queryByTestId('active-ride-progress-label-1')).toBeNull();
    expect(screen.getByTestId('driver-call-button')).toBeTruthy();
    expect(screen.getByTestId('trip-share-button')).toBeTruthy();
    expect(screen.getByTestId('ride-pin-card')).toBeTruthy();
    expect(screen.getByTestId('trip-fare-row-amount')).toHaveTextContent('Rs 152');
    expect(screen.getByText('Fixed fare')).toBeTruthy();
    // TS0 #4: the green "Fare locked" pill is gone.
    expect(screen.queryByText(/^Fare locked/)).toBeNull();
    // The plain card: no bordered card inside the sheet.
    expect(screen.getByTestId('driver-assigned-card').props.style).toBeUndefined();
  });

  it('Cancel is the last item of the details, a ghost button; none once the trip started (BE-04)', () => {
    const onCancel = jest.fn();
    const { rerender } = render(<ActiveRidePanel stageState={stateOf(driverRide())} ride={driverRide()} onCancel={onCancel} />);
    fireEvent.press(screen.getByTestId('active-ride-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('active-ride-cancel')).toHaveTextContent(/Cancel ride$/);
    const started = driverRide({ status: 'started' });
    rerender(<ActiveRidePanel stageState={stateOf(started)} ride={started} onCancel={onCancel} />);
    expect(screen.queryByTestId('active-ride-cancel')).toBeNull();
  });

  it('the route card on the trip: "Picked up", the done stop muted and the next one named', () => {
    const stop = (id: number, order: number, status: 'active' | 'completed', address: string) =>
      ({ id, ride_id: 41, address, latitude: 31.5, longitude: 74.3, stop_order: order, status, status_label: '', status_color: '', created_at: '', updated_at: '' });
    const ride = driverRide({ status: 'started', stops: [stop(1, 1, 'completed', 'Kalma Chowk'), stop(2, 2, 'active', 'Packages Mall')] });
    renderPanel(ride);
    expect(screen.getByText('Picked up')).toBeTruthy();
    expect(screen.getByText('Stop 1 · done')).toBeTruthy();
    expect(screen.getByText('Next stop')).toBeTruthy();
  });

  it('the live share row shows while a link is live', () => {
    renderPanel(driverRide(), { sharing: true });
    expect(screen.getByTestId('trip-sharing-row')).toBeTruthy();
    expect(screen.getByText('Sharing your trip live')).toBeTruthy();
  });
});

describe('receipt (PR2, PR5)', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet('/rating-tags').reply(200, {
      success: true,
      data: { window_days: 7, max_tags: 2, max_comment_length: 500, positive_min_stars: 4, negative_max_stars: 4, tags: { passenger: { positive: [], negative: [] }, driver: { positive: [], negative: [] } } },
    });
    resetRatingSessionState();
    jest.spyOn(toast, 'success').mockImplementation(() => '');
    jest.spyOn(toast, 'error').mockImplementation(() => '');
  });
  afterEach(() => {
    mock.restore();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  const completed = (overrides: Partial<RideResource> = {}) =>
    driverRide({ id: 12, status: 'completed', total_fare: 310, accepted_fare: '310.00', can_rate: true, my_rating: null, ...overrides } as Partial<RideResource>);

  const renderSheet = (ride: RideResource, onFinish = jest.fn()) => {
    const store = configureStore({ reducer: { activeRide: activeRideReducer }, preloadedState: { activeRide: { ...initialActiveRideState, ride } } });
    render(
      <Provider store={store}>
        <PassengerTripSheet stageState={stateOf(ride)} ride={ride} driverLocation={null} onCancel={jest.fn()} onFinish={onFinish} />
      </Provider>,
    );
    return { store, onFinish };
  };

  const flush = async () => {
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 0));
    });
  };

  it('rates inline: a star turns Done into "Submit rating"; a sent rating thanks, patches the ride and goes Home', async () => {
    mock.onPost('/rides/12/rate').reply(201, { success: true, data: { my_rating: { stars: 5, tags: [], comment: null, created_at: 'x' }, can_rate: false } });
    const { store, onFinish } = renderSheet(completed());
    await flush();
    expect(screen.getByText("You've arrived")).toBeTruthy();
    expect(screen.getByTestId('receipt-amount')).toHaveTextContent('Rs 310');
    expect(screen.getByTestId('receipt-fare-tag')).toBeTruthy();
    expect(screen.getByText('How was your ride with Ali?')).toBeTruthy();
    expect(screen.getByTestId('active-ride-done')).toHaveTextContent('Done');
    const row = screen.getByTestId('rate-ride-stars-row');
    fireEvent(row, 'layout', { nativeEvent: { layout: { width: 240, height: 48 } } });
    act(() => {
      fireEvent(row, 'responderGrant', { nativeEvent: { locationX: 5 * 48 - 10 } });
    });
    expect(screen.getByTestId('rate-ride-submit')).toHaveTextContent('Submit rating');
    await act(async () => {
      fireEvent.press(screen.getByTestId('rate-ride-submit'));
    });
    await flush();
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ stars: 5 });
    expect(toast.success).toHaveBeenCalledWith('Thanks for your feedback');
    expect(store.getState().activeRide.ride?.can_rate).toBe(false);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('already rated shows the stars given; a ride that cannot be rated just has Done', async () => {
    renderSheet(completed({ can_rate: false, my_rating: { stars: 4, tags: [], comment: null, created_at: 'x' } } as Partial<RideResource>));
    await flush();
    expect(screen.getByTestId('receipt-rated')).toBeTruthy();
    expect(screen.getByText('You rated this ride')).toBeTruthy();
    expect(screen.queryByTestId('rate-ride-stars-row')).toBeNull();
    fireEvent.press(screen.getByTestId('active-ride-done'));
  });

  it('a fare not final yet is a skeleton, then says where it will appear', () => {
    jest.useFakeTimers();
    renderSheet(completed({ total_fare: null as unknown as number, can_rate: false }));
    // The skeleton is decorative (hidden from screen readers; the card's label says it).
    expect(screen.getByTestId('receipt-amount-skeleton', { includeHiddenElements: true })).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(FARE_WAIT_MS);
    });
    expect(screen.getByText('Fare will appear in your ride history.')).toBeTruthy();
  });

  it('a cancelled ride shows the fee card only when a fee was charged', () => {
    const cancelled = driverRide({ id: 13, status: 'cancelled', cancellation_reason: 'passenger', cancellation_fee: '50.00' } as Partial<RideResource>);
    renderSheet(cancelled);
    expect(screen.getByText('Ride cancelled')).toBeTruthy();
    expect(screen.getByText('Cancellation fee')).toBeTruthy();
    expect(screen.getByTestId('receipt-amount')).toHaveTextContent('Rs 50');
  });
});

describe('vehicle → pickup leg (TS2.1, T-549 rules)', () => {
  const car = { latitude: 31.5, longitude: 74.3 };
  const pickup = { latitude: 31.52, longitude: 74.35 };
  const line = [car, pickup];

  it('asks once when the leg starts, then not sooner than a minute, again when off the line or after 5 min', () => {
    expect(nextLegRequest({ now: 0, lastRequestAt: null, route: [], vehicle: car, target: pickup })).toEqual({ from: car, to: pickup });
    expect(nextLegRequest({ now: MIN_ROUTE_REFETCH_MS - 1, lastRequestAt: 0, route: [], vehicle: car, target: pickup })).toBeNull();
    // On the line, a minute later: nothing.
    expect(nextLegRequest({ now: MIN_ROUTE_REFETCH_MS, lastRequestAt: 0, route: line, vehicle: car, target: pickup })).toBeNull();
    // Off the line (≈ 1 km away).
    const off = { latitude: 31.5, longitude: 74.32 + 0.01 };
    expect(nextLegRequest({ now: MIN_ROUTE_REFETCH_MS, lastRequestAt: 0, route: [{ latitude: 31.6, longitude: 74.3 }, { latitude: 31.6, longitude: 74.4 }], vehicle: off, target: pickup })).not.toBeNull();
    expect(nextLegRequest({ now: ROUTE_REFRESH_MS, lastRequestAt: 0, route: line, vehicle: car, target: pickup })).toEqual({ from: car, to: pickup });
    // No vehicle position yet: pins only.
    expect(nextLegRequest({ now: 0, lastRequestAt: null, route: [], vehicle: null, target: pickup })).toBeNull();
  });
});
