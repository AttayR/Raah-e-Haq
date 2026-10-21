/**
 * T-522 (BE-88) parcel delivery, the sender's side: the parcel tier stays out of the ride vehicle
 * list; GET /parcels/options feeds the form; POST /rides carries vehicle_type parcel and the
 * `parcel` block (E.164 receiver phone, no stops, no offer) and a 422 lands under its field; the
 * live panel shows the timeline, the receiver masked, the code state with "Send the code again"
 * (cool-down, limit, failed SMS) and the return code only while the parcel comes back.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { Provider } from 'react-redux';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { apiClient } from '../../../src/services/api';
import { toast } from '../../../src/core/toast';
import { clearQueryCache } from '../../../src/core/api/queryCache';
import ActiveRidePanel from '../../../src/features/active-ride/components/ActiveRidePanel';
import { advanceRideStage, type PassengerRideStageState } from '../../../src/features/active-ride/stage';
import { activeRideReplaced, createActiveRide } from '../../../src/features/active-ride/slice';
import { normalizeFareEstimates, normalizeVehicleTypes } from '../../../src/features/ride-booking/api';
import { rideVehicleTypes, toVehicleOptions } from '../../../src/features/ride-booking/vehicleOptions';
import {
  isParcelRide,
  parcelOf,
  toParcelOptions,
  toParcelView,
} from '../../../src/features/parcel/api';
import {
  EMPTY_PARCEL_DRAFT,
  buildParcelRideRequest,
  parcelFieldErrorsOf,
  parcelTimeline,
  resendRefusalText,
  resendState,
  validateParcelDraft,
} from '../../../src/features/parcel/rules';
import { useSendParcel } from '../../../src/features/parcel/useSendParcel';
import { bookingCooldownSeconds, resetBookingCooldown } from '../../../src/features/ride-booking/bookingCooldown';
import { HomeSheetBody } from '../../../src/features/passenger-home/components/HomeSheet';
import { homeBodyProps } from '../../../test-utils/homeFixtures';
import type { ParcelDraft } from '../../../src/features/parcel/types';
import type { RideResource } from '../../../src/services/rideService';
import { envelope, makeRide, makeStore, type TestStore } from '../../../test-utils/rideFixtures';

jest.mock('../../../src/services/placesService', () => ({
  fetchAutocomplete: jest.fn(() => Promise.resolve([])),
  fetchPlaceDetails: jest.fn(),
  reverseGeocode: jest.fn(() => Promise.resolve('Fake Pickup Street, Lahore')),
}));

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate, replace: mockReplace }),
    useIsFocused: () => true,
  };
});
jest.mock('../../../src/hooks/useNativeLocation', () => ({
  useNativeLocation: () => ({ currentLocation: { latitude: 31.52, longitude: 74.35 }, isLoading: false, error: null }),
}));
// Required after the mocks, so the screen sees them.
const SendParcelScreen = require('../../../src/features/parcel/screens/SendParcelScreen').default;

let mock: MockAdapter;

beforeEach(() => {
  clearQueryCache();
  mock = new MockAdapter(apiClient);
  jest.spyOn(toast, 'success').mockImplementation(() => '');
  jest.spyOn(toast, 'error').mockImplementation(() => '');
  jest.spyOn(toast, 'info').mockImplementation(() => '');
  mockNavigate.mockClear();
  mockReplace.mockClear();
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

/** GET /parcels/options as BE-88 serves it (fake local config). */
const rawOptions = (over: Record<string, unknown> = {}) => ({
  tier_active: true,
  vehicle_type: 'parcel',
  base_vehicle_type: 'bike',
  currency: 'PKR',
  max_declared_value: 10000,
  cash_on_delivery: false,
  categories: [
    { key: 'documents', label: 'Documents and papers' },
    { key: 'gifts', label: 'Gifts' },
  ],
  sizes: [
    { key: 'small', label: 'Small (fits in a bag)', max_weight_kg: 2 },
    { key: 'medium', label: 'Medium (shoe box)', max_weight_kg: 5 },
  ],
  prohibited_items: ['Cash or jewellery', 'Weapons'],
  declaration: 'I confirm the parcel holds none of the prohibited items.',
  rules_version: '2026-10-16',
  code_digits: 6,
  return_reasons: [{ key: 'receiver_unavailable', label: 'Receiver not available' }],
  refusal_reasons: [{ key: 'prohibited_item', label: 'Looks like a prohibited item' }],
  ...over,
});
const options = toParcelOptions(rawOptions());

const filled: ParcelDraft = {
  receiverName: '  Sana   Khan ',
  receiverPhone: '3001234567',
  itemCategory: 'documents',
  sizeClass: 'small',
  declaredValue: '2500',
  itemDescription: ' Two books ',
  declarationAccepted: true,
};

const A = { latitude: 31.52, longitude: 74.35, address: 'Fake Pickup Street' };
const B = { latitude: 31.48, longitude: 74.3, address: 'Fake Dropoff Road' };

/** The sender's parcel block on a ride (BE-88 ParcelDelivery::present for the sender). */
const senderParcel = (over: Record<string, unknown> = {}) => ({
  status: 'picked_up',
  item_category: 'documents',
  item_category_label: 'Documents and papers',
  size_class: 'small',
  size_label: 'Small (fits in a bag)',
  max_weight_kg: 2,
  cash_on_delivery: false,
  payment: { method: 'cash', paid_by: 'sender', collect_at: 'pickup' },
  item_description: 'Two books',
  declared_value: 2500,
  rules_version: '2026-10-16',
  receiver: { name: 'Sana Khan', phone: '+923001234567', phone_masked: '+92300*****67' },
  pickup_photo_url: 'https://example.test/signed/photo.jpg',
  picked_up_at: '2026-10-16T10:10:00Z',
  delivered_at: null,
  return_started_at: null,
  return_reason: null,
  returned_at: null,
  refusal_reason: null,
  code: {
    digits: 6,
    purpose: 'delivery',
    sent: true,
    send_count: 1,
    sends_left: 2,
    sms_failed: false,
    can_resend: true,
    resend_available_at: null,
    attempts_left: 5,
    locked_until: null,
    blocked: false,
    delivery_blocked: false,
  },
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

const withStore = (store: TestStore) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };

describe('catalogue: the parcel tier is not a ride', () => {
  it('keeps the parcel tier flagged and leaves it out of the ride vehicle list', () => {
    const types = normalizeVehicleTypes([
      { key: 'bike', label: 'Bike', capacity: 1, parcel: false },
      { key: 'parcel', label: 'Parcel', capacity: 1, parcel: true, base_vehicle_type: 'bike' },
    ]);
    expect(types).toEqual([
      { key: 'bike', label: 'Bike', capacity: 1 },
      { key: 'parcel', label: 'Parcel', capacity: 1, parcel: true },
    ]);
    const estimates = normalizeFareEstimates({
      distance_km: 4,
      duration_min: 10,
      estimates: [
        { vehicle_type: 'bike', fare: 150, currency: 'PKR', breakdown: {} },
        { vehicle_type: 'parcel', fare: 180, currency: 'PKR', parcel: true, breakdown: {} },
      ],
    });
    expect(estimates.estimates[1].parcel).toBe(true);
    expect(rideVehicleTypes(types).map((t) => t.key)).toEqual(['bike']);
    expect(toVehicleOptions(types, estimates).map((o) => o.id)).toEqual(['bike']);
  });

  it('Home offers the Parcel card only while the tier is on and not during a ride (UI-R20b)', () => {
    const onParcel = jest.fn();
    // Tier off (or unknown): no service row, and the chip row never carries a parcel chip.
    const view = render(<HomeSheetBody {...homeBodyProps({ onParcel })} />);
    expect(screen.queryByTestId('home-send-parcel')).toBeNull();
    view.rerender(<HomeSheetBody {...homeBodyProps({ onParcel, servicesVisible: true })} />);
    fireEvent.press(screen.getByTestId('home-send-parcel'));
    expect(onParcel).toHaveBeenCalledTimes(1);
    // A live ride hides it, whatever the tier says.
    view.rerender(
      <HomeSheetBody {...homeBodyProps({ onParcel, servicesVisible: true, liveRide: { status: 'On the way' }, onReturnToRide: jest.fn() })} />,
    );
    expect(screen.queryByTestId('home-send-parcel')).toBeNull();
  });
});

describe('the form and the booking body', () => {
  it('maps GET /parcels/options (lists, limits, digits clamped to 4-6)', () => {
    expect(options).toMatchObject({
      tierActive: true,
      vehicleType: 'parcel',
      maxDeclaredValue: 10000,
      rulesVersion: '2026-10-16',
      codeDigits: 6,
      sizes: [{ key: 'small', label: 'Small (fits in a bag)', maxWeightKg: 2 }, expect.anything()],
    });
    expect(toParcelOptions(rawOptions({ code_digits: 9 })).codeDigits).toBe(6);
    expect(toParcelOptions(null).categories).toEqual([]);
  });

  it('validates the draft against the server lists and limits', () => {
    expect(Object.keys(validateParcelDraft(EMPTY_PARCEL_DRAFT, options)).sort()).toEqual(
      ['declaration', 'declaredValue', 'itemCategory', 'receiverName', 'receiverPhone', 'sizeClass'].sort(),
    );
    const errors = validateParcelDraft(
      { ...filled, receiverName: 'R2D2', receiverPhone: '2001234567', declaredValue: '10001', itemCategory: 'weapons' },
      options,
    );
    expect(errors.receiverName).toMatch(/letters only/);
    expect(errors.receiverPhone).toMatch(/Pakistani mobile/);
    expect(errors.declaredValue).toBe('We carry parcels worth up to Rs\u00A010,000.');
    expect(errors.itemCategory).toBeDefined();
    expect(validateParcelDraft(filled, options)).toEqual({});
  });

  it('builds POST /rides with vehicle_type parcel and the parcel block (no stops, no offer)', () => {
    const built = buildParcelRideRequest(A, B, filled, options);
    if (!built.ok) throw new Error('not built');
    expect(built.request).toEqual({
      pickup_address: 'Fake Pickup Street',
      dropoff_address: 'Fake Dropoff Road',
      pickup_latitude: 31.52,
      pickup_longitude: 74.35,
      dropoff_latitude: 31.48,
      dropoff_longitude: 74.3,
      vehicle_type: 'parcel',
      parcel: {
        receiver_name: 'Sana Khan',
        receiver_phone: '+923001234567',
        item_category: 'documents',
        size_class: 'small',
        declared_value: 2500,
        declaration_accepted: true,
        item_description: 'Two books',
        rules_version: '2026-10-16',
      },
    });
    const missing = buildParcelRideRequest(A, null, filled, options);
    expect(missing.ok === false && missing.errors.dropoff).toBe('Choose where the parcel goes.');
  });

  it('puts each 422 message under its field and flags changed rules', () => {
    const mapped = parcelFieldErrorsOf({
      fieldErrors: {
        'parcel.receiver_phone': ["Enter the receiver's Pakistani mobile number, e.g. 0300 1234567."],
        'parcel.rules_version': ['The parcel rules changed. Read them again and confirm.'],
        vehicle_type: ['This vehicle type is not available right now.'],
      },
    });
    expect(mapped.fields).toEqual({
      receiverPhone: "Enter the receiver's Pakistani mobile number, e.g. 0300 1234567.",
      declaration: 'The parcel rules changed. Read them again and confirm.',
    });
    expect(mapped.other).toBe('This vehicle type is not available right now.');
    expect(mapped.rulesChanged).toBe(true);
  });
});

describe('useSendParcel', () => {
  const handlers = () => ({ onBooked: jest.fn(), onPhoneNotVerified: jest.fn(), onBalanceOwed: jest.fn(), onRulesChanged: jest.fn() });

  const fillDraft = (result: { current: ReturnType<typeof useSendParcel> }) => {
    act(() => {
      result.current.update('receiverName', filled.receiverName, 'receiverName');
      result.current.update('receiverPhone', filled.receiverPhone, 'receiverPhone');
      result.current.update('itemCategory', 'documents', 'itemCategory');
      result.current.update('sizeClass', 'small', 'sizeClass');
      result.current.update('declaredValue', '2500', 'declaredValue');
      result.current.update('declarationAccepted', true, 'declaration');
      result.current.setDropoff(B);
    });
  };

  it('starts at the sender position, quotes the parcel tier and books it', async () => {
    mock.onPost('/rides/estimate').reply(200, envelope({
      distance_km: 4,
      duration_min: 10,
      estimates: [
        { vehicle_type: 'bike', fare: 150, currency: 'PKR', breakdown: {} },
        { vehicle_type: 'parcel', fare: 180, currency: 'PKR', parcel: true, breakdown: {} },
      ],
    }));
    const booked = parcelRide(senderParcel({ status: 'requested' }), { status: 'requested' });
    mock.onPost('/rides').reply(201, envelope(booked));
    const store = makeStore();
    const h = handlers();
    const { result } = renderHook(() => useSendParcel(options, { latitude: 31.52, longitude: 74.35 }, h), { wrapper: withStore(store) });
    await waitFor(() => expect(result.current.pickup?.address).toBe('Fake Pickup Street, Lahore'));
    fillDraft(result);
    await waitFor(() => expect(result.current.quote?.fare).toBe(180));
    await act(async () => {
      await result.current.submit();
    });
    const body = JSON.parse(mock.history.post.find((r) => r.url === '/rides')?.data ?? '{}');
    expect(body.vehicle_type).toBe('parcel');
    expect(body.parcel.receiver_phone).toBe('+923001234567');
    expect(body.stops).toBeUndefined();
    expect(body.offered_fare).toBeUndefined();
    expect(body.female_driver_only).toBeUndefined();
    expect(h.onBooked).toHaveBeenCalledWith(expect.objectContaining({ id: booked.id }));
    expect(store.getState().activeRide.ride?.id).toBe(booked.id);
  });

  it('shows a 422 under its field and reloads changed rules', async () => {
    mock.onPost('/rides/estimate').reply(200, envelope({ distance_km: 4, duration_min: 10, estimates: [] }));
    mock.onPost('/rides').reply(422, {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: {
          'parcel.declared_value': ['We carry parcels worth up to Rs 10,000. Send valuables another way.'],
          'parcel.rules_version': ['The parcel rules changed. Read them again and confirm.'],
        },
      },
    });
    const h = handlers();
    const { result } = renderHook(() => useSendParcel(options, { latitude: 31.52, longitude: 74.35 }, h), { wrapper: withStore(makeStore()) });
    fillDraft(result);
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.errors.declaredValue).toBe('We carry parcels worth up to Rs 10,000. Send valuables another way.');
    expect(result.current.draft.declarationAccepted).toBe(false);
    expect(h.onRulesChanged).toHaveBeenCalled();
    expect(h.onBooked).not.toHaveBeenCalled();
  });

  it('429 BOOKING_COOLDOWN: the server message in the form banner; Send is held, never retried', async () => {
    mock.onPost('/rides/estimate').reply(200, envelope({ distance_km: 4, duration_min: 10, estimates: [] }));
    const message = 'You cancelled several requests. You can book again in a few minutes.';
    mock.onPost('/rides').reply(
      429,
      { success: false, message, code: 'BOOKING_COOLDOWN', retry_after: 120, error: { code: 'BOOKING_COOLDOWN', message, retry_after: 120 } },
      { 'Retry-After': '120' },
    );
    const h = handlers();
    const { result } = renderHook(() => useSendParcel(options, { latitude: 31.52, longitude: 74.35 }, h), { wrapper: withStore(makeStore()) });
    try {
      fillDraft(result);
      await act(async () => {
        await result.current.submit();
      });
      expect(result.current.formError).toBe(message);
      expect(bookingCooldownSeconds()).toBeGreaterThan(115);
      expect(bookingCooldownSeconds()).toBeLessThanOrEqual(120);
      // A press that still lands while the hold runs sends nothing.
      await act(async () => {
        await result.current.submit();
      });
      expect(mock.history.post.filter((r) => r.url === '/rides')).toHaveLength(1);
      expect(h.onBooked).not.toHaveBeenCalled();
    } finally {
      resetBookingCooldown();
    }
  });

  it('BOOKING_COOLDOWN: the banner goes when the hold reaches 0', async () => {
    mock.onPost('/rides/estimate').reply(200, envelope({ distance_km: 4, duration_min: 10, estimates: [] }));
    const message = 'You cancelled several requests. You can book again in a few minutes.';
    mock.onPost('/rides').reply(429, { success: false, message, code: 'BOOKING_COOLDOWN', retry_after: 2 }, { 'Retry-After': '2' });
    const { result } = renderHook(() => useSendParcel(options, { latitude: 31.52, longitude: 74.35 }, handlers()), {
      wrapper: withStore(makeStore()),
    });
    try {
      fillDraft(result);
      await act(async () => {
        await result.current.submit();
      });
      expect(result.current.formError).toBe(message);
      await waitFor(() => expect(result.current.formError).toBeNull(), { timeout: 4_000 });
    } finally {
      resetBookingCooldown();
    }
  });
});

describe('SendParcelScreen', () => {
  it('builds the form from GET /parcels/options and shows what is missing', async () => {
    mock.onGet('/parcels/options').reply(200, envelope(rawOptions()));
    render(
      <Provider store={makeStore()}>
        <SendParcelScreen />
      </Provider>,
    );
    await waitFor(() => expect(screen.getByTestId('parcel-category-documents')).toBeTruthy());
    expect(screen.getByTestId('parcel-size-medium')).toBeTruthy();
    expect(screen.getByTestId('parcel-declaration-item-1')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('send-parcel-submit'));
    });
    await waitFor(() => expect(screen.getByTestId('parcel-dropoff-error')).toBeTruthy());
    expect(screen.getByTestId('parcel-declaration-error')).toBeTruthy();
    expect(mock.history.post.filter((r) => r.url === '/rides')).toHaveLength(0);
  });

  it('says so when the admin has the tier off', async () => {
    mock.onGet('/parcels/options').reply(200, envelope(rawOptions({ tier_active: false })));
    render(
      <Provider store={makeStore()}>
        <SendParcelScreen />
      </Provider>,
    );
    await waitFor(() => expect(screen.getByTestId('send-parcel-unavailable')).toBeTruthy());
    expect(screen.queryByTestId('send-parcel-submit')).toBeNull();
  });
});

describe('the sender live parcel', () => {
  it('reads the parcel for the sender: masked receiver only, return code only while returning', () => {
    const view = toParcelView(senderParcel());
    expect(view?.receiver).toEqual({ name: 'Sana Khan', phoneMasked: '+92300*****67' });
    expect(JSON.stringify(view)).not.toContain('+923001234567');
    expect(view?.returnCode).toBeNull();
    expect(toParcelView(senderParcel({ status: 'returning', return_code: '482913' }))?.returnCode).toBe('482913');
    expect(toParcelView(senderParcel({ status: 'picked_up', return_code: '482913' }))?.returnCode).toBeNull();
    expect(isParcelRide({ vehicle_type: 'car' })).toBe(false);
    expect(parcelOf(makeRide())).toBeNull();
  });

  it('lays the timeline out forward, on a return and after a cancel', () => {
    const states = (raw: Record<string, unknown>) => {
      const view = toParcelView(senderParcel(raw));
      if (!view) throw new Error('no parcel');
      return parcelTimeline(view).map((s) => `${s.key}:${s.state}`);
    };
    expect(states({ status: 'picked_up' })).toEqual([
      'requested:done', 'accepted:done', 'arrived:done', 'picked_up:current', 'delivered:upcoming',
    ]);
    expect(states({ status: 'returning', return_started_at: '2026-10-16T10:30:00Z' })).toEqual([
      'requested:done', 'accepted:done', 'arrived:done', 'picked_up:done', 'returning:current', 'returned:upcoming',
    ]);
    expect(states({ status: 'delivered' }).slice(-1)).toEqual(['delivered:done']);
    expect(states({ status: 'cancelled', picked_up_at: null })).toEqual(['requested:done', 'cancelled:current']);
  });

  it('the panel shows the parcel title, timeline, receiver, photo and the return code', () => {
    const store = makeStore();
    const ride = parcelRide(senderParcel({ status: 'returning', return_started_at: '2026-10-16T10:30:00Z', return_code: '482913' }));
    render(
      <Provider store={store}>
        <ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={jest.fn()} onDone={jest.fn()} />
      </Provider>,
    );
    // The title and the timeline's current step.
    expect(screen.getAllByText('Coming back to you')).toHaveLength(2);
    expect(screen.getByTestId('active-ride-parcel')).toBeTruthy();
    expect(screen.getByTestId('parcel-timeline-returning-current')).toBeTruthy();
    expect(screen.getByTestId('parcel-sender-receiver').props.children).toBe('Receiver: Sana Khan · •••• 67');
    expect(screen.getByTestId('parcel-return-code-value').props.children).toBe('482913');
    expect(screen.getByTestId('parcel-pickup-photo')).toBeTruthy();
    // Coming back: no delivery code to resend.
    expect(screen.queryByTestId('parcel-resend')).toBeNull();
    expect(screen.queryByTestId('active-ride-progress')).toBeNull();
  });

  it('"Send the code again" waits out the cool-down, then replaces the ride', async () => {
    jest.useFakeTimers({ now: Date.parse('2026-10-16T10:10:30Z') });
    try {
      const ride = parcelRide(senderParcel({ code: { ...senderParcel().code, resend_available_at: '2026-10-16T10:11:00Z' } }));
      const store = makeStore();
      store.dispatch(createActiveRide.fulfilled(ride, 'req', {} as never));
      render(
        <Provider store={store}>
          <ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={jest.fn()} onDone={jest.fn()} />
        </Provider>,
      );
      expect(screen.getByTestId('parcel-code-sent')).toBeTruthy();
      const button = screen.getByTestId('parcel-resend');
      expect(button.props.accessibilityState?.disabled).toBe(true);
      expect(screen.getByText('Send again in 0:30')).toBeTruthy();
      act(() => {
        jest.advanceTimersByTime(31_000);
      });
      expect(screen.getByText('Send the code again')).toBeTruthy();
      const resent = parcelRide(senderParcel({ code: { ...senderParcel().code, send_count: 2, sends_left: 1 } }));
      mock.onPost('/rides/41/parcel/resend-code').reply(200, envelope(resent));
      jest.useRealTimers();
      await act(async () => {
        fireEvent.press(screen.getByTestId('parcel-resend'));
      });
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('A new delivery code was sent to the receiver.', undefined, undefined));
      expect(toParcelView(store.getState().activeRide.ride?.parcel)?.code?.sendsLeft).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('the sender countdown stops its interval once the cool-down has passed', () => {
    jest.useFakeTimers({ now: Date.parse('2026-10-16T10:12:00Z') });
    try {
      const ride = parcelRide(senderParcel({ code: { ...senderParcel().code, resend_available_at: '2026-10-16T10:11:00Z' } }));
      render(
        <Provider store={makeStore()}>
          <ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={jest.fn()} onDone={jest.fn()} />
        </Provider>,
      );
      expect(screen.getByText('Send the code again')).toBeTruthy();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('a failed SMS is said, and the resend refusals have their own copy', () => {
    const ride = parcelRide(senderParcel({ code: { ...senderParcel().code, sms_failed: true } }));
    render(
      <Provider store={makeStore()}>
        <ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={jest.fn()} onDone={jest.fn()} />
      </Provider>,
    );
    expect(screen.getByTestId('parcel-code-sms-failed')).toBeTruthy();
    const base = { kind: 'rate_limited' as const, message: 'Too many' };
    expect(resendRefusalText({ ...base, code: 'PARCEL_CODE_COOLDOWN', extra: { retry_after: 42 } })).toBe('Wait 0:42 before sending the code again.');
    expect(resendRefusalText({ ...base, code: 'PARCEL_CODE_SEND_LIMIT' })).toMatch(/most times allowed/);
    expect(resendRefusalText({ kind: 'server', message: 'x', code: 'PARCEL_CODE_SMS_FAILED' })).toMatch(/couldn't be sent/);
    const view = toParcelView(senderParcel({ code: { ...senderParcel().code, can_resend: false } }));
    expect(resendState(view, Date.now()).visible).toBe(false);
  });

  it('activeRideReplaced ignores another ride', () => {
    const store = makeStore();
    const ride = parcelRide(senderParcel());
    store.dispatch(createActiveRide.fulfilled(ride, 'req', {} as never));
    store.dispatch(activeRideReplaced(parcelRide(senderParcel(), { id: 99 })));
    expect(store.getState().activeRide.ride?.id).toBe(41);
  });
});
