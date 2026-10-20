/**
 * T-579 (QA 2026-10-19 leftovers): the registration role cards follow a live language switch;
 * parcel cancels are said as a delivery (sender's searching cancel, the cancellation card); the
 * nearby-drivers line, the receipt labels and payment status, and the plate placeholder are in
 * Roman Urdu; one tier name across booking and Activity; and nothing in the driver's cancel or
 * start path can end in an unhandled promise rejection.
 */
import React from 'react';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { setLocale, t } from '../../src/i18n';
import { resetLanguagePreferenceForTests } from '../../src/i18n/languagePreference';
import '../../src/i18n/copy-ur-Latn';
import RoleStep from '../../src/screens/Auth/steps/RoleStep';
import { NearbyCountChip } from '../../src/features/nearby-vehicles';
import { useSharedValue } from 'react-native-reanimated';
import type { NearbyDriversState } from '../../src/hooks/useNearbyDrivers';
import { REGISTRATION_FIELDS } from '../../src/features/auth/copy/registrationFields';
import { cancellationText, paymentStatusLabel, RIDE_HISTORY_COPY, tierLabel } from '../../src/features/ride-history/copy';
import {
  CancellationCard,
  cancellationChargeText,
  receiptPaymentStatus,
} from '../../src/features/ride-history/components/RideDetailsSections';
import { toRide } from '../../src/features/ride-history/api';
import type { Ride } from '../../src/features/ride-history/types';
import ActiveRidePanel from '../../src/features/active-ride/components/ActiveRidePanel';
import { advanceRideStage } from '../../src/features/active-ride/stage';
import { cancelConfirmBody, usePassengerCancel } from '../../src/features/active-ride/cancel';
import { dialog, dialogStore } from '../../src/core/dialog';
import { toVehicleOptions } from '../../src/features/ride-booking/vehicleOptions';
import { footerRowLabels } from '../../src/features/driver-ride/footerLayout';
import { toast } from '../../src/core/toast';
import { driverRideApi } from '../../src/features/driver-ride/api';
import { useDriverRideFlow } from '../../src/features/driver-ride/hooks';
import { selectDriverActiveRide, setDriverActiveRide } from '../../src/features/driver-ride/slice';
import { driverStatusApi } from '../../src/features/driver-status/api';
import { usePinGate } from '../../src/features/safety/usePinGate';
import { makeRide, makeStore, type TestStore } from '../../test-utils/rideFixtures';

afterEach(() => {
  resetLanguagePreferenceForTests();
  jest.restoreAllMocks();
});

describe('1. registration role cards follow a live language switch', () => {
  it('re-renders the card titles and bodies in the new language without a remount', () => {
    const onChange = jest.fn();
    const { rerender } = render(<RoleStep value={null} onChange={onChange} />);
    expect(screen.getByText('I want to ride')).toBeTruthy();
    act(() => setLocale('ur-Latn'));
    rerender(<RoleStep value={null} onChange={onChange} />);
    // Before T-579 the module-level list kept the English it was built with.
    expect(screen.getByText('Mujhe ride karni hai')).toBeTruthy();
    expect(screen.getByText('Mujhe drive karna hai')).toBeTruthy();
    expect(screen.queryByText('I want to ride')).toBeNull();
  });
});

describe('2. parcel cancels are said as a delivery', () => {
  const parcelRequested = makeRide({ id: 61, status: 'requested', vehicle_type: 'parcel', is_parcel: true });

  it('the sender searching for a rider sees "Cancel delivery" (a ride: "Cancel request", UI-R10)', () => {
    const state = advanceRideStage(null, parcelRequested);
    if (!state) throw new Error('no stage');
    render(<ActiveRidePanel stageState={state} ride={parcelRequested} onCancel={jest.fn()} />);
    expect(screen.getByTestId('active-ride-cancel')).toHaveTextContent('Cancel delivery');
    // A parcel shows its own block, not the ride's searching card.
    expect(screen.queryByTestId('searching-trip-card')).toBeNull();

    const ride = makeRide({ id: 62, status: 'requested' });
    const rideState = advanceRideStage(null, ride);
    if (!rideState) throw new Error('no stage');
    screen.rerender(<ActiveRidePanel stageState={rideState} ride={ride} onCancel={jest.fn()} />);
    expect(screen.getByTestId('active-ride-cancel')).toHaveTextContent('Cancel request');

    const accepted = makeRide({ id: 64, status: 'accepted', driver_id: 5, driver: { id: 5, name: 'Ali', rating: 4.9 } });
    const acceptedState = advanceRideStage(null, accepted);
    if (!acceptedState) throw new Error('no stage');
    screen.rerender(<ActiveRidePanel stageState={acceptedState} ride={accepted} onCancel={jest.fn()} />);
    expect(screen.getByTestId('active-ride-cancel')).toHaveTextContent('Cancel ride');
  });

  it('UI-R10: before a driver takes it, the cancel question is about the request', async () => {
    const { result } = renderHook(() => usePassengerCancel(makeRide({ status: 'requested' }), jest.fn(), jest.fn()));
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current();
    });
    await waitFor(() => expect(dialogStore.getCurrent()).not.toBeNull());
    expect(dialogStore.getCurrent()).toMatchObject({
      title: 'Cancel request?',
      body: "We'll stop looking for a driver.",
      confirmLabel: 'Cancel request',
      cancelLabel: 'Keep looking',
      destructive: true,
    });
    act(() => dialog.dismissAll());
    await act(async () => {
      await pending;
    });
    setLocale('ur-Latn');
    expect(cancelConfirmBody(makeRide({ status: 'requested' }), true)).toBe('Hum driver dhoondna band kar denge.');
  });

  it('the cancel question asks about the delivery, in Roman Urdu too', async () => {
    expect(cancelConfirmBody(parcelRequested)).toBe('Are you sure you want to cancel this delivery?');
    expect(cancelConfirmBody(makeRide({ status: 'requested' }))).toBe('Are you sure you want to cancel this ride?');
    setLocale('ur-Latn');
    const { result } = renderHook(() => usePassengerCancel(parcelRequested, jest.fn(), jest.fn()));
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current();
    });
    await waitFor(() => expect(dialogStore.getCurrent()).not.toBeNull());
    expect(dialogStore.getCurrent()).toMatchObject({
      title: 'Delivery cancel karein',
      body: 'Kya aap waqai ye delivery cancel karna chahte hain?',
      confirmLabel: 'Delivery cancel karein',
      cancelLabel: 'Delivery rakhein',
    });
    act(() => dialog.dismissAll());
    await act(async () => {
      await pending;
    });
  });

  it('the cancellation card says who cancelled the delivery and that it was not charged', () => {
    const parcel = toRide(
      makeRide({ id: 63, status: 'cancelled', vehicle_type: 'parcel', is_parcel: true, cancellation_reason: 'driver' }),
    ) as Ride;
    expect(cancellationText('driver', 'driver', true)).toBe('You cancelled this delivery.');
    expect(cancellationText('passenger', 'passenger', true)).toBe('You cancelled this delivery.');
    expect(cancellationText('passenger', 'driver', true)).toBe('The sender cancelled this delivery.');
    expect(cancellationChargeText(parcel, 'driver')).toBe('Cancelled deliveries are not charged.');
    render(<CancellationCard ride={parcel} viewer="driver" />);
    expect(screen.getByTestId('ride-details-cancellation-text')).toHaveTextContent('You cancelled this delivery.');
    expect(screen.getByTestId('ride-details-cancellation-charge')).toHaveTextContent('Cancelled deliveries are not charged.');
    // A ride keeps its own lines.
    expect(cancellationText('driver', 'driver')).toBe('You cancelled this ride.');
    setLocale('ur-Latn');
    expect(cancellationText('driver', 'driver', true)).toBe('Aap ne ye delivery cancel ki.');
    expect(cancellationChargeText(parcel, 'passenger')).toBe('Cancel deliveries ka koi charge nahi.');
  });

  it('the driver at a parcel pickup: a short "Cancel" only when "Cancel delivery" does not fit its half row', () => {
    // The full label is the button's accessibility label either way (DriverRidePanel).
    const actions = [
      { label: t('parcel.refuse'), shortLabel: t('parcel.refuseShort') },
      { label: t('parcel.cancelDelivery'), shortLabel: 'Cancel' },
    ];
    expect(footerRowLabels(actions, 402)).toEqual(['Refuse parcel', 'Cancel']);
    expect(footerRowLabels(actions, 600)).toEqual(['Refuse parcel', 'Cancel delivery']);
  });
});

describe('3. nearby drivers line in the active language', () => {
  // T-586: the line became the map count chip (map-vehicles.md §4 copy).
  const Chip = ({ state }: { state: NearbyDriversState }) => {
    const sheet = useSharedValue(0);
    return <NearbyCountChip state={state} freshness="fresh" sheetHeight={sheet} />;
  };
  it('loading, none, one and many in Roman Urdu', () => {
    setLocale('ur-Latn');
    const driver = { id: 'a', vehicle_type: 'car' as const, distance_km: 1, estimated_arrival_min: 2, location: { latitude: 31.5, longitude: 74.3 }, heading: null };
    const { rerender } = render(<Chip state={{ drivers: [], status: 'loading', error: null }} />);
    expect(screen.getByText('Qareeb drivers dhoond rahe hain…')).toBeTruthy();
    rerender(<Chip state={{ drivers: [], status: 'ready', error: null }} />);
    expect(screen.getByText('Abhi aap ke qareeb koi driver online nahi')).toBeTruthy();
    rerender(<Chip state={{ drivers: [driver], status: 'ready', error: null }} />);
    expect(screen.getByText('1 driver aap ke qareeb online hai')).toBeTruthy();
    rerender(<Chip state={{ drivers: [driver, { ...driver, id: 'b' }], status: 'ready', error: null }} />);
    expect(screen.getByText('2 drivers aap ke qareeb online hain')).toBeTruthy();
  });
});

describe('4. receipt labels, payment status and the plate placeholder', () => {
  it('Roman Urdu labels and a translated payment status (unknown statuses title-cased)', () => {
    expect(paymentStatusLabel('paid')).toBe('Paid');
    setLocale('ur-Latn');
    expect(RIDE_HISTORY_COPY.receipt).toBe('Raseed');
    expect(RIDE_HISTORY_COPY.paymentMethod).toBe('Adaigi');
    expect(RIDE_HISTORY_COPY.paymentStatus).toBe('Adaigi ki surat');
    expect(paymentStatusLabel('paid')).toBe('Ada ho gaya');
    expect(paymentStatusLabel('PENDING')).toBe('Baqi');
    expect(paymentStatusLabel('partly_paid')).toBe('Partly paid');
    expect(paymentStatusLabel(null)).toBeNull();
    expect(receiptPaymentStatus({ status: 'completed', paymentStatus: 'paid', cancellationFee: null })).toBe('Ada ho gaya');
    expect(REGISTRATION_FIELDS.vehicle.vehicleNumberPlaceholder).toBe('ABC-1234 ya ABC-1234-D');
  });
});

describe('5. one tier name across the app', () => {
  const types = [
    { key: 'car' as const, label: 'Raah Mini', capacity: 4 },
    { key: 'car_ac' as const, label: 'AC gaari', capacity: 4, ac: true },
  ];

  it('the server name wins (BE-112: translated stock names, admin names as typed); a missing one falls back to VEHICLE_LABEL', () => {
    expect(tierLabel('car', 'Raah Mini')).toBe('Raah Mini');
    expect(tierLabel('car', '  ')).toBe('Car');
    expect(tierLabel('car', null)).toBe('Car');
    setLocale('ur-Latn');
    expect(tierLabel('car', 'Raah Mini')).toBe('Raah Mini');
    expect(tierLabel('car', null)).toBe('Gaari');
    expect(tierLabel('car_ac', undefined)).toBe('AC gaari');
    expect(tierLabel('tuk_tuk', null)).toBe('Tuk tuk');
    expect(toVehicleOptions(types, null).map((o) => o.name)).toEqual(['Raah Mini', 'AC gaari']);
    setLocale('en');
    expect(toVehicleOptions(types, null).map((o) => o.name)).toEqual(['Raah Mini', 'AC gaari']);
  });
});

describe('6. no unhandled rejection on the driver cancel and start paths', () => {
  const wrapperFor = (store: TestStore) =>
    function Wrapper({ children }: React.PropsWithChildren) {
      return <Provider store={store}>{children}</Provider>;
    };

  it('a requeued cancel resolves true even when the toast throws (the screen has already left)', async () => {
    jest.spyOn(driverStatusApi, 'get').mockResolvedValue({ status: 'available', activeRideId: null, changedAt: null });
    const accepted = makeRide({ id: 71, status: 'accepted', driver_id: 5 });
    jest.spyOn(driverRideApi, 'get').mockResolvedValue(accepted);
    // Requeue: the server answers with the ride back in the queue, no driver.
    jest.spyOn(driverRideApi, 'cancel').mockResolvedValue({ ...accepted, status: 'requested', driver_id: undefined, driver: undefined });
    jest.spyOn(toast, 'success').mockImplementation(() => {
      throw new Error('toast host gone');
    });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = makeStore();
    store.dispatch(setDriverActiveRide(accepted));
    const { result } = renderHook(() => useDriverRideFlow(), { wrapper: wrapperFor(store) });
    await waitFor(() => expect(store.getState().driverRide.pendingAction).toBeNull());
    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.cancel('Flat tyre');
    });
    expect(outcome).toBe(true);
    expect(selectDriverActiveRide(store.getState())).toBeNull();
  });

  it('a start that fails is caught by the PIN gate (plain start and with the PIN) and says so', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = jest.spyOn(toast, 'error').mockImplementation(() => '');
    const start = jest.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => usePinGate({ id: 1, pin_required: false, pin_blocked: false }, start));
    await act(async () => {
      result.current.onStartPressed();
      result.current.submit('1234');
      for (let i = 0; i < 5; i += 1) await Promise.resolve();
    });
    expect(start).toHaveBeenCalledTimes(2);
    expect(result.current.submitting).toBe(false);
    // Both rejections were handled (logged), not left to the runtime's unhandled-rejection warning.
    const messages = warn.mock.calls.map((call) => String(call[0]));
    expect(messages.some((m) => m.includes('Start trip failed'))).toBe(true);
    expect(messages.some((m) => m.includes('Start trip with PIN failed'))).toBe(true);
    expect(error).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith('Could not update the ride. Please try again.');
  });
});
