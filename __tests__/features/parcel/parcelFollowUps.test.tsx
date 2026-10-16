/**
 * T-559 (T-522 follow-ups, BE-88):
 * 1. the ride receipt shows the parcel for the sender and the driver: outcome with the reason
 *    label, item, masked receiver, the parcel's steps with times, the pickup photo (or that it
 *    is gone after retention); the ride's own started/completed timeline is not shown twice;
 * 2. Home's live card says "Track your parcel" and the parcel's status words;
 * 3. the driver pickup footer keeps Pick up full width and puts Refuse next to Cancel / No-show
 *    in one row, with labels that fit 320, 375 and 414 pt screens;
 * 4. the sender may offer a parcel fare inside the server's band (BE-83 offered_fare), and an
 *    out-of-band 422 moves the offer into the server's band.
 */
import React from 'react';
import * as ReactNative from 'react-native';
import MockAdapter from 'axios-mock-adapter';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react-native';
import { apiClient, type User } from '../../../src/services/api';
import { clearQueryCache } from '../../../src/core/api/queryCache';
import { rootReducer } from '../../../src/store/rootReducer';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { toRide } from '../../../src/features/ride-history/api';
import RideDetailsScreen from '../../../src/features/ride-history/screens/RideDetailsScreen';
import { toParcelOptions, toParcelView } from '../../../src/features/parcel/api';
import { parcelOutcome, parcelReceiptSteps, pickupPhotoState, reasonLabel } from '../../../src/features/parcel/receipt';
import { parcelLiveStatusText } from '../../../src/features/parcel/live';
import { buildParcelRideRequest } from '../../../src/features/parcel/rules';
import { useSendParcel } from '../../../src/features/parcel/useSendParcel';
import { HomeSheetBody } from '../../../src/features/passenger-home/components/HomeSheet';
import { DriverRidePanel } from '../../../src/components/driver/DriverRidePanel';
import { footerRowLabels, footerSlotWidth, labelFits } from '../../../src/features/driver-ride/footerLayout';
import type { DriverParcelPanel } from '../../../src/features/parcel/useDriverParcel';
import type { ParcelDraft } from '../../../src/features/parcel/types';
import { envelope, makeRide, makeStore, type TestStore } from '../../../test-utils/rideFixtures';

jest.mock('../../../src/services/placesService', () => ({
  fetchAutocomplete: jest.fn(() => Promise.resolve([])),
  fetchPlaceDetails: jest.fn(),
  reverseGeocode: jest.fn(() => Promise.resolve('Fake Pickup Street, Lahore')),
}));

/** The window the driver panel lays its footer out for (a phone width per test). */
let mockWindow = { width: 375, height: 667, scale: 2, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

let mockParams: Record<string, unknown> = {};
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ key: 'test', name: 'RideDetails', params: mockParams }),
  useIsFocused: () => true,
}));

let mock: MockAdapter;

beforeEach(() => {
  clearQueryCache();
  mock = new MockAdapter(apiClient);
  mockParams = {};
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

const RECEIVER_PHONE = '+923001234567';

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
const options = toParcelOptions(rawOptions);

/** The ride's `parcel` block for the sender or the driver after the parcel ended. */
const endedParcel = (over: Record<string, unknown> = {}) => ({
  status: 'delivered',
  item_category: 'documents',
  item_category_label: 'Documents and papers',
  size_class: 'small',
  size_label: 'Small (fits in a bag)',
  max_weight_kg: 2,
  item_description: 'Two books',
  declared_value: 2500,
  receiver: { name: 'Sana Khan', phone: RECEIVER_PHONE, phone_masked: '+92300*****67' },
  pickup_photo_url: 'https://example.test/signed/photo.jpg',
  picked_up_at: '2026-10-16T10:10:00+05:00',
  delivered_at: '2026-10-16T10:40:00+05:00',
  return_started_at: null,
  return_reason: null,
  returned_at: null,
  refusal_reason: null,
  code: null,
  can_call_receiver: false,
  ...over,
});

/** A parcel RideResource as GET /rides/{id} returns it (fake local data). */
const rawParcelRide = (parcel: Record<string, unknown> | null, over: Record<string, unknown> = {}) => ({
  id: 51,
  ride_id: 'RH-PARCEL51',
  passenger_id: 7,
  driver_id: 9,
  pickup_address: 'Fake Pickup Street',
  dropoff_address: 'Fake Dropoff Road',
  status: 'completed',
  vehicle_type: 'parcel',
  is_parcel: true,
  total_fare: '180.00',
  fare_breakdown: { base: 80, distance: 80, time: 20, stops: 0, min_fare_adjustment: 0, total: 180 },
  payment_method: 'cash',
  stops: [],
  passenger: { id: 7, name: 'Ayesha', profile_image_url: null, rating: 4.9 },
  driver: { id: 9, name: 'Bilal', profile_image_url: null, rating: 4.7 },
  requested_at: '2026-10-16T09:50:00+05:00',
  accepted_at: '2026-10-16T09:52:00+05:00',
  arrived_at: '2026-10-16T10:00:00+05:00',
  started_at: '2026-10-16T10:10:00+05:00',
  completed_at: '2026-10-16T10:40:00+05:00',
  cancelled_at: null,
  ...(parcel ? { parcel } : {}),
  ...over,
});

const user = (role: 'passenger' | 'driver'): User => ({
  id: role === 'driver' ? 9 : 7,
  name: 'Test User',
  email: 'user@example.test',
  phone: null,
  status: 'active',
  role,
  roles: [role],
});

const showDetails = (role: 'passenger' | 'driver' = 'passenger') => {
  const initial = rootReducer(undefined, { type: '@@init' });
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: { ...initial, apiAuth: { ...initial.apiAuth, user: user(role) } },
  });
  render(
    <Provider store={store}>
      <ThemeProvider>
        <RideDetailsScreen />
      </ThemeProvider>
    </Provider>,
  );
};

const allText = (): string =>
  screen
    .UNSAFE_root.findAll((node) => typeof node.props.children === 'string')
    .map((node) => node.props.children as string)
    .join('\n');

describe('1. the parcel on the ride receipt', () => {
  it('maps the parcel block on history rides only for parcels', () => {
    expect(toRide(rawParcelRide(endedParcel()))?.parcel?.status).toBe('delivered');
    expect(toRide(rawParcelRide(null, { vehicle_type: 'car', is_parcel: false }))?.parcel).toBeNull();
  });

  it('says how the parcel ended, with the server reason label (or the key, readable)', () => {
    const lists = { returnReasons: options.returnReasons, refusalReasons: options.refusalReasons };
    const view = (over: Record<string, unknown>) => toParcelView(endedParcel(over))!;
    expect(parcelOutcome(view({}), lists)).toEqual({ kind: 'delivered', title: 'Delivered', reason: null });
    expect(parcelOutcome(view({ status: 'returned', return_reason: 'receiver_unavailable' }), lists)).toEqual({
      kind: 'returned',
      title: 'Returned to the sender',
      reason: 'Receiver not available',
    });
    expect(parcelOutcome(view({ status: 'cancelled', refusal_reason: 'prohibited_item' }), lists)?.kind).toBe('refused');
    expect(parcelOutcome(view({ status: 'cancelled' }), lists)).toEqual({ kind: 'cancelled', title: 'Cancelled', reason: null });
    expect(parcelOutcome(view({ status: 'picked_up' }), lists)).toBeNull();
    expect(reasonLabel('wrong_address', [])).toBe('Wrong address');
  });

  it('lists the parcel steps that happened, with the return path and a refusal', () => {
    const times = { requestedAt: 'a', acceptedAt: 'b', arrivedAt: 'c', cancelledAt: 'z' };
    const keys = (over: Record<string, unknown>) => parcelReceiptSteps(times, toParcelView(endedParcel(over))!).map((s) => s.key);
    expect(keys({})).toEqual(['requested', 'accepted', 'arrived', 'picked_up', 'delivered']);
    expect(keys({ status: 'returned', return_started_at: 'r', returned_at: 's' })).toEqual([
      'requested', 'accepted', 'arrived', 'picked_up', 'return_started', 'returned',
    ]);
    expect(keys({ status: 'cancelled', picked_up_at: null, refusal_reason: 'prohibited_item' })).toEqual(['requested', 'accepted', 'arrived', 'refused']);
  });

  it('knows whether the pickup photo is shown, removed after retention, or never taken', () => {
    expect(pickupPhotoState(toParcelView(endedParcel())!)).toBe('shown');
    expect(pickupPhotoState(toParcelView(endedParcel({ pickup_photo_url: null }))!)).toBe('removed');
    expect(pickupPhotoState(toParcelView(endedParcel({ status: 'cancelled', pickup_photo_url: null, picked_up_at: null }))!)).toBe('none');
  });

  it('sender: delivered parcel with item, masked receiver, steps and photo; no ride timeline, no full phone', async () => {
    mockParams = { rideId: 51 };
    mock.onGet('/rides/51').reply(200, envelope(rawParcelRide(endedParcel())));
    showDetails('passenger');
    expect(await screen.findByTestId('ride-details-parcel')).toBeTruthy();
    expect(screen.getByTestId('ride-details-parcel-outcome-delivered')).toBeTruthy();
    expect(screen.getByText('Documents and papers · Small (fits in a bag)')).toBeTruthy();
    expect(screen.getByText('Sana Khan · +92300*****67')).toBeTruthy();
    expect(screen.getByTestId('ride-details-parcel-step-picked_up')).toBeTruthy();
    expect(screen.getByTestId('ride-details-parcel-step-delivered')).toBeTruthy();
    expect(screen.getByTestId('ride-details-parcel-photo').props.source).toEqual({ uri: 'https://example.test/signed/photo.jpg' });
    expect(screen.queryByTestId('ride-details-timeline')).toBeNull();
    expect(allText()).not.toContain(RECEIVER_PHONE);
    // No reason to label: the options are not read.
    expect(mock.history.get.some((r) => r.url === '/parcels/options')).toBe(false);
  });

  it('driver: a returned parcel shows the reason label from the options and that the photo is gone', async () => {
    mockParams = { rideId: 51 };
    mock.onGet('/parcels/options').reply(200, envelope(rawOptions));
    mock.onGet('/rides/51').reply(200, envelope(rawParcelRide(endedParcel({
      status: 'returned',
      receiver: { name: 'S.', phone: null, phone_masked: null },
      pickup_photo_url: null,
      return_started_at: '2026-10-16T10:30:00+05:00',
      return_reason: 'receiver_unavailable',
      returned_at: '2026-10-16T10:50:00+05:00',
      delivered_at: null,
    }))));
    showDetails('driver');
    expect(await screen.findByTestId('ride-details-parcel-outcome-returned')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('ride-details-parcel-reason').props.children).toBe('Reason: Receiver not available'));
    expect(screen.getByTestId('ride-details-parcel-step-return_started')).toBeTruthy();
    expect(screen.getByTestId('ride-details-parcel-step-returned')).toBeTruthy();
    expect(screen.getByTestId('ride-details-parcel-photo-removed')).toBeTruthy();
    expect(screen.queryByTestId('ride-details-parcel-photo')).toBeNull();
  });

  it('a refused parcel says so with the refusal reason and no photo line', async () => {
    mockParams = { rideId: 51 };
    mock.onGet('/parcels/options').reply(200, envelope(rawOptions));
    mock.onGet('/rides/51').reply(200, envelope(rawParcelRide(endedParcel({
      status: 'cancelled',
      pickup_photo_url: null,
      picked_up_at: null,
      delivered_at: null,
      refusal_reason: 'prohibited_item',
    }), { status: 'cancelled', started_at: null, completed_at: null, cancelled_at: '2026-10-16T10:05:00+05:00', cancellation_reason: 'driver' })));
    showDetails('passenger');
    expect(await screen.findByTestId('ride-details-parcel-outcome-refused')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('ride-details-parcel-reason').props.children).toBe('Reason: Looks like a prohibited item'));
    expect(screen.getByTestId('ride-details-parcel-step-refused')).toBeTruthy();
    expect(screen.queryByTestId('ride-details-parcel-photo-removed')).toBeNull();
  });
});

describe('2. Home "Track your parcel"', () => {
  it('reads the parcel status words, falls back to the ride status, and ignores plain rides', () => {
    const parcelRide = (parcel: Record<string, unknown> | undefined, status: 'accepted' | 'arrived' | 'started') =>
      makeRide({ vehicle_type: 'parcel', is_parcel: true, status, parcel });
    expect(parcelLiveStatusText(parcelRide(endedParcel({ status: 'arrived' }), 'arrived'))).toBe('Rider at the pickup');
    expect(parcelLiveStatusText(parcelRide(endedParcel({ status: 'returning' }), 'started'))).toBe('Coming back to you');
    expect(parcelLiveStatusText(parcelRide(undefined, 'accepted'))).toBe('Rider on the way to the pickup');
    expect(parcelLiveStatusText(makeRide({ status: 'accepted' }))).toBeNull();
  });

  it('the live card says "Track your parcel" for a parcel and "Return to your ride" otherwise', () => {
    const body = (liveRide: { status: string; parcel?: boolean }) => (
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
        liveRide={liveRide}
        onReturnToRide={jest.fn()}
      />
    );
    const { rerender } = render(body({ status: 'Rider at the pickup', parcel: true }));
    expect(screen.getByText('Track your parcel')).toBeTruthy();
    expect(screen.getByTestId('home-live-ride-status').props.children).toBe('Rider at the pickup');
    expect(screen.queryByText('Driver on the way')).toBeNull();
    rerender(body({ status: 'Driver on the way' }));
    expect(screen.getByText('Return to your ride')).toBeTruthy();
  });
});

describe('3. the driver pickup footer on small phones', () => {
  const noop = () => undefined;
  const panel = (): DriverParcelPanel => ({
    parcel: toParcelView(endedParcel({ status: 'arrived', pickup_photo_url: null, picked_up_at: null, delivered_at: null }))!,
    fare: 180,
    primary: { label: 'Pick up parcel', onPress: noop, testID: 'driver-parcel-pickup' },
    secondary: { label: 'Refuse parcel', shortLabel: 'Refuse', onPress: noop, testID: 'driver-parcel-refuse', variant: 'destructiveSoft' },
    callingReceiver: false,
    resending: false,
    resendDisabled: false,
    resendAvailableAt: null,
  });
  const atPickup = (width: number, onNoShow?: () => void) => {
    mockWindow = { width, height: 640, scale: 2, fontScale: 1 };
    return render(
      <DriverRidePanel
        ride={makeRide({ id: 51, status: 'arrived', vehicle_type: 'parcel', is_parcel: true })}
        step="at_pickup"
        pendingAction={null}
        canCall={false}
        canNavigate={false}
        onCall={noop}
        onNavigate={noop}
        onArrived={noop}
        onStart={noop}
        onComplete={noop}
        onCompleteStop={noop}
        onCancel={noop}
        onNoShow={onNoShow}
        parcel={panel()}
      />,
    );
  };
  const label = (testID: string) => screen.getByTestId(`${testID}-content`).findByType(ReactNative.Text).props.children;

  it.each([
    [320, 'Refuse', 'Cancel'],
    [375, 'Refuse', 'Cancel ride'],
    [414, 'Refuse parcel', 'Cancel ride'],
  ])('at %i pt: Pick up full width, Refuse and Cancel share one row (%s / %s)', (width, refuse, cancel) => {
    atPickup(width);
    const row = screen.getByTestId('driver-ride-footer-row');
    expect(row.props.style).toEqual(expect.objectContaining({ flexDirection: 'row' }));
    // Pick up stays outside the row (full width); Refuse and Cancel are inside it.
    expect(within(row).queryByTestId('driver-parcel-pickup')).toBeNull();
    expect(within(row).getByTestId('driver-parcel-refuse')).toBeTruthy();
    expect(within(row).getByTestId('driver-ride-cancel')).toBeTruthy();
    expect(screen.getByTestId('driver-parcel-pickup')).toBeTruthy();
    expect(label('driver-parcel-refuse')).toBe(refuse);
    expect(label('driver-ride-cancel')).toBe(cancel);
    // The screen reader always hears the full label.
    expect(screen.getByTestId('driver-parcel-refuse').props.accessibilityLabel).toBe('Refuse parcel');
    expect(screen.getByTestId('driver-ride-cancel').props.accessibilityLabel).toBe('Cancel ride');
  });

  it('after the wait, No-show replaces Cancel in the row', () => {
    const onNoShow = jest.fn();
    atPickup(320, onNoShow);
    expect(screen.queryByTestId('driver-ride-cancel')).toBeNull();
    expect(label('driver-ride-no-show')).toBe('No-show');
    expect(screen.getByTestId('driver-ride-no-show').props.accessibilityLabel).toBe("Passenger didn't come");
    fireEvent.press(screen.getByTestId('driver-ride-no-show'));
    expect(onNoShow).toHaveBeenCalled();
  });

  it('a plain ride at the pickup keeps Start trip and a full-width Cancel (no row)', () => {
    mockWindow = { width: 320, height: 640, scale: 2, fontScale: 1 };
    render(
      <DriverRidePanel
        ride={makeRide({ id: 41, status: 'arrived' })}
        step="at_pickup"
        pendingAction={null}
        canCall={false}
        canNavigate={false}
        onCall={noop}
        onNavigate={noop}
        onArrived={noop}
        onStart={noop}
        onComplete={noop}
        onCompleteStop={noop}
        onCancel={noop}
      />,
    );
    expect(screen.queryByTestId('driver-ride-footer-row')).toBeNull();
    expect(label('driver-ride-cancel')).toBe('Cancel ride');
  });

  it('every row label fits its half at 320-414 pt, also with larger text', () => {
    const actions = [
      { label: 'Refuse parcel', shortLabel: 'Refuse' },
      { label: "Passenger didn't come", shortLabel: 'No-show' },
    ];
    [320, 360, 375, 390, 414].forEach((width) => {
      const slot = footerSlotWidth(width, 2);
      footerRowLabels(actions, width).forEach((text) => expect(labelFits(text, slot)).toBe(true));
    });
    expect(footerRowLabels(actions, 320, 1.3)).toEqual(['Refuse', 'No-show']);
  });
});

describe('4. the parcel fare offer', () => {
  const filled: ParcelDraft = {
    receiverName: 'Sana Khan',
    receiverPhone: '3001234567',
    itemCategory: 'documents',
    sizeClass: 'small',
    declaredValue: '2500',
    itemDescription: '',
    declarationAccepted: true,
  };
  const A = { latitude: 31.52, longitude: 74.35, address: 'Fake Pickup Street' };
  const B = { latitude: 31.48, longitude: 74.3, address: 'Fake Dropoff Road' };
  const band = { min: 150, max: 220, step: 10, server_fare: 180 };
  const estimate = (offerBand: typeof band | null) =>
    envelope({
      distance_km: 4,
      duration_min: 10,
      estimates: [{ vehicle_type: 'parcel', fare: 180, currency: 'PKR', parcel: true, breakdown: {}, offer_band: offerBand }],
    });
  const handlers = () => ({ onBooked: jest.fn(), onPhoneNotVerified: jest.fn(), onBalanceOwed: jest.fn(), onRulesChanged: jest.fn() });
  const withStore = (store: TestStore) =>
    function Wrapper({ children }: { children: React.ReactNode }) {
      return <Provider store={store}>{children}</Provider>;
    };
  const fill = (result: { current: ReturnType<typeof useSendParcel> }) =>
    act(() => {
      result.current.update('receiverName', filled.receiverName, 'receiverName');
      result.current.update('receiverPhone', filled.receiverPhone, 'receiverPhone');
      result.current.update('itemCategory', filled.itemCategory, 'itemCategory');
      result.current.update('sizeClass', filled.sizeClass, 'sizeClass');
      result.current.update('declaredValue', filled.declaredValue, 'declaredValue');
      result.current.update('declarationAccepted', true, 'declaration');
      result.current.setDropoff(B);
    });

  it('sends offered_fare only when the sender moved it off the server fare', () => {
    const built = buildParcelRideRequest(A, B, filled, options, 200);
    expect(built.ok && built.request.offered_fare).toBe(200);
    const plain = buildParcelRideRequest(A, B, filled, options);
    expect(plain.ok && plain.request.offered_fare).toBeUndefined();
  });

  it('steps the offer inside the band and books with offered_fare', async () => {
    mock.onPost('/rides/estimate').reply(200, estimate(band));
    mock.onPost('/rides').reply(201, envelope(makeRide({ id: 61, vehicle_type: 'parcel', is_parcel: true, status: 'requested' })));
    const { result } = renderHook(() => useSendParcel(options, { latitude: 31.52, longitude: 74.35 }, handlers()), { wrapper: withStore(makeStore()) });
    fill(result);
    await waitFor(() => expect(result.current.offer.band?.max).toBe(220));
    expect(result.current.offer.value).toBe(180);
    act(() => result.current.offer.step(1));
    act(() => result.current.offer.step(1));
    expect(result.current.offer.offeredFare).toBe(200);
    await act(async () => {
      await result.current.submit();
    });
    const body = JSON.parse(mock.history.post.find((r) => r.url === '/rides')?.data ?? '{}');
    expect(body.offered_fare).toBe(200);
    expect(body.vehicle_type).toBe('parcel');
  });

  it('an out-of-band 422 shows the server message and moves the offer into its band', async () => {
    mock.onPost('/rides/estimate').reply(200, estimate(band));
    mock.onPost('/rides').reply(422, {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: { offered_fare: ['Offer between Rs 170 and Rs 190.'] },
        offer_band: { min: 170, max: 190, step: 10, server_fare: 180 },
      },
    });
    const h = handlers();
    const { result } = renderHook(() => useSendParcel(options, { latitude: 31.52, longitude: 74.35 }, h), { wrapper: withStore(makeStore()) });
    fill(result);
    await waitFor(() => expect(result.current.offer.band).not.toBeNull());
    act(() => {
      result.current.offer.step(1);
      result.current.offer.step(1);
      result.current.offer.step(1);
    });
    expect(result.current.offer.value).toBe(210);
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.formError).toBe('Offer between Rs 170 and Rs 190.');
    expect(result.current.offer.band?.max).toBe(190);
    expect(result.current.offer.value).toBe(190);
    expect(h.onBooked).not.toHaveBeenCalled();
  });

  it('no band (offers off): no stepper value and no offered_fare', async () => {
    mock.onPost('/rides/estimate').reply(200, estimate(null));
    const { result } = renderHook(() => useSendParcel(options, { latitude: 31.52, longitude: 74.35 }, handlers()), { wrapper: withStore(makeStore()) });
    fill(result);
    await waitFor(() => expect(result.current.quote?.fare).toBe(180));
    expect(result.current.offer.band).toBeNull();
    expect(result.current.offer.offeredFare).toBeNull();
  });
});
