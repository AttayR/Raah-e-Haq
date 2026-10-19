/**
 * T-405 (DRV-14/DRV-15): the driver ride screen walks pickup → arrived → start → stops →
 * complete on the BE-04 endpoints and shows the server's fare summary. Before, the screen was
 * not routed and start/complete sent a PUT with a client fare.
 */
import React from 'react';
import { Linking, Platform } from 'react-native';
import MockAdapter from 'axios-mock-adapter';
import * as Reanimated from 'react-native-reanimated';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../../src/services/api';
import { rootReducer } from '../../src/store/rootReducer';
import { selectDriverActiveRide, setDriverActiveRide } from '../../src/features/driver-ride/slice';
import type { RideResource, RideStopResource } from '../../src/services/rideService';
import DriverRideScreen from '../../src/screens/Driver/DriverRideScreen';
import { envelope, makeRide } from '../../test-utils/rideFixtures';
import { settleCancelSheet } from '../../test-utils/cancelSheet';
import { toast } from '../../src/core/toast';
import locationTrackingService from '../../src/services/locationTrackingService';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, canGoBack: () => true }),
  useIsFocused: () => true,
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

const passenger = { id: 9, name: 'Ayesha', rating: 4.8 };
/** BE-78 contact with a telephony provider (masked calls). */
const proxyContact = { can_chat: true, can_call: true, call_mode: 'proxy', closes_at: null };

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
  mockNavigate.mockReset();
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

    expect(screen.getByTestId('driver-ride-total').props.children).toBe('Rs 435');
    expect(screen.getByTestId('driver-ride-collect').props.children).toBe('Collect in cash');
    expect(screen.getByTestId('driver-ride-earnings').props.children).toBe('Rs 348');
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

  it('a 422 not_near_pickup shows the server message with the distance on the banner only, and keeps the Arrived button (T-409, T-554)', async () => {
    const errorSpy = jest.spyOn(toast, 'error').mockImplementation(() => '');
    const { store, screen } = renderScreen(makeRide({ status: 'accepted', passenger }));
    await settle(store);
    mock.onPost('/rides/41/arrived').reply(422, {
      success: false,
      message: 'You are too far from the pickup point.',
      error: { code: 'not_near_pickup', message: 'You are too far from the pickup point.', distance_m: 812.4, radius_m: 300 },
    });

    fireEvent.press(screen.getByTestId('driver-ride-arrived'));
    await waitFor(() => screen.getByTestId('driver-ride-arrival-refused'));
    screen.getByText('You are too far from the pickup point.');
    screen.getByText('About 812 m away.');
    await settle(store);
    // T-554: the banner says it; no toast on top of it.
    expect(errorSpy).not.toHaveBeenCalled();

    expect(screen.getByTestId('driver-ride-title').props.children).toBe('Head to pickup');
    expect(screen.getByTestId('driver-ride-arrived').props.accessibilityState).toMatchObject({ disabled: false });
    expect(selectDriverActiveRide(store.getState())?.status).toBe('accepted');
    // Nothing else was re-read or posted (no refetch loop, no status reload).
    expect(mock.history.post.filter((r) => r.url === '/rides/41/arrived')).toHaveLength(1);
    expect(mock.history.get.filter((r) => r.url === '/driver/status')).toHaveLength(0);
  });

  it('T-553: the refused arrival stays on the panel with the server reason and distance until a retry passes', async () => {
    jest.spyOn(toast, 'error').mockImplementation(() => '');
    const { store, screen } = renderScreen(makeRide({ status: 'accepted', passenger }));
    await settle(store);
    const reason = 'You are not at the pickup point yet. Get within 300 m of the pickup to mark arrived';
    mock.onPost('/rides/41/arrived').replyOnce(422, {
      success: false,
      message: reason,
      error: { code: 'not_near_pickup', message: reason, distance_m: 451.6, radius_m: 300 },
    });

    fireEvent.press(screen.getByTestId('driver-ride-arrived'));
    await waitFor(() => screen.getByTestId('driver-ride-arrival-refused'));
    screen.getByText(`${reason}.`);
    screen.getByText('About 452 m away.');

    mock.onPost('/rides/41/arrived').replyOnce(200, envelope(makeRide({ status: 'arrived', passenger })));
    fireEvent.press(screen.getByTestId('driver-ride-arrived'));
    await waitFor(() => expect(screen.getByTestId('driver-ride-title').props.children).toBe('Waiting for the passenger'));
    expect(screen.queryByTestId('driver-ride-arrival-refused')).toBeNull();
  });

  it('refreshes a stale location ping once before calling arrived (T-409)', async () => {
    const order: string[] = [];
    jest.spyOn(locationTrackingService, 'pingIfStale').mockImplementation(async (maxAgeMs: number) => {
      order.push(`ping:${maxAgeMs}`);
    });
    const { store, screen } = renderScreen(makeRide({ status: 'accepted', passenger }));
    await settle(store);
    mock.onPost('/rides/41/arrived').reply(() => {
      order.push('arrived');
      return [200, envelope(makeRide({ status: 'arrived', passenger }))];
    });

    fireEvent.press(screen.getByTestId('driver-ride-arrived'));
    await waitFor(() => expect(screen.getByTestId('driver-ride-title').props.children).toBe('Waiting for the passenger'));

    expect(order).toEqual(['ping:20000', 'arrived']);
  });

  it('cancel needs a 3-character reason and sends it as the note', async () => {
    const { store, screen } = renderScreen(makeRide({ status: 'accepted', passenger }));
    await settle(store);
    mock.onPost('/rides/41/cancel').reply(200, envelope(makeRide({ status: 'cancelled' })));

    fireEvent.press(screen.getByTestId('driver-ride-cancel'));
    const clock = settleCancelSheet();
    fireEvent.changeText(screen.getByTestId('cancel-reason-input'), 'no');
    fireEvent.press(screen.getByTestId('cancel-reason-submit'));
    expect(screen.getByTestId('cancel-reason-error').props.children).toBe('Please write at least 3 characters.');
    // T-577: the error and the counter sit in the sticky footer (above the keyboard), not under
    // the field where the footer covered them while typing; the field shows the error once.
    const footer = screen.getByTestId('cancel-reason-sheet-footer');
    expect(within(footer).getByTestId('cancel-reason-error')).toBeTruthy();
    expect(within(footer).getByTestId('cancel-reason-counter').props.children).toBe('2/500');
    expect(screen.getAllByText('Please write at least 3 characters.')).toHaveLength(1);
    expect(mock.history.post).toHaveLength(0);

    fireEvent.changeText(screen.getByTestId('cancel-reason-input'), 'Flat tyre');
    fireEvent.press(screen.getByTestId('cancel-reason-submit'));

    await waitFor(() => expect(selectDriverActiveRide(store.getState())).toBeNull());
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ note: 'Flat tyre' });
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    clock.mockRestore();
  });

  it('[T-577] the no-show sheet reads the ride once on opening and shows only the fee the server will charge (BE-109)', async () => {
    const success = jest.spyOn(toast, 'success');
    const cancelAt = '2026-01-01T00:00:00Z'; // long past: "Passenger didn't come" is offered
    const arrived = (preview: RideResource['no_show_preview']) =>
      makeRide({ status: 'arrived', passenger, no_show_cancel_at: cancelAt, fare_policy: { fees_enabled: true, cancel_fee: 50 }, no_show_preview: preview });
    const { store, screen } = renderScreen(arrived({ fee: 50, fee_applies: true, capped: false, verified: true }));
    await settle(store);
    const readsBefore = mock.history.get.filter((r) => r.url === '/rides/41').length;

    // Since the arrival a daily cap made it free: the re-read on opening says so.
    serverRide = arrived({ fee: 0, fee_applies: false, capped: true, verified: true });
    fireEvent.press(screen.getByTestId('driver-ride-no-show'));
    await settle(store);
    expect(mock.history.get.filter((r) => r.url === '/rides/41')).toHaveLength(readsBefore + 1);
    expect(screen.getByTestId('cancel-reason-no-show-no-fee')).toBeTruthy();
    expect(screen.queryByTestId('cancel-reason-no-show-fee')).toBeNull();
    // The rate card (fare_policy.cancel_fee 50) is not a promise.
    expect(screen.queryByText(/Rs 50/)).toBeNull();

    // After the cancel, the fee comes from the answer (here the server did charge it).
    mock.onPost('/rides/41/cancel').reply(200, envelope(makeRide({ status: 'cancelled', cancellation_fee: '50.00', cancellation_charge_reason: 'no_show' })));
    const clock = settleCancelSheet();
    fireEvent.press(screen.getByTestId('cancel-reason-submit'));
    await waitFor(() => expect(selectDriverActiveRide(store.getState())).toBeNull());
    expect(success).toHaveBeenCalledWith(
      'Ride cancelled.',
      'The passenger was charged Rs 50 for this cancellation. Your share shows in your wallet once it is credited.',
      expect.anything(),
    );
    clock.mockRestore();
  });

  it('[T-577] while the open-time read is in flight the sheet shows no fee line (never a stale amount)', async () => {
    const preview = { fee: 50, fee_applies: true, capped: false, verified: true };
    const { store, screen } = renderScreen(
      makeRide({ status: 'arrived', passenger, no_show_cancel_at: '2026-01-01T00:00:00Z', no_show_preview: preview }),
    );
    await settle(store);
    // Before the sheet opens the held ride says Rs 50; the server now says it is free.
    let answer: ((value: [number, unknown]) => void) | null = null;
    mock.onGet('/rides/41').reply(() => new Promise<[number, unknown]>((resolve) => (answer = resolve)));
    fireEvent.press(screen.getByTestId('driver-ride-no-show'));
    expect((store.getState() as ReturnType<typeof rootReducer>).driverRide.pendingAction).toBe('refresh');
    expect(screen.queryByTestId('cancel-reason-no-show-fee')).toBeNull();
    expect(screen.queryByTestId('cancel-reason-no-show-no-fee')).toBeNull();
    expect(screen.queryByText(/Rs 50/)).toBeNull();

    // The request reaches the adapter asynchronously: wait until it is held.
    await waitFor(() => expect(answer).not.toBeNull());
    expect(screen.queryByTestId('cancel-reason-no-show-fee')).toBeNull();
    await act(async () => {
      answer?.([200, envelope(makeRide({ status: 'arrived', passenger, no_show_cancel_at: '2026-01-01T00:00:00Z', no_show_preview: { ...preview, fee: 0, fee_applies: false, capped: true } }))]);
    });
    await settle(store);
    expect(screen.getByTestId('cancel-reason-no-show-no-fee')).toBeTruthy();
    expect(screen.queryByText(/Rs 50/)).toBeNull();
  });

  it('[T-577] a free cancel says no amount, and an older server (no preview) promises none', async () => {
    const success = jest.spyOn(toast, 'success');
    const { store, screen } = renderScreen(
      makeRide({ status: 'arrived', passenger, no_show_cancel_at: '2026-01-01T00:00:00Z', fare_policy: { fees_enabled: true, cancel_fee: 50 } }),
    );
    await settle(store);
    fireEvent.press(screen.getByTestId('driver-ride-no-show'));
    await settle(store);
    expect(screen.queryByTestId('cancel-reason-no-show-fee')).toBeNull();
    expect(screen.queryByTestId('cancel-reason-no-show-no-fee')).toBeNull();

    mock.onPost('/rides/41/cancel').reply(200, envelope(makeRide({ status: 'cancelled', cancellation_fee: '0.00' })));
    const clock = settleCancelSheet();
    fireEvent.press(screen.getByTestId('cancel-reason-submit'));
    await waitFor(() => expect(selectDriverActiveRide(store.getState())).toBeNull());
    expect(success).toHaveBeenCalledWith('Ride cancelled.', undefined, expect.anything());
    clock.mockRestore();
  });

  it('[T-520] Call asks POST /call and dials the masked number; Navigate opens the maps app', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    openURL.mockClear();
    const { store, screen } = renderScreen(makeRide({ status: 'accepted', passenger, contact: proxyContact }));
    await settle(store);
    mock.onPost('/rides/41/call').reply(200, envelope({ mode: 'proxy', number: '+922100000001', expires_at: 'x', contact_closes_at: null }));

    fireEvent.press(screen.getByTestId('driver-ride-call'));
    await waitFor(() => expect(openURL).toHaveBeenCalledWith('tel:%2B922100000001'));
    expect(mock.history.post.filter((r) => r.url === '/rides/41/call')).toHaveLength(1);

    // A failed call is fixed by tapping again: a fresh POST /call (never a cached number).
    fireEvent.press(screen.getByTestId('driver-ride-call'));
    await waitFor(() => expect(mock.history.post.filter((r) => r.url === '/rides/41/call')).toHaveLength(2));

    fireEvent.press(screen.getByTestId('driver-ride-navigate'));
    const expected = Platform.OS === 'ios' ? 'http://maps.apple.com/' : 'https://www.google.com/maps/dir/';
    const navigateUrl = openURL.mock.calls.map((c) => c[0]).find((u) => u.includes('31.52%2C74.35'));
    expect(navigateUrl).toContain(expected);
    // Never a tel: built from a phone on the ride.
    openURL.mock.calls.forEach(([url]) => expect(url).not.toContain('923001234567'));
  });

  it('[T-520] chat-only calls open the ride chat with a note', async () => {
    const infoSpy = jest.spyOn(toast, 'info').mockImplementation(() => '');
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    openURL.mockClear();
    const { store, screen } = renderScreen(makeRide({ status: 'accepted', passenger, contact: proxyContact }));
    await settle(store);
    mock.onPost('/rides/41/call').reply(200, envelope({ mode: 'chat_only', contact_closes_at: null }));

    fireEvent.press(screen.getByTestId('driver-ride-call'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('RideChat', { rideId: 41 }));
    expect(infoSpy).toHaveBeenCalledWith("Calls aren't available right now. Send a message instead.", undefined, { topOffset: 64 });
    expect(openURL).not.toHaveBeenCalled();
  });

  it('[T-520] no Call button unless the server says contact.can_call', async () => {
    const { store, screen } = renderScreen(
      makeRide({ status: 'accepted', passenger, contact: { can_chat: true, can_call: false, call_mode: 'chat_only', closes_at: null } }),
    );
    await settle(store);
    expect(screen.queryByTestId('driver-ride-call')).toBeNull();
    screen.getByTestId('driver-ride-message');
  });

  it('shows "Ride cancelled" when the passenger cancels, without the driver acting (T-413)', async () => {
    jest.useFakeTimers();
    try {
      const { store, screen } = renderScreen(makeRide({ status: 'accepted', passenger }));
      await settle(store);
      expect(screen.queryByTestId('driver-ride-cancelled')).toBeNull();

      serverRide = makeRide({ status: 'cancelled', passenger });
      await act(async () => {
        jest.advanceTimersByTime(8000);
      });
      await waitFor(() => screen.getByTestId('driver-ride-cancelled'));
      expect(screen.getByText('Ride cancelled')).toBeTruthy();
      // The driver posted nothing: the poll only read the ride.
      expect(mock.history.post).toHaveLength(0);
      expect(mockGoBack).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('[T-519] Back from the summary is Done: the completed ride is cleared and the screen leaves', async () => {
    const { store, screen } = renderScreen(makeRide({ status: 'completed', passenger, can_rate: false }));
    await settle(store);
    screen.getByTestId('driver-ride-summary');
    fireEvent.press(screen.getByTestId('driver-ride-back'));
    expect(selectDriverActiveRide(store.getState())).toBeNull();
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });

  it('[T-519] a swipe-back off the summary (unmount) also clears the completed ride', async () => {
    const { store, screen } = renderScreen(makeRide({ status: 'completed', passenger, can_rate: false }));
    await settle(store);
    screen.getByTestId('driver-ride-summary');
    screen.unmount();
    expect(selectDriverActiveRide(store.getState())).toBeNull();
  });

  it('[T-519] Back during a live ride keeps the ride (Resume ride stays on Home)', async () => {
    const { store, screen } = renderScreen(makeRide({ status: 'started', passenger }));
    await settle(store);
    fireEvent.press(screen.getByTestId('driver-ride-back'));
    expect(mockGoBack).toHaveBeenCalled();
    screen.unmount();
    expect(selectDriverActiveRide(store.getState())?.status).toBe('started');
  });

  it('[T-562] a parcel sheet slides out through visible when the ride stops being a parcel ride (never unmounted while up)', async () => {
    // Springs run until the test finishes them, so "still sliding out" can be seen.
    const running: Array<(finished?: boolean) => void> = [];
    jest.spyOn(Reanimated, 'withSpring').mockImplementation(((toValue: number, _config: unknown, callback?: (finished?: boolean) => void) => {
      if (callback) running.push(callback);
      return toValue;
    }) as unknown as typeof Reanimated.withSpring);
    const finishSprings = () => act(() => running.splice(0).forEach(done => done(true)));
    const parcel = {
      status: 'picked_up',
      item_category: 'documents',
      item_category_label: 'Documents and papers',
      size_class: 'small',
      size_label: 'Small (fits in a bag)',
      max_weight_kg: 2,
      item_description: 'Two books',
      declared_value: 2500,
      receiver: { name: 'Sana Khan', phone: null, phone_masked: '+92300*****67' },
      pickup_photo_url: null,
      code: { digits: 6, purpose: 'delivery', sent: true, send_count: 1, sends_left: 2, sms_failed: false, can_resend: false, resend_available_at: null, attempts_left: 5, locked_until: null, blocked: false, delivery_blocked: false },
      can_call_receiver: false,
    };
    const parcelRide = makeRide({ vehicle_type: 'parcel', is_parcel: true, status: 'started', driver_id: 5, passenger, parcel, fare: '180.00' } as Partial<RideResource>);
    const { store, screen } = renderScreen(parcelRide);
    await settle(store);
    fireEvent.press(screen.getByTestId('driver-parcel-deliver'));
    await act(async () => {});
    screen.getByTestId('parcel-code-sheet');
    finishSprings();

    // The ride comes back without its parcel block: the panel goes, the open sheet must close
    // with its animation (before, the sheets were unmounted with the Modal still presented).
    serverRide = makeRide({ status: 'started', driver_id: 5, passenger });
    act(() => {
      store.dispatch(setDriverActiveRide(serverRide));
    });
    await act(async () => {});
    expect(screen.queryByTestId('driver-parcel-deliver')).toBeNull();
    expect(screen.getByTestId('parcel-code-sheet')).toBeTruthy(); // sliding out
    finishSprings();
    await act(async () => {});
    expect(screen.queryByTestId('parcel-code-sheet')).toBeNull();
  });

  it('[T-567] at a parcel pickup the driver waits for the sender, and the arrival toast names the sender', async () => {
    const success = jest.spyOn(toast, 'success');
    const parcel = {
      status: 'accepted',
      item_category: 'documents',
      item_category_label: 'Documents and papers',
      size_class: 'small',
      size_label: 'Small (fits in a bag)',
      max_weight_kg: 2,
      item_description: 'Two books',
      declared_value: 2500,
      receiver: { name: 'Sana Khan', phone: null, phone_masked: '+92300*****67' },
      pickup_photo_url: null,
      code: null,
      can_call_receiver: false,
    };
    const parcelRide = (status: string) =>
      makeRide({ vehicle_type: 'parcel', is_parcel: true, status, driver_id: 5, passenger, parcel, fare: '180.00' } as Partial<RideResource>);
    const { store, screen } = renderScreen(parcelRide('accepted'));
    await settle(store);
    mock.onPost('/rides/41/arrived').reply(200, envelope(parcelRide('arrived')));
    serverRide = parcelRide('arrived');
    fireEvent.press(screen.getByTestId('driver-ride-arrived'));
    await waitFor(() => expect(screen.getByTestId('driver-ride-title').props.children).toBe('Waiting for the sender'));
    expect(success).toHaveBeenCalledWith('The sender knows you have arrived.', undefined, expect.anything());
    expect(success).not.toHaveBeenCalledWith('The passenger knows you have arrived.', undefined, expect.anything());
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
