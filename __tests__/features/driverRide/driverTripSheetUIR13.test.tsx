/**
 * UI-R13: the driver trip on the shared trip sheet (shared-trip-sheet.md; driver-to-pickup DP1–DP7,
 * driver-trip-in-progress DT1–DT7, driver-trip-complete DC1–DC4).
 * - Status sentence, subtitle and ETA from the ride only: BE-128 `eta` for the current target (no
 *   tile while a stop is next, BE-128 has no stop target), offline / weak GPS replace the subtitle.
 * - One primary in the footer (I've arrived → slide to start → Stop {n} done → slide to complete);
 *   Cancel only in the details as `destructiveGhost`; the no-show replaces it in the footer.
 * - Compact phones (< 700 pt): inline person actions, no progress, the waiting timer as the subtitle.
 * - Receipt: money card, You keep, Fare details collapsed, inline rating; the footer submits a
 *   chosen rating, retries once on failure, then goes back to Drive.
 * - The map draws the leg the driver is on; the receipt shows no vehicle.
 */
import React from 'react';
import { useWindowDimensions } from 'react-native';
import MockAdapter from 'axios-mock-adapter';
import { useNetInfo } from '@react-native-community/netinfo';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { expandTripSheet } from '../../../test-utils/tripSheet';
import { apiClient } from '../../../src/services/api';
import { resetRatingSessionState } from '../../../src/features/rating/hooks';
import { DriverTripSheet } from '../../../src/features/driver-ride/trip/DriverTripSheet';
import {
  driverCancelledCopy,
  driverEtaOf,
  driverMoneyOf,
  driverReceiptOf,
  driverTargetOf,
  driverTripHeader,
} from '../../../src/features/driver-ride/trip/driverTripModel';
import { driverFooterModel, footerHasContent } from '../../../src/features/driver-ride/trip/DriverTripFooter';
import { driverTripAnnouncement } from '../../../src/features/driver-ride/trip/useDriverTripMoments';
import { useDriverRideMap } from '../../../src/features/driver-ride/trip/useDriverRideMap';
import { setLocale } from '../../../src/i18n';
import '../../../src/i18n/copy-ur-Latn';
import { toast } from '../../../src/core/toast';
import type { RideResource, RideStopResource } from '../../../src/services/rideService';
import { makeRide } from '../../../test-utils/rideFixtures';
import { driverSheetProps } from '../../../test-utils/driverTripFixtures';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 402, height: 874, scale: 3, fontScale: 1 })),
}));
const mockWindow = useWindowDimensions as jest.MockedFunction<typeof useWindowDimensions>;
const mockNetInfo = useNetInfo as jest.MockedFunction<typeof useNetInfo>;

const passenger = { id: 9, name: 'Ayesha Khan', rating: 4.8 };

const stop = (overrides: Partial<RideStopResource> = {}): RideStopResource => ({
  id: 5,
  ride_id: 41,
  address: 'Fake stop, Lahore',
  latitude: 31.52,
  longitude: 74.35,
  stop_order: 1,
  status: 'active',
  status_label: 'Active',
  status_color: 'blue',
  created_at: '2026-10-20T10:00:00Z',
  updated_at: '2026-10-20T10:00:00Z',
  ...overrides,
});

const ride = (overrides: Partial<RideResource> = {}): RideResource =>
  makeRide({
    id: 41,
    status: 'accepted',
    passenger,
    pickup_address: 'Liberty Market, Gulberg III, Lahore',
    dropoff_address: 'Emporium Mall, Johar Town, Lahore',
    accepted_fare: '450.00' as unknown as number,
    ...overrides,
  });

const eta = (target: 'pickup' | 'dropoff', minutes = 6, km = 2.4) => ({ minutes, distance_km: km, target, updated_at: '2026-10-20T10:00:00Z' });

const renderSheet = (overrides: Parameters<typeof driverSheetProps>[0]) => render(<DriverTripSheet {...driverSheetProps(overrides)} />);

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mock.onGet('/rating-tags').reply(200, { success: true, data: { max_tags: 2, tags: { driver: { positive: [], negative: [] } } } });
  resetRatingSessionState();
  mockWindow.mockReturnValue({ width: 402, height: 874, scale: 3, fontScale: 1 });
  mockNetInfo.mockReturnValue({ isConnected: true, isInternetReachable: true } as ReturnType<typeof useNetInfo>);
});
afterEach(() => {
  mock.restore();
  setLocale('en');
  jest.restoreAllMocks();
});

describe('header model (DP2, DT2)', () => {
  const head = (step: Parameters<typeof driverTripHeader>[0]['step'], r: RideResource, extra: { offline?: boolean; weakGps?: boolean } = {}) =>
    driverTripHeader({ step, ride: r, offline: extra.offline ?? false, weakGps: extra.weakGps ?? false });

  it('to pickup: "Pick up {first name}", distance and cash fare, the server ETA', () => {
    expect(head('to_pickup', ride({ eta: eta('pickup') }))).toEqual({
      title: 'Pick up Ayesha',
      subtitle: '2.4 km away · Rs 450 cash',
      tone: 'textSecondary',
      icon: null,
      etaMinutes: 6,
    });
    // No ETA: no tile and no distance, never a guess.
    expect(head('to_pickup', ride())).toMatchObject({ subtitle: 'Rs 450 cash', etaMinutes: null });
    // An ETA for another target is not this one.
    expect(head('to_pickup', ride({ eta: eta('dropoff') })).etaMinutes).toBeNull();
    expect(head('to_pickup', ride({ passenger: undefined })).title).toBe('Head to pickup');
  });

  it('arrived: "Waiting for {name}" and the arrival time, no tile; a parcel waits for the sender', () => {
    const arrived = ride({ status: 'arrived', arrived_at: '2026-10-20T10:05:00Z', eta: eta('pickup') });
    const h = head('at_pickup', arrived);
    expect(h.title).toBe('Waiting for Ayesha');
    expect(h.subtitle).toMatch(/^You arrived at /);
    expect(h.etaMinutes).toBeNull();
    expect(head('at_pickup', ride({ status: 'arrived', vehicle_type: 'parcel', is_parcel: true })).title).toBe('Waiting for the sender');
  });

  it('on trip: a stop next has no tile (BE-128 targets the drop-off); the drop-off has it', () => {
    const withStop = ride({ status: 'started', stops: [stop()], eta: eta('dropoff') });
    expect(head('on_trip', withStop)).toMatchObject({ title: 'Head to stop 1', subtitle: 'Collect Rs 450 cash at the drop-off', etaMinutes: null });
    const toDropoff = ride({ status: 'started', stops: [stop({ status: 'completed' })], eta: eta('dropoff', 12, 5.1) });
    expect(head('on_trip', toDropoff)).toMatchObject({ title: 'Drop off Ayesha', subtitle: '5.1 km to go · Collect Rs 450 cash', etaMinutes: 12 });
  });

  it('offline replaces the subtitle in warning and hides the tile; weak GPS keeps the tile', () => {
    expect(head('to_pickup', ride({ eta: eta('pickup') }), { offline: true })).toMatchObject({
      subtitle: "You're offline. Actions will wait.",
      tone: 'warning',
      icon: 'offline',
      etaMinutes: null,
    });
    expect(head('on_trip', ride({ status: 'started' }), { offline: true }).subtitle).toBe("You're offline. Complete the trip when you're back online.");
    expect(head('to_pickup', ride({ eta: eta('pickup') }), { weakGps: true })).toMatchObject({ subtitle: 'Weak GPS signal', tone: 'warning', etaMinutes: 6 });
  });

  it('Roman Urdu', () => {
    setLocale('ur-Latn');
    expect(head('to_pickup', ride({ eta: eta('pickup') }))).toMatchObject({ title: 'Ayesha ko pick karein', subtitle: '2.4 km door · Rs 450 cash' });
    expect(head('at_pickup', ride({ status: 'arrived' })).title).toBe('Ayesha ka intezar');
  });
});

describe('target, ETA, money (TS6.1, TS6.3)', () => {
  it('the target is the pickup, then "Stop n of total", then the drop-off', () => {
    expect(driverTargetOf(ride(), 'to_pickup')).toMatchObject({ kind: 'pickup', label: 'Pickup', address: 'Liberty Market, Gulberg III, Lahore' });
    const two = ride({ status: 'started', stops: [stop({ status: 'completed' }), stop({ id: 6, stop_order: 2, address: 'Second stop' })] });
    expect(driverTargetOf(two, 'on_trip')).toMatchObject({ kind: 'stop', label: 'Stop 2 of 2', address: 'Second stop', stop: { n: 2, total: 2 } });
    expect(driverTargetOf(ride({ status: 'started' }), 'on_trip')).toMatchObject({ kind: 'dropoff', label: 'Drop-off' });
    expect(driverTargetOf(ride(), 'summary')).toBeNull();
  });

  it('a negative or missing ETA is hidden', () => {
    expect(driverEtaOf(ride({ eta: { ...eta('pickup'), minutes: -1 } }), 'to_pickup')).toBeNull();
    expect(driverEtaOf(ride({ eta: null }), 'to_pickup')).toBeNull();
  });

  it('the money card shows only the fields the server sent (BE-84)', () => {
    const split = ride({ fare: 450, booking_fee: 20, commission_rate: 10, commission_amount: 43, driver_net: 387 } as Partial<RideResource>);
    expect(driverMoneyOf(split)?.rows.map((r) => [r.label, r.value])).toEqual([
      ['Fare', 'Rs 450'],
      ['Booking fee (platform)', expect.stringContaining('20')],
      ['Commission (10%)', expect.stringContaining('43')],
      ['You keep', 'Rs 387'],
    ]);
    expect(driverMoneyOf(split)?.caption).toBe('Collect Rs 450 in cash at the drop-off.');
    // No split: the fare alone.
    expect(driverMoneyOf(ride())?.rows.map((r) => r.key)).toEqual(['fare']);
    expect(driverMoneyOf(ride({ accepted_fare: undefined, total_fare: undefined as unknown as number }))).toBeNull();
  });

  it('a rider cancel says so; anything else keeps the generic copy', () => {
    expect(driverCancelledCopy(ride({ status: 'cancelled', cancellation_reason: 'passenger' }), null)).toEqual({
      title: 'The rider cancelled',
      body: "You're back online.",
    });
    expect(driverCancelledCopy(ride({ status: 'requested' }), null).title).toBe('Ride cancelled');
  });
});

describe('footer model (DP3, DT3, TS8)', () => {
  const base = { pendingAction: null, startBlocked: false, arrivalRefusal: null, onArrived: jest.fn(), onStart: jest.fn(), onComplete: jest.fn(), onCompleteStop: jest.fn(), parcel: null, offline: false };

  it('one primary per step; Cancel is never in the footer', () => {
    expect(driverFooterModel({ ...base, ride: ride(), step: 'to_pickup' }).primary).toMatchObject({ kind: 'button', testID: 'driver-ride-arrived' });
    expect(driverFooterModel({ ...base, ride: ride({ status: 'arrived' }), step: 'at_pickup' }).primary).toMatchObject({ kind: 'slide', label: 'Slide to start trip' });
    const withStop = driverFooterModel({ ...base, ride: ride({ status: 'started', stops: [stop()] }), step: 'on_trip' });
    expect(withStop.primary).toMatchObject({ kind: 'button', label: 'Stop 1 done' });
    expect(driverFooterModel({ ...base, ride: ride({ status: 'started' }), step: 'on_trip' }).primary).toMatchObject({ kind: 'slide', label: 'Slide to complete trip' });
    [ride(), ride({ status: 'arrived' })].forEach((r) => {
      const m = driverFooterModel({ ...base, ride: r, step: r.status === 'accepted' ? 'to_pickup' : 'at_pickup' });
      expect(m.secondaries.map((s) => s.key)).not.toContain('cancel');
    });
  });

  it('the no-show joins the footer once offered; PIN blocked replaces the slide', () => {
    const noShow = driverFooterModel({ ...base, ride: ride({ status: 'arrived' }), step: 'at_pickup', onNoShow: jest.fn() });
    expect(noShow.secondaries.map((s) => s.testID)).toEqual(['driver-ride-no-show']);
    const blocked = driverFooterModel({ ...base, ride: ride({ status: 'arrived' }), step: 'at_pickup', startBlocked: true });
    expect(blocked.primary).toBeNull();
    expect(blocked.blocked).toBe(true);
    expect(footerHasContent(blocked)).toBe(true);
    expect(footerHasContent(driverFooterModel({ ...base, ride: ride(), step: 'summary' }))).toBe(false);
  });
});

describe('DriverTripSheet (rendered)', () => {
  it('to pickup: title, target row, Call · Message · Navigate in a row, "I\'ve arrived" in the footer, Cancel as a ghost in the details', () => {
    const onCancel = jest.fn();
    renderSheet({ ride: ride({ eta: eta('pickup') }), step: 'to_pickup', canCall: true, onMessage: jest.fn(), canNavigate: true, onCancel });
    expect(screen.getByTestId('driver-ride-title').props.children).toBe('Pick up Ayesha');
    expect(screen.getByTestId('driver-ride-header-eta-value', { includeHiddenElements: true }).props.children).toBe('6');
    expect(screen.getByTestId('driver-ride-target-label').props.children).toBe('Pickup');
    expect(screen.getByTestId('driver-ride-target-address').props.numberOfLines).toBe(2);
    expect(screen.getByTestId('driver-ride-progress')).toBeTruthy();
    expect(screen.getByTestId('driver-ride-navigate').props.accessibilityLabel).toBe('Navigate to the pickup in Maps');
    expect(screen.getByTestId('driver-ride-arrived')).toBeTruthy();
    // TS8: Cancel and the route card belong to `expanded`: hidden from screen readers at peek.
    expect(screen.queryByTestId('driver-ride-cancel')).toBeNull();
    expandTripSheet();
    const cancel = screen.getByTestId('driver-ride-cancel');
    fireEvent.press(cancel);
    expect(onCancel).toHaveBeenCalled();
    expect(screen.getByTestId('driver-ride-route-card')).toBeTruthy();
  });

  it('compact (< 700 pt): no progress, one-line target, inline person actions, timer folded into the subtitle', () => {
    mockWindow.mockReturnValue({ width: 375, height: 667, scale: 2, fontScale: 1 });
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-20T10:03:00Z'));
    renderSheet({
      ride: ride({
        status: 'arrived',
        arrived_at: '2026-10-20T10:00:00Z',
        arrival_verified: true,
        fare_policy: { fees_enabled: true, free_wait_minutes: 5, wait_per_minute: 5 },
      } as Partial<RideResource>),
      step: 'at_pickup',
      canCall: true,
    });
    expect(screen.queryByTestId('driver-ride-progress')).toBeNull();
    expect(screen.getByTestId('driver-ride-target-address').props.numberOfLines).toBe(1);
    expect(screen.queryByTestId('driver-ride-waiting')).toBeNull();
    expect(screen.getByTestId('driver-ride-subtitle').props.children).toMatch(/^Waiting 0?3:00/);
  });

  it('on trip at the drop-off: the slide waits while offline; no Cancel', () => {
    mockNetInfo.mockReturnValue({ isConnected: false, isInternetReachable: false } as ReturnType<typeof useNetInfo>);
    const onComplete = jest.fn();
    renderSheet({ ride: ride({ status: 'started' }), step: 'on_trip', onComplete });
    const slide = screen.getByTestId('driver-ride-complete');
    expect(slide.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent(slide, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.queryByTestId('driver-ride-cancel')).toBeNull();
  });

  it('the rider cancelled: the restyled state with "Back to Drive"', () => {
    const onDone = jest.fn();
    renderSheet({ ride: ride({ status: 'cancelled', cancellation_reason: 'passenger' }), step: 'cancelled', onDone });
    expect(screen.getByTestId('driver-ride-cancelled-title').props.children).toBe('The rider cancelled');
    fireEvent.press(screen.getByTestId('driver-ride-done'));
    expect(onDone).toHaveBeenCalled();
  });
});

describe('receipt (DC1, DC3)', () => {
  const completed = (overrides: Partial<RideResource> = {}) =>
    ride({
      status: 'completed',
      total_fare: 450,
      distance_km: 5.2,
      duration_minutes: 18,
      payment_method: 'cash',
      fare: 450,
      commission_rate: 10,
      commission_amount: 45,
      driver_net: 405,
      fare_breakdown: { base: 150, distance: 200, time: 100, stops: 0, min_fare_adjustment: 0, total: 450 },
      can_rate: true,
      my_rating: null,
      ...overrides,
    } as Partial<RideResource>);

  const pickStars = (n: number) => {
    const row = screen.getByTestId('rate-ride-stars-row');
    fireEvent(row, 'layout', { nativeEvent: { layout: { width: 240, height: 48 } } });
    act(() => {
      fireEvent(row, 'responderGrant', { nativeEvent: { locationX: n * 48 - 10 } });
    });
  };
  const flush = () => act(async () => new Promise<void>((resolve) => setTimeout(resolve, 0)));

  it('model: collect from the rider, You keep after the commission, metrics', () => {
    expect(driverReceiptOf(completed())).toMatchObject({ title: 'Trip complete', caption: 'Collect from Ayesha', total: 450, net: 405, rate: '10', cash: true, metrics: '5.2 km · 18 min' });
  });

  it('money card, You keep and the collapsed Fare details; "Cash collected" without a star goes back to Drive', async () => {
    const onDone = jest.fn();
    renderSheet({ ride: completed(), step: 'summary', onDone });
    await flush();
    expect(screen.getByTestId('driver-ride-total').props.children).toBe('Rs 450');
    expect(screen.getByTestId('driver-ride-earnings').props.children).toBe('Rs 405');
    expect(screen.getByText('after 10% commission')).toBeTruthy();
    expect(screen.queryByTestId('driver-ride-breakdown')).toBeNull();
    fireEvent.press(screen.getByTestId('driver-ride-fare-details'));
    expect(screen.getByTestId('driver-ride-commission')).toBeTruthy();
    expect(screen.getByTestId('receipt-rating')).toBeTruthy();
    expect(screen.queryByTestId('driver-ride-back')).toBeNull();
    fireEvent.press(screen.getByTestId('driver-ride-done'));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(mock.history.post).toHaveLength(0);
  });

  it('a chosen star is sent first, then the driver goes back to Drive with the ride patched', async () => {
    mock.onPost('/rides/41/rate').reply(201, { success: true, data: { my_rating: { stars: 4, tags: [], comment: null, created_at: '2026-10-20T10:30:00Z' }, can_rate: false } });
    const onDone = jest.fn();
    const onRatingChange = jest.fn();
    renderSheet({ ride: completed(), step: 'summary', onDone, onRatingChange });
    await flush();
    pickStars(4);
    await act(async () => {
      fireEvent.press(screen.getByTestId('driver-ride-done'));
    });
    await flush();
    expect(JSON.parse(mock.history.post[0].data)).toMatchObject({ stars: 4 });
    expect(onRatingChange).toHaveBeenCalledWith(41, expect.objectContaining({ can_rate: false }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('a failed rating is a toast and is retried once from the footer, then the driver moves on', async () => {
    const errorSpy = jest.spyOn(toast, 'error').mockImplementation(() => '');
    mock.onPost('/rides/41/rate').reply(500, { message: 'boom' });
    const onDone = jest.fn();
    renderSheet({ ride: completed(), step: 'summary', onDone });
    await flush();
    pickStars(5);
    await act(async () => {
      fireEvent.press(screen.getByTestId('driver-ride-done'));
    });
    await flush();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByTestId('driver-ride-done'));
    });
    await flush();
    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('offline: "Back to Drive", no rating is sent and a toast says so; a parcel says Done', async () => {
    const infoSpy = jest.spyOn(toast, 'info').mockImplementation(() => '');
    mockNetInfo.mockReturnValue({ isConnected: false, isInternetReachable: false } as ReturnType<typeof useNetInfo>);
    const onDone = jest.fn();
    const view = renderSheet({ ride: completed(), step: 'summary', onDone });
    await flush();
    pickStars(5);
    expect(screen.getByText('Back to Drive')).toBeTruthy();
    fireEvent.press(screen.getByTestId('driver-ride-done'));
    expect(onDone).toHaveBeenCalled();
    expect(mock.history.post).toHaveLength(0);
    expect(infoSpy).toHaveBeenCalledWith("You're offline, so your rating wasn't sent.", undefined, expect.anything());
    view.unmount();
    mockNetInfo.mockReturnValue({ isConnected: true, isInternetReachable: true } as ReturnType<typeof useNetInfo>);
    renderSheet({ ride: completed({ vehicle_type: 'parcel', is_parcel: true, can_rate: false }), step: 'summary' });
    await flush();
    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.queryByTestId('driver-ride-cash-badge')).toBeNull();
  });

  it('the completion announcement says what to collect and what the driver keeps', () => {
    expect(driverTripAnnouncement('summary', completed())).toBe('Trip complete. Collect Rs 450 in cash. You keep Rs 405.');
    // A parcel was paid at the pickup and a non-cash ride collects nothing: no "Collect" sentence.
    expect(driverTripAnnouncement('summary', completed({ vehicle_type: 'parcel', is_parcel: true }))).toBe('Trip complete. You keep Rs 405.');
    expect(driverTripAnnouncement('summary', completed({ payment_method: 'wallet' }))).toBe('Trip complete. You keep Rs 405.');
    expect(driverTripAnnouncement('at_pickup', ride({ status: 'arrived' }))).toBe("You've arrived. Waiting for Ayesha.");
  });
});

describe('map layers (TS2.1, DP5, DT5)', () => {
  it('to pickup: pickup pin, no drop-off; the receipt: both pins and no vehicle; on trip: stops and drop-off', async () => {
    const car = { latitude: 31.5, longitude: 74.3 };
    // The legs ask Directions once; let those answers settle inside act.
    const settle = () => act(async () => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    const toPickupHook = renderHook(() => useDriverRideMap(ride(), 'to_pickup', car));
    const toPickup = toPickupHook.result.current;
    expect(toPickup.pickup).not.toBeNull();
    expect(toPickup.dropoff).toBeNull();
    expect(toPickup.route).toEqual([]); // pins only while the leg loads, never a straight line
    expect(toPickup.showVehicle).toBe(true);
    await settle();
    toPickupHook.unmount();
    const onTripHook = renderHook(() => useDriverRideMap(ride({ status: 'started', stops: [stop()] }), 'on_trip', car));
    const onTrip = onTripHook.result.current;
    expect(onTrip.pickup).toBeNull();
    expect(onTrip.stops).toHaveLength(1);
    expect(onTrip.dropoff).not.toBeNull();
    await settle();
    onTripHook.unmount();
    const receipt = renderHook(() => useDriverRideMap(ride({ status: 'completed' }), 'summary', car)).result.current;
    expect(receipt).toMatchObject({ showVehicle: false, route: [] });
    expect(receipt.pickup).not.toBeNull();
    expect(receipt.dropoff).not.toBeNull();
  });
});
