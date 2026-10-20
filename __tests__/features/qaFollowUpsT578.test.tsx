/**
 * T-578 (QA 2026-10-19, docs/qa-reports/2026-10-19-t574-t577-uir15b-qa):
 * 1. passenger Home keeps the live ride fresh (status poll while focused), so a driver cancel
 *    clears "Return to your ride"; no driver-location reads there, nothing while unfocused;
 * 2. the driver's history row and details header show the no-show fee the passenger paid;
 * 3. every refused "Send parcel" scrolls to the topmost red field (also the declaration);
 * 4. parcel wording: details title, rate button, cash line, driver cancel toast;
 * 5. a cancelled (not refused) parcel keeps the accepted / arrived steps it reached;
 * 6. the no-show cancel toast's message is short enough for the toast's two lines.
 */
import React from 'react';
import type { View } from 'react-native';
import { Provider } from 'react-redux';
import MockAdapter from 'axios-mock-adapter';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import { apiClient } from '../../src/services/api';
import { toast } from '../../src/core/toast';
import { setLocale, t } from '../../src/i18n';
import '../../src/i18n/copy-ur-Latn';
import { liveRideStatusText } from '../../src/features/active-ride/status';
import PassengerHomeScreen from '../../src/screens/Passenger/PassengerHomeScreen';
import { createActiveRide } from '../../src/features/active-ride/slice';
import { ACTIVE_RIDE_POLL_MS, useActiveRideStatusPolling } from '../../src/features/active-ride/hooks';
import { toRide } from '../../src/features/ride-history/api';
import { paymentMethodText, rideAmountText } from '../../src/features/ride-history/format';
import { RideHistoryRow } from '../../src/features/ride-history/components/RideHistoryRow';
import { SummaryCard } from '../../src/features/ride-history/components/RideDetailsSections';
import type { Ride } from '../../src/features/ride-history/types';
import { toParcelOptions } from '../../src/features/parcel/api';
import { parcelTimeline } from '../../src/features/parcel/rules';
import { PARCEL_FIELD_SCROLL_OFFSET, useSendParcel } from '../../src/features/parcel/useSendParcel';
import { driverRideApi } from '../../src/features/driver-ride/api';
import { useDriverRideFlow } from '../../src/features/driver-ride/hooks';
import { setDriverActiveRide } from '../../src/features/driver-ride/slice';
import { driverStatusApi } from '../../src/features/driver-status/api';
import type { RideResource } from '../../src/services/rideService';
import { envelope, makeRide, makeRideRequest, makeStore, type TestStore } from '../../test-utils/rideFixtures';

jest.mock('../../src/services/placesService', () => ({
  fetchAutocomplete: jest.fn(() => Promise.resolve([])),
  fetchPlaceDetails: jest.fn(),
  reverseGeocode: jest.fn(() => Promise.resolve('Fake Street, Lahore')),
}));
let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() }),
  useIsFocused: () => mockFocused,
}));

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mockFocused = true;
});
afterEach(() => {
  mock.restore();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const withRide = (status: RideResource['status']) => {
  const store = makeStore();
  store.dispatch(createActiveRide.fulfilled(makeRide({ id: 21, status, driver_id: 5 }), 'req', makeRideRequest()));
  return store;
};
const wrapperFor = (store: TestStore) =>
  function Wrapper({ children }: React.PropsWithChildren) {
    return <Provider store={store}>{children}</Provider>;
  };
const rideGets = () => mock.history.get.filter((r) => r.url === '/rides/21');
const locationGets = () => mock.history.get.filter((r) => r.url === '/rides/21/driver-location');

describe('1. passenger Home keeps the live ride fresh', () => {
  const flush = async () => {
    await act(async () => {
      for (let i = 0; i < 8; i += 1) await Promise.resolve();
    });
  };
  const renderHome = async (store: TestStore) => {
    render(
      <Provider store={store}>
        <ThemeProvider>
          <PassengerHomeScreen />
        </ThemeProvider>
      </Provider>,
    );
    await flush();
  };

  it('a driver cancel seen by the poll clears "Return to your ride"', async () => {
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21, status: 'cancelled', driver_id: 5, cancellation_reason: 'driver' })));
    const store = withRide('accepted');
    await renderHome(store);
    await waitFor(() => expect(store.getState().activeRide.ride?.status).toBe('cancelled'));
    expect(screen.queryByTestId('home-return-to-ride')).toBeNull();
    // Status only: Home has no driver marker, so no driver-location reads.
    expect(locationGets()).toHaveLength(0);
  });

  it('a requeued ride (back to searching) stays on the card with the new status', async () => {
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21, status: 'requested' })));
    await renderHome(withRide('accepted'));
    await waitFor(() => expect(screen.getByTestId('home-live-ride-status')).toHaveTextContent(liveRideStatusText('requested')));
    expect(screen.getByTestId('home-return-to-ride')).toBeTruthy();
  });

  it('nothing is read while Home is covered (Booking polls then)', async () => {
    mockFocused = false;
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21, status: 'accepted', driver_id: 5 })));
    await renderHome(withRide('accepted'));
    expect(rideGets()).toHaveLength(0);
  });
});

describe('1b. useActiveRideStatusPolling', () => {
  it('reads at once, then on the ride cadence, never the driver location, and stops on a final status', async () => {
    jest.useFakeTimers();
    mock
      .onGet('/rides/21')
      .replyOnce(200, envelope(makeRide({ id: 21, status: 'accepted', driver_id: 5 })))
      .onGet('/rides/21')
      .replyOnce(200, envelope(makeRide({ id: 21, status: 'cancelled', driver_id: 5 })));
    const store = withRide('accepted');
    renderHook(() => useActiveRideStatusPolling(true), { wrapper: wrapperFor(store) });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(rideGets()).toHaveLength(1);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(ACTIVE_RIDE_POLL_MS - 1);
    });
    expect(rideGets()).toHaveLength(1);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(store.getState().activeRide.ride?.status).toBe('cancelled');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(ACTIVE_RIDE_POLL_MS * 5);
    });
    expect(rideGets()).toHaveLength(2);
    expect(locationGets()).toHaveLength(0);
  });

  it('does nothing while disabled', async () => {
    jest.useFakeTimers();
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21, status: 'accepted' })));
    renderHook(() => useActiveRideStatusPolling(false), { wrapper: wrapperFor(withRide('accepted')) });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(ACTIVE_RIDE_POLL_MS * 3);
    });
    expect(rideGets()).toHaveLength(0);
  });
});

describe('2. the driver sees the no-show fee the passenger paid', () => {
  const noShow = toRide(makeRide({ id: 241, status: 'cancelled', cancellation_fee: '50.00', cancellation_charge_reason: 'no_show' })) as Ride;

  it('history row: "Rs 50 fee", not "No charge"', async () => {
    expect(rideAmountText(noShow, 'driver')).toBe('Rs\u00A050 fee');
    render(
      <ThemeProvider>
        <RideHistoryRow ride={noShow} viewer="driver" onPress={jest.fn()} />
      </ThemeProvider>,
    );
    expect(await screen.findByTestId('ride-history-row-241-amount')).toHaveTextContent('Rs 50 fee');
  });

  it('details header: the fee and its label', async () => {
    render(
      <ThemeProvider>
        <SummaryCard ride={noShow} viewer="driver" />
      </ThemeProvider>,
    );
    expect(await screen.findByTestId('ride-details-amount')).toHaveTextContent('Rs 50');
    expect(screen.getByTestId('ride-details-fee-label')).toHaveTextContent('Cancellation fee');
  });
});

describe('3. a refused "Send parcel" scrolls to the topmost red field, every time', () => {
  const options = toParcelOptions({
    tier_active: true,
    vehicle_type: 'parcel',
    currency: 'PKR',
    max_declared_value: 10000,
    categories: [{ key: 'documents', label: 'Documents' }],
    sizes: [{ key: 'small', label: 'Small', max_weight_kg: 2 }],
    prohibited_items: ['Weapons'],
    declaration: 'I confirm the parcel holds none of the prohibited items.',
    rules_version: '2026-10-16',
    code_digits: 6,
  });
  const handlers = { onBooked: jest.fn(), onPhoneNotVerified: jest.fn(), onBalanceOwed: jest.fn(), onRulesChanged: jest.fn() };
  const at = (y: number) => ({ measureLayout: (_c: unknown, ok: (x: number, y: number) => void) => ok(0, y) }) as unknown as View;

  it('the second submit scrolls again to the off-screen declaration checkbox', async () => {
    mock.onPost('/rides/estimate').reply(200, envelope({ distance_km: 4, duration_min: 10, estimates: [] }));
    const { result } = renderHook(() => useSendParcel(options, { latitude: 31.52, longitude: 74.35 }, handlers), {
      wrapper: wrapperFor(makeStore()),
    });
    const scrollTo = jest.fn();
    (result.current.scrollRef as { current: unknown }).current = { scrollTo };
    (result.current.containerRef as { current: unknown }).current = {};
    result.current.containerY.current = 8;
    act(() => {
      result.current.anchor('pickup')(at(0));
      result.current.anchor('receiverName')(at(300));
      result.current.anchor('declaration')(at(1200));
      result.current.update('receiverName', 'Ali Raza', 'receiverName');
      result.current.update('receiverPhone', '3001234567', 'receiverPhone');
      result.current.update('itemCategory', 'documents', 'itemCategory');
      result.current.update('sizeClass', 'small', 'sizeClass');
      result.current.update('declaredValue', '2500', 'declaredValue');
      result.current.setDropoff({ latitude: 31.5, longitude: 74.3, address: 'Liberty, Lahore' });
    });
    await waitFor(() => expect(result.current.pickup).not.toBeNull());

    await act(async () => {
      await result.current.submit();
    });
    expect(Object.keys(result.current.errors).filter((k) => result.current.errors[k as 'declaration'])).toEqual(['declaration']);
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ y: 8 + 1200 - PARCEL_FIELD_SCROLL_OFFSET, animated: true }));
    expect(scrollTo).toHaveBeenCalledTimes(1);

    // The sender scrolled back up and pressed again: the same (already red) field is shown again.
    await act(async () => {
      await result.current.submit();
    });
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(2));
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 8 + 1200 - PARCEL_FIELD_SCROLL_OFFSET, animated: true });
  });

  it('with several red fields it goes to the topmost one', async () => {
    mock.onPost('/rides/estimate').reply(200, envelope({ distance_km: 4, duration_min: 10, estimates: [] }));
    const { result } = renderHook(() => useSendParcel(options, null, handlers), { wrapper: wrapperFor(makeStore()) });
    const scrollTo = jest.fn();
    (result.current.scrollRef as { current: unknown }).current = { scrollTo };
    (result.current.containerRef as { current: unknown }).current = {};
    result.current.containerY.current = 8;
    act(() => {
      result.current.anchor('receiverName')(at(300));
      result.current.anchor('declaration')(at(1200));
    });
    await act(async () => {
      await result.current.submit();
    });
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ y: 8 + 300 - PARCEL_FIELD_SCROLL_OFFSET, animated: true }));
  });
});

describe('4. parcel wording', () => {
  const parcelRide = toRide(makeRide({ id: 242, status: 'completed', vehicle_type: 'parcel', is_parcel: true })) as Ride;
  const carRide = toRide(makeRide({ id: 243, status: 'completed' })) as Ride;

  it('the cash line says it was paid at the pickup; a ride keeps "paid to driver"', () => {
    expect(paymentMethodText(parcelRide, 'passenger')).toBe('Cash (paid at the pickup)');
    expect(paymentMethodText(parcelRide, 'driver')).toBe('Cash (collected at the pickup)');
    expect(paymentMethodText(carRide, 'passenger')).toBe('Cash (paid to driver)');
  });

  it('details title, rate button, cancel button and toast have parcel copy', () => {
    expect(t('parcel.detailsTitle')).toBe('Delivery details');
    expect(t('parcel.rateThisDelivery')).toBe('Rate this delivery');
    expect(t('parcel.cancelDelivery')).toBe('Cancel delivery');
    expect(t('parcel.cancelledDone')).toBe('Delivery cancelled.');
  });

  it('a driver cancel on a parcel toasts "Delivery cancelled." with the short fee line', async () => {
    const success = jest.spyOn(toast, 'success').mockImplementation(() => '');
    jest.spyOn(driverStatusApi, 'get').mockResolvedValue({ status: 'available', activeRideId: null, changedAt: null });
    const parcel = makeRide({ id: 51, status: 'arrived', vehicle_type: 'parcel', is_parcel: true, driver_id: 5 });
    jest.spyOn(driverRideApi, 'get').mockResolvedValue(parcel);
    jest.spyOn(driverRideApi, 'cancel').mockResolvedValue({ ...parcel, status: 'cancelled', cancellation_fee: '50.00' });
    const store = makeStore();
    store.dispatch(setDriverActiveRide(parcel));
    const { result } = renderHook(() => useDriverRideFlow(), { wrapper: wrapperFor(store) });
    await waitFor(() => expect(store.getState().driverRide.pendingAction).toBeNull());
    await act(async () => {
      await result.current.cancel('Sender is not at the pickup');
    });
    expect(success).toHaveBeenCalledWith('Delivery cancelled.', 'Sender charged Rs\u00A050. Your share comes to your wallet.', expect.anything());
  });
});

describe('5. a cancelled (not refused) parcel keeps the steps it reached', () => {
  const cancelled = { status: 'cancelled' as const, pickedUpAt: null, returnStartedAt: null, refusalReason: null };
  const keys = (times?: { acceptedAt?: string | null; arrivedAt?: string | null }) =>
    parcelTimeline(cancelled, times).map((s) => `${s.key}:${s.state}`);

  it('accepted and arrived when the ride has their times', () => {
    expect(keys({ acceptedAt: '2026-10-19T09:50:00Z', arrivedAt: '2026-10-19T09:55:00Z' })).toEqual([
      'requested:done',
      'accepted:done',
      'arrived:done',
      'cancelled:current',
    ]);
    expect(keys({ acceptedAt: '2026-10-19T09:50:00Z', arrivedAt: null })).toEqual(['requested:done', 'accepted:done', 'cancelled:current']);
    expect(keys()).toEqual(['requested:done', 'cancelled:current']);
  });
});

describe('6. the no-show cancel toast fits its two lines', () => {
  afterEach(() => setLocale('en'));

  it('the fee line is short in both languages, and the parcel copy is in Roman Urdu too', () => {
    const fee = 'Rs 1,500';
    const keys = ['driverFare.cancelFeeToast', 'driverFare.cancelFeeToastParcel'] as const;
    for (const key of keys) expect(t(key, { amount: fee }).length).toBeLessThanOrEqual(70);
    setLocale('ur-Latn');
    for (const key of keys) expect(t(key, { amount: fee }).length).toBeLessThanOrEqual(70);
    expect(t('driverFare.cancelFeeToast', { amount: 'Rs 50' })).toBe('Sawari se Rs 50 liye gaye. Aap ka hissa wallet mein aayega.');
    expect(t('parcel.detailsTitle')).toBe('Delivery ki tafseel');
    expect(t('parcel.rateThisDelivery')).toBe('Is delivery ko rate karein');
    expect(t('parcel.paymentCashSender')).toBe('Cash (pickup par diya)');
    expect(t('parcel.paymentCashDriver')).toBe('Cash (pickup par liya)');
    expect(t('parcel.cancelDelivery')).toBe('Delivery cancel karein');
    expect(t('parcel.cancelledDone')).toBe('Delivery cancel ho gayi.');
  });
});
