/**
 * T-583 (BE-114): a request the server ended with `cancellation_reason: no_driver` shows "No
 * driver found" ("No rider found" for a parcel), no fee line and no report offer; Try again books
 * the same trip as a new attempt (new Idempotency-Key), Close goes Home; history and receipts read
 * "No driver found · No charge"; a `no_driver` push opens that ride (its outcome while Booking
 * still holds it, else its details). English and Roman Urdu.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import rideService, { type RideResource } from '../../../src/services/rideService';
import ActiveRidePanel from '../../../src/features/active-ride/components/ActiveRidePanel';
import { NoDriverActions } from '../../../src/features/active-ride/components/FindingDriver';
import { advanceRideStage, isNoDriverCancel } from '../../../src/features/active-ride/stage';
import { useActiveRideActions } from '../../../src/features/active-ride/hooks';
import { useNoDriverRetry } from '../../../src/features/active-ride/noDriver';
import { rebookRequestFor, rememberedBooking } from '../../../src/features/active-ride/lastBooking';
import { createActiveRide, refreshActiveRide } from '../../../src/features/active-ride/slice';
import { confirmPassengerLiveRide } from '../../../src/features/notifications/liveRideTarget';
import { resolveNotificationTarget } from '../../../src/features/notifications/routing';
import { toAppNotification, toPushPayload } from '../../../src/features/notifications/api';
import { toRide } from '../../../src/features/ride-history/api';
import { cancellationText } from '../../../src/features/ride-history/copy';
import { rideAmountText, receiptShareText } from '../../../src/features/ride-history/format';
import { RideHistoryRow } from '../../../src/features/ride-history/components/RideHistoryRow';
import { toHomeRecentRides } from '../../../src/features/ride-history/recentRides';
import { bumpSessionEpoch } from '../../../src/store/sessionEpoch';
import { CLIENT_ID_PATTERN } from '../../../src/features/chat/clientId';
import { setLocale } from '../../../src/i18n';
import { resetLanguagePreferenceForTests } from '../../../src/i18n/languagePreference';
import '../../../src/i18n/copy-ur-Latn';
import { envelope, makeRide, makeRideRequest, makeStore } from '../../../test-utils/rideFixtures';

const noop = () => undefined;
const noDriverRide = (overrides: Partial<RideResource> = {}) =>
  makeRide({
    status: 'cancelled',
    cancellation_reason: 'no_driver',
    cancellation_fee: '0.00',
    cancelled_at: '2026-10-19T10:10:00Z',
    // Even if a server ever offered it, there is no driver to report.
    overcharge_report: { can_report: true, report: null },
    ...overrides,
  } as Partial<RideResource>);
const stateOf = (ride: RideResource) => advanceRideStage(null, ride)!;

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
});
afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
  resetLanguagePreferenceForTests();
  setLocale('en');
});

describe('"No driver found" on the ride panel', () => {
  it('a no_driver cancel has its own state: no fee line, no report offer', () => {
    const ride = noDriverRide();
    expect(isNoDriverCancel(ride)).toBe(true);
    expect(isNoDriverCancel(makeRide({ status: 'cancelled', cancellation_reason: 'passenger' }))).toBe(false);
    render(<ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={noop} />);
    expect(screen.getByTestId('active-ride-no-driver')).toBeTruthy();
    expect(screen.getByTestId('active-ride-title').props.children).toBe('No driver found');
    expect(screen.getByTestId('active-ride-subtitle').props.children).toBe('No driver accepted your ride in time. You were not charged.');
    expect(screen.queryByText(/fee/i)).toBeNull();
    expect(screen.queryByTestId('active-ride-overcharge')).toBeNull();
    expect(screen.queryByText('Ride cancelled')).toBeNull();
  });

  it('a parcel says "No rider found"; Roman Urdu', () => {
    const parcel = noDriverRide({ vehicle_type: 'parcel', is_parcel: true } as Partial<RideResource>);
    const { rerender } = render(<ActiveRidePanel stageState={stateOf(parcel)} ride={parcel} onCancel={noop} />);
    expect(screen.getByTestId('active-ride-title').props.children).toBe('No rider found');
    setLocale('ur-Latn');
    const ride = noDriverRide();
    rerender(<ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={noop} />);
    expect(screen.getByTestId('active-ride-title').props.children).toBe('Koi driver nahi mila');
  });

  it('the footer: Try again (primary) and Close', () => {
    const onRetry = jest.fn();
    const onClose = jest.fn();
    render(<NoDriverActions onRetry={onRetry} onClose={onClose} />);
    fireEvent.press(screen.getByTestId('active-ride-try-again'));
    fireEvent.press(screen.getByTestId('active-ride-close'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Try again')).toBeTruthy();
    expect(screen.getByText('Close')).toBeTruthy();
  });
});

describe('Try again books the same trip with a new key', () => {
  const renderRetry = (store: ReturnType<typeof makeStore>, onNothing = jest.fn()) => {
    const wrapper = ({ children }: React.PropsWithChildren) => <Provider store={store}>{children}</Provider>;
    return renderHook(
      () => {
        const { requestRide } = useActiveRideActions();
        const ride = store.getState().activeRide.ride;
        return useNoDriverRetry(ride, requestRide, onNothing);
      },
      { wrapper },
    );
  };

  it('sends the remembered body again with a fresh Idempotency-Key; the new ride replaces the expired one', async () => {
    const store = makeStore();
    const request = makeRideRequest({ offered_fare: 210, female_driver_only: true });
    mock.onPost('/rides').replyOnce(201, envelope(makeRide({ id: 41 })));
    await store.dispatch(createActiveRide({ ...request, idempotencyKey: 'first-key-1' }));
    expect(rememberedBooking(41)).toEqual(request);
    mock.onGet('/rides/41').replyOnce(200, envelope(noDriverRide({ id: 41 })));
    await store.dispatch(refreshActiveRide(41));
    expect(isNoDriverCancel(store.getState().activeRide.ride)).toBe(true);

    mock.onPost('/rides').replyOnce(201, envelope(makeRide({ id: 42 })));
    const { result } = renderRetry(store);
    await act(async () => {
      result.current.retry();
    });
    await act(async () => {
      await Promise.resolve();
    });
    const second = mock.history.post[1];
    expect(JSON.parse(second.data)).toEqual(request);
    expect(second.headers?.['Idempotency-Key']).toMatch(CLIENT_ID_PATTERN);
    expect(second.headers?.['Idempotency-Key']).not.toBe('first-key-1');
    expect(store.getState().activeRide.ride?.id).toBe(42);
    expect(result.current.retrying).toBe(false);
  });

  it('without a remembered body (a relaunch) a ride is rebuilt from itself; a parcel cannot be', () => {
    const ride = noDriverRide({
      id: 90,
      is_offer: true,
      offered_fare: '220.00',
      stops: [{ id: 1, ride_id: 90, address: 'Fake Stop', latitude: 31.5, longitude: 74.32, stop_order: 1, status: 'active' } as RideResource['stops'][number]],
    } as Partial<RideResource>);
    expect(rebookRequestFor(ride)).toEqual({
      pickup_address: 'Fake Pickup Street',
      dropoff_address: 'Fake Dropoff Road',
      pickup_latitude: 31.52,
      pickup_longitude: 74.35,
      dropoff_latitude: 31.48,
      dropoff_longitude: 74.3,
      vehicle_type: 'car',
      stops: [{ address: 'Fake Stop', latitude: 31.5, longitude: 74.32, stop_order: 1 }],
      offered_fare: 220,
    });
    expect(rebookRequestFor(noDriverRide({ id: 91, vehicle_type: 'parcel', is_parcel: true } as Partial<RideResource>))).toBeNull();
  });

  it('a parcel with nothing to resend runs the fallback and sends nothing', async () => {
    const store = makeStore();
    const parcel = noDriverRide({ id: 93, vehicle_type: 'parcel', is_parcel: true } as Partial<RideResource>);
    jest.spyOn(rideService, 'createRide').mockResolvedValueOnce(makeRide({ id: 93, vehicle_type: 'parcel' }));
    await store.dispatch(createActiveRide(makeRideRequest()));
    bumpSessionEpoch(); // signed out and in again: the remembered body is gone
    mock.onGet('/rides/93').replyOnce(200, envelope(parcel));
    const onNothing = jest.fn();
    const create = jest.spyOn(rideService, 'createRide');
    const { result } = renderHook(() => useNoDriverRetry(parcel, jest.fn(), onNothing));
    act(() => result.current.retry());
    expect(onNothing).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1); // only the first booking above
    expect(rememberedBooking(93)).toBeNull();
  });
});

describe('history and receipts', () => {
  const historyRide = (overrides: Partial<RideResource> = {}) => toRide(noDriverRide(overrides))!;

  it('"No driver found · No charge" (parcel: rider), and the cancellation line', () => {
    expect(rideAmountText(historyRide(), 'passenger')).toBe('No driver found · No charge');
    expect(rideAmountText(historyRide({ vehicle_type: 'parcel', is_parcel: true } as Partial<RideResource>), 'passenger')).toBe(
      'No rider found · No charge',
    );
    expect(cancellationText('no_driver', 'passenger')).toBe('No driver accepted this ride in time.');
    expect(cancellationText('no_driver', 'passenger', true)).toBe('No rider accepted this delivery in time.');
    expect(receiptShareText(historyRide(), 'passenger')).toContain('No driver found · No charge');
  });

  it('T-586 design review: the short Home recent-ride fare slot says "No charge" (not cut off)', () => {
    expect(toHomeRecentRides([historyRide({ id: 62 })])[0].fare).toBe('No charge');
  });

  it('the history row shows the label without a "Cancelled" pill; Roman Urdu', () => {
    const ride = historyRide({ id: 61 });
    const { rerender } = render(<RideHistoryRow ride={ride} viewer="passenger" onPress={noop} />);
    expect(screen.getByTestId('ride-history-row-61-amount').props.children).toBe('No driver found · No charge');
    expect(screen.queryByTestId('ride-history-row-61-status')).toBeNull();
    setLocale('ur-Latn');
    rerender(<RideHistoryRow ride={{ ...ride }} viewer="passenger" onPress={noop} />);
    expect(screen.getByTestId('ride-history-row-61-amount').props.children).toBe('Koi driver nahi mila · Koi charge nahi');
  });
});

describe('a no_driver ride_cancelled notification', () => {
  it('push data and list rows read `reason: no_driver`', () => {
    expect(toPushPayload({ type: 'ride_cancelled', ride_id: '41', reason: 'no_driver', requeued: 'false', ride_status: 'cancelled' }).noDriver).toBe(true);
    expect(toPushPayload({ type: 'ride_cancelled', ride_id: '41', requeued: 'false' }).noDriver).toBeFalsy();
    const row = toAppNotification({ id: 5, type: 'ride_cancelled', category: 'ride', data: { ride_id: 41, cancelled_by: 'system', reason: 'no_driver', requeued: false } });
    expect(row?.data.noDriver).toBe(true);
  });

  it('routes to that ride (not the history list) for the passenger', () => {
    const source = { category: 'ride' as const, type: 'ride_cancelled', rideId: 41, rideStatus: 'cancelled', noDriver: true };
    expect(resolveNotificationTarget(source, 'passenger')).toEqual({ kind: 'ride', rideId: 41 });
    expect(resolveNotificationTarget({ ...source, noDriver: false }, 'passenger')).toEqual({ kind: 'rideHistory' });
  });

  it('opens the "No driver found" state while Booking holds that ride, else its details', async () => {
    const store = makeStore();
    jest.spyOn(rideService, 'createRide').mockResolvedValueOnce(makeRide({ id: 41 }));
    await store.dispatch(createActiveRide(makeRideRequest()));
    jest.spyOn(rideService, 'getRide').mockResolvedValueOnce(noDriverRide({ id: 41 }));
    await store.dispatch(refreshActiveRide(41));
    await expect(confirmPassengerLiveRide({ kind: 'ride', rideId: 41 }, store)).resolves.toEqual({ kind: 'ride', rideId: 41 });

    mock.onGet('/rides').reply(200, envelope([]));
    const fresh = makeStore();
    await expect(confirmPassengerLiveRide({ kind: 'ride', rideId: 41 }, fresh)).resolves.toEqual({ kind: 'rideDetails', rideId: 41 });
  });
});
