/**
 * T-561 (QA T-522 follow-ups, docs/qa-reports/2026-10-16-t-522-qa):
 * 1. after the pickup the driver is told the fare was paid at the pickup (banner and the
 *    trip-complete card), not to collect cash; the sender's final card says the same;
 * 2. a parcel refused at the pickup tells the sender so, with the reason (live panel, receipt);
 * 3. the sender at the pickup is told to hand the parcel over and pay the fare;
 * 4. the parcel form: the footer steps aside while the keyboard is up, the receiver's number
 *    pad has a Done bar, the place search reveals its group;
 * 5. history says "Car AC" (not "Car ac"); Home shows "Send a parcel" in the peek chip row;
 * 6. the driver's active ride shows the AC badge and a neutral women-mode marker;
 * 7. a long plate shrinks to fit instead of being cut off;
 * 8. the vehicle catalogue is re-read on focus once a few minutes old (one read, no burst).
 */
import React from 'react';
import { Keyboard } from 'react-native';
import MockAdapter from 'axios-mock-adapter';
import { Provider } from 'react-redux';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react-native';
import { apiClient } from '../../../src/services/api';
import { CACHE_TTL, clearQueryCache } from '../../../src/core/api/queryCache';
import { toParcelOptions, toParcelView } from '../../../src/features/parcel/api';
import { DriverParcelSection } from '../../../src/features/parcel/components/DriverParcelSection';
import { ParcelDetailsSection } from '../../../src/features/parcel/components/ParcelDetailsSection';
import { EMPTY_PARCEL_DRAFT } from '../../../src/features/parcel/rules';
import ActiveRidePanel from '../../../src/features/active-ride/components/ActiveRidePanel';
import { advanceRideStage, type PassengerRideStageState } from '../../../src/features/active-ride/stage';
import { DriverRideSummary } from '../../../src/components/driver/DriverRideSummary';
import { DriverRidePanel } from '../../../src/components/driver/DriverRidePanel';
import { CancellationCard } from '../../../src/features/ride-history/components/RideDetailsSections';
import { toRide } from '../../../src/features/ride-history/api';
import { vehicleLabel } from '../../../src/features/ride-history/copy';
import { HomeSheetBody } from '../../../src/features/passenger-home/components/HomeSheet';
import { PersonCard, PLATE_MIN_FONT_SCALE } from '../../../src/components/ui/ride/PersonCard';
import { useVehicleTypes } from '../../../src/features/ride-booking/hooks';
import type { RideResource } from '../../../src/services/rideService';
import { envelope, makeRide, makeStore } from '../../../test-utils/rideFixtures';

jest.mock('../../../src/services/placesService', () => ({
  fetchAutocomplete: jest.fn(() => Promise.resolve([])),
  fetchPlaceDetails: jest.fn(),
  reverseGeocode: jest.fn(() => Promise.resolve('Fake Pickup Street, Lahore')),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() }),
  useIsFocused: () => true,
}));
jest.mock('../../../src/hooks/useNativeLocation', () => ({
  useNativeLocation: () => ({ currentLocation: { latitude: 31.52, longitude: 74.35 }, isLoading: false, error: null }),
}));
// Required after the mocks, so the screen sees them.
const SendParcelScreen = require('../../../src/features/parcel/screens/SendParcelScreen').default;

let mock: MockAdapter;
beforeEach(() => {
  clearQueryCache();
  mock = new MockAdapter(apiClient);
});
afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

/** GET /parcels/options (fake local config). */
const rawOptions = {
  tier_active: true,
  vehicle_type: 'parcel',
  currency: 'PKR',
  max_declared_value: 10000,
  categories: [{ key: 'documents', label: 'Documents and papers' }],
  sizes: [{ key: 'small', label: 'Small (fits in a bag)', max_weight_kg: 2 }],
  prohibited_items: ['Weapons'],
  declaration: 'I confirm the parcel holds none of the prohibited items.',
  rules_version: '2026-10-16',
  code_digits: 6,
  return_reasons: [{ key: 'receiver_unavailable', label: 'Receiver not available' }],
  refusal_reasons: [{ key: 'prohibited_item', label: 'Looks like a prohibited item' }],
};

/** The ride's `parcel` block (fake local data). */
const parcelBlock = (over: Record<string, unknown> = {}) => ({
  status: 'picked_up',
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
  makeRide({ vehicle_type: 'parcel', is_parcel: true, status: 'started', parcel, ...over });

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

describe('1. the fare is paid at the pickup', () => {
  const section = (status: string) => (
    <DriverParcelSection
      parcel={toParcelView(parcelBlock({ status }))!}
      fare={180}
      callingReceiver={false}
      resending={false}
      resendAvailableAt={null}
    />
  );

  it('the driver collects at the pickup, and after it is told the fare was paid', () => {
    const { rerender } = render(section('arrived'));
    expect(screen.getByTestId('driver-parcel-collect')).toBeTruthy();
    expect(screen.queryByTestId('driver-parcel-collected')).toBeNull();
    rerender(section('picked_up'));
    expect(screen.queryByTestId('driver-parcel-collect')).toBeNull();
    expect(screen.getByText('Rs 180 was paid in cash at the pickup')).toBeTruthy();
    expect(screen.queryByText(/Collect .* in cash/)).toBeNull();
    rerender(section('returning'));
    expect(screen.getByTestId('driver-parcel-collected')).toBeTruthy();
  });

  it('the trip-complete card says paid at the pickup for a parcel, collect in cash otherwise', () => {
    const done: Partial<RideResource> = { status: 'completed', total_fare: 180, payment_method: 'cash' };
    const { rerender } = render(<DriverRideSummary ride={makeRide({ ...done, vehicle_type: 'parcel', is_parcel: true })} onDone={jest.fn()} />);
    expect(screen.getByTestId('driver-ride-collect').props.children).toBe('Paid in cash at the pickup');
    rerender(<DriverRideSummary ride={makeRide(done)} onDone={jest.fn()} />);
    expect(screen.getByTestId('driver-ride-collect').props.children).toBe('Collect in cash');
  });

  it("the sender's completed parcel says it was paid at the pickup", () => {
    showPanel(parcelRide(parcelBlock({ status: 'delivered' }), { status: 'completed', total_fare: 180, payment_method: 'cash' }));
    expect(screen.getByText('Paid in cash at the pickup')).toBeTruthy();
    expect(screen.queryByText('Pay your driver in cash')).toBeNull();
  });
});

describe('2. a refused parcel tells the sender why', () => {
  const refused = () =>
    parcelRide(parcelBlock({ status: 'cancelled', refusal_reason: 'prohibited_item' }), {
      status: 'cancelled',
      cancellation_reason: 'driver',
    });

  it('live panel: "refused at the pickup" (not "Your driver cancelled") and the reason label', async () => {
    mock.onGet('/parcels/options').reply(200, envelope(rawOptions));
    showPanel(refused());
    expect(screen.getByTestId('active-ride-subtitle').props.children).toBe('The rider refused your parcel at the pickup.');
    expect(screen.queryByText('Your driver cancelled this ride.')).toBeNull();
    const banner = screen.getByTestId('parcel-refused');
    expect(within(banner).getByText('Refused at the pickup')).toBeTruthy();
    await waitFor(() => expect(within(banner).getByText('Reason: Looks like a prohibited item')).toBeTruthy());
  });

  it('live panel: a parcel cancelled without a refusal reads no options and shows no refusal', () => {
    showPanel(parcelRide(parcelBlock({ status: 'cancelled' }), { status: 'cancelled' }));
    expect(screen.queryByTestId('parcel-refused')).toBeNull();
    expect(mock.history.get.some((r) => r.url === '/parcels/options')).toBe(false);
  });

  it('receipt: the cancellation card says the rider refused it (sender) or you refused it (driver)', () => {
    const ride = toRide({
      ...refused(),
      cancelled_at: '2026-10-16T10:05:00+05:00',
      cancellation_note: 'Parcel refused at the pickup: Looks like a prohibited item',
    })!;
    const { rerender } = render(<CancellationCard ride={ride} viewer="passenger" />);
    expect(screen.getByTestId('ride-details-cancellation-text').props.children).toBe('The rider refused your parcel at the pickup.');
    rerender(<CancellationCard ride={ride} viewer="driver" />);
    expect(screen.getByTestId('ride-details-cancellation-text').props.children).toBe('You refused the parcel at the pickup.');
  });
});

describe('3. the sender at the pickup', () => {
  it('is told to hand the parcel over and pay the locked fare', () => {
    showPanel(parcelRide(parcelBlock({ status: 'arrived' }), { status: 'arrived', accepted_fare: '180.00', total_fare: 170 }));
    expect(screen.getByTestId('active-ride-subtitle').props.children).toBe('Hand the parcel to the rider and pay Rs 180 in cash.');
    expect(screen.queryByText('Meet your driver at the pickup point')).toBeNull();
  });

  it('a plain ride keeps "Meet your driver"', () => {
    const ride = makeRide({ status: 'arrived' });
    showPanel(ride);
    expect(screen.getByTestId('active-ride-subtitle').props.children).toBe('Meet your driver at the pickup point');
  });
});

describe('4. the parcel form and the keyboard', () => {
  it("the receiver's number pad has a Done bar", () => {
    render(<ParcelDetailsSection options={toParcelOptions(rawOptions)} draft={EMPTY_PARCEL_DRAFT} errors={{}} update={jest.fn()} />);
    expect(screen.getByTestId('parcel-receiver-phone-done')).toBeTruthy();
  });

  it('the footer steps aside while the keyboard is up, so suggestions are not covered', async () => {
    const handlers: Record<string, Array<() => void>> = {};
    const real = Keyboard.addListener.bind(Keyboard);
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: () => void) => {
      (handlers[event] ??= []).push(cb);
      return real(event as Parameters<typeof Keyboard.addListener>[0], cb);
    }) as typeof Keyboard.addListener);
    const emit = (event: string) => act(() => (handlers[event] ?? []).forEach((cb) => cb()));
    mock.onGet('/parcels/options').reply(200, envelope(rawOptions));
    render(
      <Provider store={makeStore()}>
        <SendParcelScreen />
      </Provider>,
    );
    expect(await screen.findByTestId('send-parcel-footer')).toBeTruthy();
    // The place searches sit in reveal groups (label, field and suggestions kept in view).
    expect(screen.getByTestId('parcel-dropoff-group')).toBeTruthy();
    emit('keyboardWillShow');
    emit('keyboardDidShow');
    expect(screen.queryByTestId('send-parcel-footer')).toBeNull();
    emit('keyboardWillHide');
    emit('keyboardDidHide');
    expect(screen.getByTestId('send-parcel-footer')).toBeTruthy();
  });
});

describe('5. labels and the Home entry', () => {
  it('history names the AC and parcel tiers', () => {
    expect(vehicleLabel('car_ac')).toBe('Car AC');
    expect(vehicleLabel('parcel')).toBe('Parcel');
    expect(vehicleLabel('car')).toBe('Car');
  });

  it('"Send a parcel" sits in the peek chip row (no sheet expanding needed)', () => {
    const onSendParcel = jest.fn();
    render(
      <HomeSheetBody
        onWhereTo={jest.fn()}
        savedPlaces={[]}
        onSavedPlace={jest.fn()}
        onAddPlace={jest.fn()}
        onSavedPlaces={jest.fn()}
        locationOff={false}
        onEnableLocation={jest.fn()}
        recentRides={[]}
        onOpenRide={jest.fn()}
        onSeeAllRides={jest.fn()}
        onSendParcel={onSendParcel}
      />,
    );
    const row = screen.getByTestId('home-saved-places-row');
    fireEvent.press(within(row).getByTestId('home-send-parcel'));
    expect(onSendParcel).toHaveBeenCalled();
  });
});

describe("6. the driver's active ride", () => {
  const panel = (ride: RideResource) =>
    render(
      <DriverRidePanel
        ride={ride}
        step="on_trip"
        pendingAction={null}
        canCall={false}
        canNavigate={false}
        onCall={jest.fn()}
        onNavigate={jest.fn()}
        onArrived={jest.fn()}
        onStart={jest.fn()}
        onComplete={jest.fn()}
        onCompleteStop={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

  it('shows the AC badge on an AC ride and nothing on a plain one', () => {
    const { unmount } = panel(makeRide({ status: 'started', vehicle_type: 'car_ac', is_ac: true }));
    expect(screen.getByTestId('driver-ride-ac')).toBeTruthy();
    unmount();
    panel(makeRide({ status: 'started' }));
    expect(screen.queryByTestId('driver-ride-ac')).toBeNull();
    expect(screen.queryByTestId('driver-ride-women-mode')).toBeNull();
  });

  it('marks a women-mode ride in neutral words when the server says so', () => {
    panel(makeRide({ status: 'started', female_driver_only: true }));
    const badge = screen.getByTestId('driver-ride-women-mode');
    expect(within(badge).getByText('Women mode ride')).toBeTruthy();
    expect(screen.queryByText(/female/i)).toBeNull();
  });
});

describe('7. a long plate', () => {
  it('shrinks to fit on one line instead of being cut off', () => {
    render(<PersonCard name="Bilal" fallbackName="Your driver" plate="QA-T522-BIKE-01" plateTestID="plate" />);
    const plate = screen.getByTestId('plate');
    expect(plate.props.children).toBe('QA-T522-BIKE-01');
    expect(plate.props.adjustsFontSizeToFit).toBe(true);
    expect(plate.props.minimumFontScale).toBe(PLATE_MIN_FONT_SCALE);
    expect(plate.props.numberOfLines).toBe(1);
  });
});

describe('8. newly activated tiers show soon', () => {
  const fare = { currency: 'PKR', base_fare: 50, per_km: 25, per_min: 2, min_fare: 100, per_stop: 20 };
  const car = { key: 'car', label: 'Car', capacity: 4, icon: 'car', fare };
  const carAc = { key: 'car_ac', label: 'Car AC', capacity: 4, icon: 'car', fare };
  const typeGets = () => mock.history.get.filter((r) => r.url === '/public/vehicle-types');

  it('first mount with focus asks once (no second read in the same commit)', async () => {
    mock.onGet('/public/vehicle-types').reply(200, envelope([car]));
    const { result } = renderHook(() => useVehicleTypes({ refreshWhen: true }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(typeGets()).toHaveLength(1);
  });

  it('on focus a catalogue older than the recheck time is read again quietly; a fresh one is not', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    mock.onGet('/public/vehicle-types').replyOnce(200, envelope([car])).onGet('/public/vehicle-types').reply(200, envelope([car, carAc]));
    const first = renderHook(() => useVehicleTypes());
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    first.unmount();

    // Back on Home a minute later: still fresh, nothing asked.
    jest.setSystemTime(Date.now() + 60 * 1000);
    const { result, rerender } = renderHook(({ focused }: { focused: boolean }) => useVehicleTypes({ refreshWhen: focused }), {
      initialProps: { focused: true },
    });
    expect(result.current.data?.map((t) => t.key)).toEqual(['car']);
    expect(typeGets()).toHaveLength(1);

    // Away, then back after the recheck time: one quiet read, shown without a loading state.
    rerender({ focused: false });
    jest.setSystemTime(Date.now() + CACHE_TTL.vehicleTypesRecheck);
    rerender({ focused: true });
    expect(result.current.status).toBe('ready');
    await waitFor(() => expect(result.current.data?.map((t) => t.key)).toEqual(['car', 'car_ac']));
    expect(typeGets()).toHaveLength(2);

    // Focus toggling right after does not ask again.
    rerender({ focused: false });
    rerender({ focused: true });
    expect(typeGets()).toHaveLength(2);
  });

  it('a failed quiet read keeps the shown catalogue', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    mock.onGet('/public/vehicle-types').replyOnce(200, envelope([car])).onGet('/public/vehicle-types').reply(500, { success: false, message: 'x' });
    const first = renderHook(() => useVehicleTypes());
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    first.unmount();
    jest.setSystemTime(Date.now() + CACHE_TTL.vehicleTypesRecheck + 1000);
    const { result } = renderHook(() => useVehicleTypes({ refreshWhen: true }));
    await waitFor(() => expect(typeGets()).toHaveLength(2));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.data?.map((t) => t.key)).toEqual(['car']);
  });
});

