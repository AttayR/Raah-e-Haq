/**
 * T-563 (T-561 follow-ups, docs/qa-reports/2026-10-16-t-560-r7-561-qa, screenshots 11 and 12):
 * 1. a refused parcel (sender) keeps the accepted / arrived steps; T-566 (BE-106): "Driver asked
 *    for more?" follows the server's `can_report` only (false on an unpaid cancelled parcel, true
 *    on a fee-charged one or a cancelled normal ride); a report already made keeps its status;
 * 2. the driver who refused a parcel sees a parcel message, not "Ride cancelled / no longer
 *    assigned to you";
 * 3. useVehicleTypes: a manual retry and the quiet focus re-read never free each other's
 *    in-flight flag (no second read while the retry runs), and a failed quiet read backs off.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { apiClient } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { CACHE_TTL, clearQueryCache } from '../../../src/core/api/queryCache';
import { toast } from '../../../src/core/toast';
import { toParcelView } from '../../../src/features/parcel/api';
import { parcelTimeline } from '../../../src/features/parcel/rules';
import ActiveRidePanel from '../../../src/features/active-ride/components/ActiveRidePanel';
import { advanceRideStage, type PassengerRideStageState } from '../../../src/features/active-ride/stage';
import { driverCancelledCopy } from '../../../src/components/driver/DriverRideCancelledCard';
import { setDriverActiveRide } from '../../../src/features/driver-ride/slice';
import { useVehicleTypes } from '../../../src/features/ride-booking/hooks';
import type { RideResource } from '../../../src/services/rideService';
import { envelope, makeRide, makeStore } from '../../../test-utils/rideFixtures';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true }),
  useIsFocused: () => true,
}));
// Required after the mock, so the screen sees it.
const DriverRideScreen = require('../../../src/screens/Driver/DriverRideScreen').default;

let mock: MockAdapter;
beforeEach(() => {
  clearQueryCache();
  mock = new MockAdapter(apiClient);
  jest.spyOn(toast, 'success').mockImplementation(() => '');
  jest.spyOn(toast, 'error').mockImplementation(() => '');
});
afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

/** The ride's `parcel` block (fake local data). */
const parcelBlock = (over: Record<string, unknown> = {}) => ({
  status: 'arrived',
  item_category: 'documents',
  item_category_label: 'Documents and papers',
  size_class: 'small',
  size_label: 'Small (fits in a bag)',
  max_weight_kg: 2,
  item_description: null,
  declared_value: 2500,
  receiver: { name: 'Sana Khan', phone_masked: '+92300*****67' },
  pickup_photo_url: null,
  picked_up_at: null,
  delivered_at: null,
  return_started_at: null,
  return_reason: null,
  returned_at: null,
  refusal_reason: null,
  code: null,
  can_call_receiver: false,
  ...over,
});

const parcelRide = (parcel: Record<string, unknown>, over: Partial<RideResource> = {}): RideResource =>
  makeRide({ vehicle_type: 'parcel', is_parcel: true, status: 'arrived', driver_id: 5, fare: '180.00', parcel, ...over });

const refusedRide = (over: Partial<RideResource> = {}) =>
  parcelRide(parcelBlock({ status: 'cancelled', refusal_reason: 'over_size' }), {
    status: 'cancelled',
    cancellation_reason: 'driver',
    // BE-106: nothing was paid on a refused parcel, so the server offers no report.
    overcharge_report: { can_report: false, report: null },
    ...over,
  });

const stateOf = (ride: RideResource): PassengerRideStageState => {
  const state = advanceRideStage(null, ride);
  if (!state) throw new Error('no stage');
  return state;
};

const showPanel = (ride: RideResource) =>
  render(
    <Provider store={makeStore()}>
      <ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={jest.fn()} onDone={jest.fn()} />
    </Provider>,
  );

describe('1. the sender of a refused parcel', () => {
  it('keeps the accepted and arrived steps before "Cancelled"', () => {
    const steps = (raw: Record<string, unknown>) => parcelTimeline(toParcelView(parcelBlock(raw))!).map((s) => `${s.key}:${s.state}`);
    expect(steps({ status: 'cancelled', refusal_reason: 'over_size' })).toEqual([
      'requested:done',
      'accepted:done',
      'arrived:done',
      'cancelled:current',
    ]);
    // Cancelled before a rider came (no refusal): only the request was reached.
    expect(steps({ status: 'cancelled' })).toEqual(['requested:done', 'cancelled:current']);
  });

  it('live panel: no "Driver asked for more?" when the server says can_report false; the timeline shows accepted / arrived', () => {
    mock.onGet('/parcels/options').reply(200, envelope({ refusal_reasons: [{ key: 'over_size', label: 'Larger than declared' }] }));
    showPanel(refusedRide());
    expect(screen.queryByTestId('active-ride-overcharge-button')).toBeNull();
    expect(screen.queryByTestId('active-ride-overcharge')).toBeNull();
    expect(screen.getByTestId('parcel-timeline-accepted-done')).toBeTruthy();
    expect(screen.getByTestId('parcel-timeline-arrived-done')).toBeTruthy();
    expect(screen.getByTestId('parcel-timeline-cancelled-current')).toBeTruthy();
  });

  it('T-566: a cancelled parcel the server lets the sender report (a fee was charged) shows the button', () => {
    mock.onGet('/parcels/options').reply(200, envelope({ refusal_reasons: [] }));
    showPanel(
      parcelRide(parcelBlock({ status: 'cancelled' }), {
        status: 'cancelled',
        cancellation_reason: 'passenger',
        cancellation_fee: '50.00',
        overcharge_report: { can_report: true, report: null },
      }),
    );
    expect(screen.getByTestId('active-ride-overcharge-button')).toBeTruthy();
  });

  it('T-566: a cancelled normal ride keeps the report', () => {
    showPanel(makeRide({ status: 'cancelled', driver_id: 5, cancellation_reason: 'passenger', overcharge_report: { can_report: true, report: null } }));
    expect(screen.getByTestId('active-ride-overcharge-button')).toBeTruthy();
  });

  it('a delivered parcel still offers the report', () => {
    showPanel(
      parcelRide(parcelBlock({ status: 'delivered', picked_up_at: '2026-10-16T10:00:00Z' }), {
        status: 'completed',
        overcharge_report: { can_report: true, report: null },
      }),
    );
    expect(screen.getByTestId('active-ride-overcharge-button')).toBeTruthy();
  });

  it('a report already made on a refused parcel keeps its status, without the button', () => {
    mock.onGet('/parcels/options').reply(200, envelope({ refusal_reasons: [] }));
    showPanel(
      refusedRide({
        overcharge_report: {
          can_report: false,
          report: { id: 3, status: 'open', asked_amount: 250, refund_amount: null, created_at: '2026-10-16T10:05:00Z' },
        },
      }),
    );
    expect(screen.getByTestId('active-ride-overcharge-status')).toBeTruthy();
    expect(screen.queryByTestId('active-ride-overcharge-button')).toBeNull();
  });
});

describe('2. the driver after refusing a parcel', () => {
  it('copy: refused, cancelled parcel, and a normal ride', () => {
    expect(driverCancelledCopy({ refusalReason: 'over_size' })).toEqual({
      title: 'Parcel refused',
      body: 'You refused this parcel at the pickup. The ride is cancelled with no strike, and you can take new requests.',
    });
    expect(driverCancelledCopy({ refusalReason: null }).title).toBe('Parcel cancelled');
    expect(driverCancelledCopy(null)).toEqual({ title: 'Ride cancelled', body: 'This ride is no longer assigned to you.' });
  });

  it('refuse on the ride screen ends on "Parcel refused", without a console warning or error', async () => {
    const warn = jest.spyOn(console, 'warn');
    const error = jest.spyOn(console, 'error');
    let server = parcelRide(parcelBlock());
    mock.onGet('/rides/41').reply(() => [200, envelope(server)]);
    mock.onGet('/driver/status').reply(200, envelope({ status: 'available', active_ride_id: null }));
    mock.onGet('/parcels/options').reply(200, envelope({ refusal_reasons: [{ key: 'over_size', label: 'Larger than declared' }] }));
    mock.onPost('/rides/41/parcel/refuse').reply(() => {
      server = refusedRide();
      return [200, envelope(server)];
    });
    const store = configureStore({ reducer: rootReducer });
    store.dispatch(setDriverActiveRide(server));
    render(
      <Provider store={store}>
        <DriverRideScreen />
      </Provider>,
    );
    await waitFor(() => expect(store.getState().driverRide.pendingAction).toBeNull());
    fireEvent.press(screen.getByTestId('driver-parcel-refuse'));
    await waitFor(() => screen.getByTestId('parcel-reason-over_size'));
    fireEvent.press(screen.getByTestId('parcel-reason-over_size'));
    fireEvent.press(screen.getByTestId('parcel-reason-submit'));
    await waitFor(() => screen.getByTestId('driver-ride-cancelled'));
    expect(screen.getByTestId('driver-ride-cancelled-title').props.children).toBe('Parcel refused');
    expect(screen.queryByText('This ride is no longer assigned to you.')).toBeNull();
    await waitFor(() => expect(mock.history.get.some((r) => r.url === '/driver/status')).toBe(true));
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});

describe('3. the vehicle catalogue re-read', () => {
  const fare = { currency: 'PKR', base_fare: 50, per_km: 25, per_min: 2, min_fare: 100, per_stop: 20 };
  const car = { key: 'car', label: 'Car', capacity: 4, icon: 'car', fare };
  const carAc = { key: 'car_ac', label: 'Car AC', capacity: 4, icon: 'car', fare };
  const typeGets = () => mock.history.get.filter((r) => r.url === '/public/vehicle-types');
  /** Lets a request that was started reach the adapter (the client's interceptors are async). */
  const settle = () =>
    act(async () => {
      for (let i = 0; i < 5; i += 1) await new Promise<void>((resolve) => setImmediate(() => resolve()));
    });

  /** Loads the catalogue once and lets it age past the recheck time. */
  const staleCatalogue = async () => {
    mock.onGet('/public/vehicle-types').replyOnce(200, envelope([car]));
    const first = renderHook(() => useVehicleTypes());
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    first.unmount();
    jest.setSystemTime(Date.now() + CACHE_TTL.vehicleTypesRecheck + 1000);
  };

  it('leaving the screen during a manual retry does not start a second read beside it', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    await staleCatalogue();
    let answer: ((value: [number, unknown]) => void) | null = null;
    // Every later read waits until the test answers it.
    mock.onGet('/public/vehicle-types').reply(
      () =>
        new Promise<[number, unknown]>((resolve) => {
          answer = resolve;
        }),
    );
    const { result, rerender } = renderHook(({ focused }: { focused: boolean }) => useVehicleTypes({ refreshWhen: focused }), {
      initialProps: { focused: true },
    });
    // The quiet read on focus.
    await waitFor(() => expect(typeGets()).toHaveLength(2));
    // A manual retry while it runs, then away (the quiet read is dropped) and back.
    act(() => result.current.retry());
    await waitFor(() => expect(typeGets()).toHaveLength(3));
    rerender({ focused: false });
    rerender({ focused: true });
    await settle();
    // The retry is still running: no fourth read.
    expect(typeGets()).toHaveLength(3);
    await act(async () => {
      answer?.([200, envelope([car, carAc])]);
    });
    await waitFor(() => expect(result.current.data?.map((t) => t.key)).toEqual(['car', 'car_ac']));
  });

  it('a failed quiet read waits a moment before the next focus asks again', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    await staleCatalogue();
    mock.onGet('/public/vehicle-types').replyOnce(500, { success: false, message: 'x' });
    const { result, rerender } = renderHook(({ focused }: { focused: boolean }) => useVehicleTypes({ refreshWhen: focused }), {
      initialProps: { focused: true },
    });
    await waitFor(() => expect(typeGets()).toHaveLength(2));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.data?.map((t) => t.key)).toEqual(['car']);

    // Refocused straight away: no new read.
    rerender({ focused: false });
    rerender({ focused: true });
    await settle();
    expect(typeGets()).toHaveLength(2);

    // After the back-off: one read, and the new tier shows.
    mock.onGet('/public/vehicle-types').reply(200, envelope([car, carAc]));
    jest.setSystemTime(Date.now() + CACHE_TTL.vehicleTypesRecheckBackoff + 1000);
    rerender({ focused: false });
    rerender({ focused: true });
    await waitFor(() => expect(result.current.data?.map((t) => t.key)).toEqual(['car', 'car_ac']));
    expect(typeGets()).toHaveLength(3);
  });
});
