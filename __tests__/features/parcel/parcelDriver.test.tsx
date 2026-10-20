/**
 * T-522 (BE-88) parcel delivery, the driver's side: the request card (category, size, cash at
 * the pickup; never the receiver or the value); the Account opt-in (rules accepted first, 409
 * NO_APPROVED_BIKE); the ride flow on the parcel endpoints instead of start/complete: pickup
 * (camera photo + PIN, multipart), deliver with the receiver's code (tries left, lock, block),
 * return with a reason, hand back with the sender's code, refuse at the pickup; the receiver
 * call (proxy or chat only); PARCEL_STEP_REQUIRED.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Linking } from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { expandTripSheet } from '../../../test-utils/tripSheet';
import { apiClient } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { toast } from '../../../src/core/toast';
import { clearQueryCache } from '../../../src/core/api/queryCache';
import { RequestSheetContent } from '../../../src/components/driver/request/RequestSheetContent';
import { DriverTripSheet } from '../../../src/features/driver-ride/trip/DriverTripSheet';
import { toPendingRideRequest } from '../../../src/features/driver-requests/api';
import { driverRideRefusalToast } from '../../../src/features/driver-ride/hooks';
import { rideStep } from '../../../src/features/driver-ride/steps';
import { buildReasonBody, toParcelOptIn, toParcelRequestSummary } from '../../../src/features/parcel/api';
import { codeRefusalOf } from '../../../src/features/parcel/rules';
import { toParcelPhotoPick } from '../../../src/features/parcel/photo';
import { useDriverParcel } from '../../../src/features/parcel/useDriverParcel';
import { ParcelCodeSheet } from '../../../src/features/parcel/components/ParcelCodeSheet';
import { DriverParcelSection } from '../../../src/features/parcel/components/DriverParcelSection';
import { toParcelView } from '../../../src/features/parcel/api';
import {
  driverRideWriteAnswered,
  parcelDriverStep,
  refreshDriverRide,
} from '../../../src/features/driver-ride/slice';
import type { RideResource } from '../../../src/services/rideService';
import { envelope, makeRide } from '../../../test-utils/rideFixtures';
import { makePendingRequest, pendingRide } from '../../../test-utils/driverRequestFixtures';

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => ({ goBack: mockGoBack }), useIsFocused: () => true };
});
const ParcelOptInScreen = require('../../../src/features/parcel/screens/ParcelOptInScreen').default;

let mock: MockAdapter;

beforeEach(() => {
  clearQueryCache();
  mock = new MockAdapter(apiClient);
  jest.spyOn(toast, 'success').mockImplementation(() => '');
  jest.spyOn(toast, 'error').mockImplementation(() => '');
  jest.spyOn(toast, 'info').mockImplementation(() => '');
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

/** The assigned driver's parcel block (BE-88 present() for the driver: phone null, masked only). */
const driverParcel = (over: Record<string, unknown> = {}) => ({
  status: 'arrived',
  item_category: 'documents',
  item_category_label: 'Documents and papers',
  size_class: 'small',
  size_label: 'Small (fits in a bag)',
  max_weight_kg: 2,
  item_description: 'Two books',
  declared_value: 2500,
  receiver: { name: 'Sana Khan', phone: null, phone_masked: '+92300*****67' },
  pickup_photo_url: null,
  code: {
    digits: 6,
    purpose: null,
    sent: false,
    send_count: 0,
    sends_left: 3,
    sms_failed: false,
    can_resend: false,
    resend_available_at: null,
    attempts_left: 5,
    locked_until: null,
    blocked: false,
    delivery_blocked: false,
  },
  can_call_receiver: false,
  ...over,
});

const pickedUp = (over: Record<string, unknown> = {}) =>
  driverParcel({
    status: 'picked_up',
    can_call_receiver: true,
    code: { ...driverParcel().code, purpose: 'delivery', sent: true, send_count: 1, sends_left: 2, can_resend: true },
    ...over,
  });

const parcelRide = (parcel: Record<string, unknown>, over: Partial<RideResource> = {}): RideResource =>
  makeRide({ vehicle_type: 'parcel', is_parcel: true, status: 'arrived', driver_id: 5, parcel, fare: '180.00', ...over });

const storeWith = (ride: RideResource) => {
  const initial = rootReducer(undefined, { type: '@@fixtures/init' });
  return configureStore({
    reducer: rootReducer,
    preloadedState: { ...initial, driverRide: { ride, pendingAction: null, pendingRequestId: null } },
  });
};
type Store = ReturnType<typeof storeWith>;

const useParcelFromStore = (onMessage: () => void) => {
  const { useSelector } = jest.requireActual('react-redux');
  const ride = useSelector((s: ReturnType<Store['getState']>) => s.driverRide.ride);
  const pending = useSelector((s: ReturnType<Store['getState']>) => s.driverRide.pendingAction);
  return useDriverParcel({ ride, step: rideStep(ride), pendingAction: pending, onMessage });
};

const hookFor = (store: Store, onMessage = jest.fn()) =>
  renderHook(() => useParcelFromStore(onMessage), {
    wrapper: ({ children }: { children: React.ReactNode }) => <Provider store={store}>{children}</Provider>,
  });

const panelProps = (ride: RideResource) => ({
  ride,
  step: rideStep(ride),
  pendingAction: null,
  canCall: false,
  canNavigate: false,
  onCall: jest.fn(),
  onNavigate: jest.fn(),
  onArrived: jest.fn(),
  onStart: jest.fn(),
  onComplete: jest.fn(),
  onCompleteStop: jest.fn(),
  onCancel: jest.fn(),
});

describe('request card', () => {
  it('shows what is carried and the cash at the pickup, never the receiver or the value', () => {
    const raw = pendingRide({ vehicle_type: 'parcel', is_parcel: true, parcel: { status: 'requested', item_category: 'documents', item_category_label: 'Documents and papers', size_class: 'small', size_label: 'Small (fits in a bag)', max_weight_kg: 2 } });
    const request = toPendingRideRequest(raw, 10);
    expect(request?.parcel).toEqual({ categoryLabel: 'Documents and papers', sizeLabel: 'Small (fits in a bag)', maxWeightKg: 2 });
    render(<RequestSheetContent request={request ?? makePendingRequest()} moreCount={0} compact={false} />);
    expect(screen.getByTestId('incoming-request-parcel-badge')).toBeTruthy();
    expect(screen.getByTestId('incoming-request-parcel-item').props.children).toBe('Documents and papers · Small (fits in a bag)');
    expect(screen.getByTestId('incoming-request-parcel-cash').props.children).toBe('Cash collected at the pickup');
    expect(screen.queryByText(/Sana/)).toBeNull();
    expect(toParcelRequestSummary({ vehicle_type: 'car' })).toBeNull();
  });

  it('a ride request has no parcel block', () => {
    render(<RequestSheetContent request={makePendingRequest()} moreCount={0} compact={false} />);
    expect(screen.queryByTestId('incoming-request-parcel')).toBeNull();
  });
});

describe('Account → Parcel deliveries', () => {
  const optIn = (over: Record<string, unknown> = {}) => ({
    parcel_opt_in: false,
    opted_in_at: null,
    has_approved_bike: true,
    tier_active: true,
    gets_parcel_requests: false,
    prohibited_items: ['Cash or jewellery', 'Weapons'],
    rules_version: '2026-10-16',
    ...over,
  });

  it('asks for the rules before opting in, then posts enabled + accept_rules', async () => {
    mock.onGet('/driver/parcels/opt-in').reply(200, envelope(optIn()));
    mock.onPost('/driver/parcels/opt-in').reply(200, envelope(optIn({ parcel_opt_in: true, gets_parcel_requests: true })));
    render(<ParcelOptInScreen />);
    await waitFor(() => expect(screen.getByTestId('parcel-opt-in-switch')).toBeTruthy());
    await act(async () => {
      fireEvent(screen.getByTestId('parcel-opt-in-switch'), 'valueChange', true);
    });
    expect(screen.getByTestId('parcel-opt-in-accept-error')).toBeTruthy();
    expect(mock.history.post).toHaveLength(0);
    fireEvent.press(screen.getByTestId('parcel-opt-in-accept'));
    await act(async () => {
      fireEvent(screen.getByTestId('parcel-opt-in-switch'), 'valueChange', true);
    });
    await waitFor(() => expect(screen.getByTestId('parcel-opt-in-gets')).toBeTruthy());
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ enabled: true, accept_rules: true });
  });

  it('says a bike is needed on 409 NO_APPROVED_BIKE', async () => {
    mock.onGet('/driver/parcels/opt-in').reply(200, envelope(optIn()));
    mock.onPost('/driver/parcels/opt-in').reply(409, { success: false, error: { code: 'NO_APPROVED_BIKE', message: 'You need an approved bike to deliver parcels' } });
    render(<ParcelOptInScreen />);
    await waitFor(() => expect(screen.getByTestId('parcel-opt-in-accept')).toBeTruthy());
    fireEvent.press(screen.getByTestId('parcel-opt-in-accept'));
    await act(async () => {
      fireEvent(screen.getByTestId('parcel-opt-in-switch'), 'valueChange', true);
    });
    await waitFor(() => expect(screen.getByTestId('parcel-opt-in-save-error')).toBeTruthy());
    expect(toParcelOptIn(optIn({ has_approved_bike: false })).hasApprovedBike).toBe(false);
  });
});

describe('the driver panel on a parcel', () => {
  it('at the pickup: Pick up parcel and Refuse parcel instead of Start trip, with the cash to collect', () => {
    const store = storeWith(parcelRide(driverParcel()));
    const { result } = hookFor(store);
    const ride = store.getState().driverRide.ride as RideResource;
    render(<DriverTripSheet onDone={() => undefined} onRatingChange={() => undefined} {...panelProps(ride)} parcel={result.current.panel} />);
    expandTripSheet(); // the parcel block and the cash line are in the details
    expect(screen.getByTestId('driver-parcel-pickup')).toBeTruthy();
    expect(screen.getByTestId('driver-parcel-refuse')).toBeTruthy();
    expect(screen.queryByTestId('driver-ride-start')).toBeNull();
    expect(screen.getByText('Collect Rs 180 in cash from the sender')).toBeTruthy();
    expect(screen.getByTestId('driver-parcel-receiver').props.children).toBe('Receiver: Sana Khan · •••• 67');
  });

  it('with the parcel: Deliver and Return; coming back: Hand back; a blocked code leaves the return', () => {
    const withParcel = parcelRide(pickedUp(), { status: 'started' });
    const first = hookFor(storeWith(withParcel));
    const { unmount } = render(<DriverTripSheet onDone={() => undefined} onRatingChange={() => undefined} {...panelProps(withParcel)} parcel={first.result.current.panel} />);
    expandTripSheet(); // the parcel block and the cash line are in the details
    expect(screen.getByTestId('driver-parcel-deliver')).toBeTruthy();
    expect(screen.getByTestId('driver-parcel-return')).toBeTruthy();
    expect(screen.getByTestId('driver-parcel-call-receiver')).toBeTruthy();
    expect(screen.getByTestId('driver-parcel-resend')).toBeTruthy();
    expect(screen.queryByTestId('driver-ride-complete')).toBeNull();
    unmount();

    const returning = parcelRide(driverParcel({ status: 'returning' }), { status: 'started' });
    const second = hookFor(storeWith(returning));
    const r2 = render(<DriverTripSheet onDone={() => undefined} onRatingChange={() => undefined} {...panelProps(returning)} parcel={second.result.current.panel} />);
    expandTripSheet(); // the parcel block and the cash line are in the details
    expect(screen.getByTestId('driver-parcel-hand-back')).toBeTruthy();
    expect(screen.queryByTestId('driver-parcel-deliver')).toBeNull();
    r2.unmount();

    const blocked = parcelRide(pickedUp({ code: { ...pickedUp().code, blocked: true, can_resend: false } }), { status: 'started' });
    const third = hookFor(storeWith(blocked));
    render(<DriverTripSheet onDone={() => undefined} onRatingChange={() => undefined} {...panelProps(blocked)} parcel={third.result.current.panel} />);
    expandTripSheet(); // the parcel block and the cash line are in the details
    expect(screen.getByTestId('driver-parcel-return')).toBeTruthy();
    expect(screen.queryByTestId('driver-parcel-deliver')).toBeNull();
    expect(screen.getByTestId('driver-parcel-code-blocked')).toBeTruthy();
  });
});

describe('the parcel steps', () => {
  it('pickup: camera photo + the PIN as multipart to /parcel/pickup', async () => {
    (launchCamera as jest.Mock).mockResolvedValueOnce({ assets: [{ uri: 'file:///tmp/p.jpg', type: 'image/jpeg', fileSize: 120_000 }] });
    // Jest has Node's FormData, which cannot hold an RN file part: check what was appended.
    const append = jest.spyOn(FormData.prototype, 'append').mockImplementation(() => undefined);
    const store = storeWith(parcelRide(driverParcel(), { pin_required: true }));
    const done = parcelRide(pickedUp(), { status: 'started' });
    mock.onPost('/rides/41/parcel/pickup').reply(200, envelope(done));
    const { result } = hookFor(store);
    act(() => result.current.panel?.primary?.onPress());
    expect(result.current.sheets.pickup.visible).toBe(true);
    expect(result.current.sheets.pickup.pinRequired).toBe(true);
    await act(async () => {
      await result.current.sheets.pickup.onTakePhoto();
    });
    expect(result.current.sheets.pickup.photo?.type).toBe('image/jpeg');
    act(() => result.current.sheets.pickup.onPinChange('0427'));
    await act(async () => {
      await result.current.sheets.pickup.onSubmit();
    });
    const request = mock.history.post[0];
    expect(request.url).toBe('/rides/41/parcel/pickup');
    expect(request.data).toBeInstanceOf(FormData);
    expect(append.mock.calls).toEqual([
      ['photo', { uri: 'file:///tmp/p.jpg', name: 'parcel.jpg', type: 'image/jpeg' }],
      ['pin', '0427'],
    ]);
    expect(request.headers?.['Content-Type']).toBe('multipart/form-data');
    expect(store.getState().driverRide.ride?.status).toBe('started');
    expect(result.current.sheets.pickup.visible).toBe(false);
    expect(toast.success).toHaveBeenCalledWith('Parcel picked up', undefined, expect.anything());
  });

  it('pickup: a wrong PIN stays in the sheet with the tries left', async () => {
    (launchCamera as jest.Mock).mockResolvedValueOnce({ assets: [{ uri: 'file:///tmp/p.jpg', type: 'image/jpeg' }] });
    const store = storeWith(parcelRide(driverParcel(), { pin_required: true }));
    mock.onPost('/rides/41/parcel/pickup').reply(422, { success: false, error: { code: 'PIN_INVALID', message: 'Wrong PIN', attempts_left: 2 } });
    const { result } = hookFor(store);
    act(() => result.current.panel?.primary?.onPress());
    await act(async () => {
      await result.current.sheets.pickup.onTakePhoto();
    });
    act(() => result.current.sheets.pickup.onPinChange('1111'));
    await act(async () => {
      await result.current.sheets.pickup.onSubmit();
    });
    expect(result.current.sheets.pickup.visible).toBe(true);
    expect(result.current.sheets.pickup.error).toBe("That PIN isn't right. 2 attempts left.");
  });

  it('deliver: wrong code with tries left, then a lock, then delivered', async () => {
    const store = storeWith(parcelRide(pickedUp(), { status: 'started' }));
    const { result } = hookFor(store);
    act(() => result.current.panel?.primary?.onPress());
    expect(result.current.sheets.code).toMatchObject({ visible: true, purpose: 'deliver', digits: 6 });

    mock.onPost('/rides/41/parcel/deliver').replyOnce(422, { success: false, error: { code: 'PARCEL_CODE_INVALID', message: 'x', attempts_left: 3 } });
    await act(async () => {
      await result.current.sheets.code.onSubmit('111111');
    });
    expect(result.current.sheets.code.error).toBe('That code is not right. 3 tries left.');
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ code: '111111' });

    mock.onPost('/rides/41/parcel/deliver').replyOnce(423, { success: false, error: { code: 'PARCEL_CODE_LOCKED', message: 'x', retry_after: 300 } }, { 'retry-after': '300' });
    await act(async () => {
      await result.current.sheets.code.onSubmit('222222');
    });
    expect(result.current.sheets.code.lockedSeconds).toBeGreaterThan(290);

    const delivered = parcelRide(driverParcel({ status: 'delivered' }), { status: 'completed' });
    mock.onPost('/rides/41/parcel/deliver').replyOnce(200, envelope(delivered));
    await act(async () => {
      await result.current.sheets.code.onSubmit('333333');
    });
    expect(store.getState().driverRide.ride?.status).toBe('completed');
    expect(toast.success).toHaveBeenCalledWith('Parcel delivered', undefined, expect.anything());
  });

  it('deliver: a blocked code hides the entry and re-reads the ride', async () => {
    const store = storeWith(parcelRide(pickedUp(), { status: 'started' }));
    mock.onPost('/rides/41/parcel/deliver').reply(423, { success: false, error: { code: 'PARCEL_CODE_BLOCKED', message: 'x' } });
    mock.onGet('/rides/41').reply(200, envelope(parcelRide(pickedUp({ code: { ...pickedUp().code, blocked: true } }), { status: 'started' })));
    const { result } = hookFor(store);
    act(() => result.current.panel?.primary?.onPress());
    await act(async () => {
      await result.current.sheets.code.onSubmit('111111');
    });
    expect(result.current.sheets.code.blocked).toBe(true);
    await waitFor(() => expect(mock.history.get.some((r) => r.url === '/rides/41')).toBe(true));
  });

  it('a blocked delivery code does not block the return code', async () => {
    const store = storeWith(parcelRide(pickedUp(), { status: 'started' }));
    mock.onPost('/rides/41/parcel/deliver').reply(423, { success: false, error: { code: 'PARCEL_CODE_BLOCKED', message: 'x' } });
    mock.onGet('/rides/41').reply(200, envelope(parcelRide(pickedUp({ code: { ...pickedUp().code, blocked: true } }), { status: 'started' })));
    const { result } = hookFor(store);
    act(() => result.current.panel?.primary?.onPress());
    await act(async () => {
      await result.current.sheets.code.onSubmit('111111');
    });
    expect(result.current.sheets.code.blocked).toBe(true);
    const returning = parcelRide(driverParcel({ status: 'returning', code: { ...driverParcel().code, purpose: 'return', delivery_blocked: true } }), { status: 'started' });
    mock.onPost('/rides/41/parcel/return').reply(200, envelope(returning));
    mock.onGet('/parcels/options').reply(200, envelope({ return_reasons: [{ key: 'code_blocked', label: 'Delivery code blocked' }] }));
    act(() => result.current.panel?.primary?.onPress());
    await act(async () => {
      await result.current.sheets.reason.onSubmit('code_blocked', '');
    });
    act(() => result.current.panel?.primary?.onPress());
    expect(result.current.sheets.code).toMatchObject({ visible: true, purpose: 'returned', blocked: false });
  });

  it('return with a reason, then hand back with the sender code', async () => {
    mock.onGet('/parcels/options').reply(200, envelope({ return_reasons: [{ key: 'receiver_unavailable', label: 'Receiver not available' }], refusal_reasons: [] }));
    const store = storeWith(parcelRide(pickedUp(), { status: 'started' }));
    const { result } = hookFor(store);
    act(() => result.current.panel?.secondary?.onPress());
    await waitFor(() => expect(result.current.sheets.reason.reasons).toEqual([{ key: 'receiver_unavailable', label: 'Receiver not available' }]));
    expect(result.current.sheets.reason.kind).toBe('return');
    mock.onPost('/rides/41/parcel/return').reply(200, envelope(parcelRide(driverParcel({ status: 'returning' }), { status: 'started' })));
    await act(async () => {
      await result.current.sheets.reason.onSubmit('receiver_unavailable', '  Not home  ');
    });
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ reason: 'receiver_unavailable', note: 'Not home' });
    expect(result.current.panel?.primary?.testID).toBe('driver-parcel-hand-back');

    act(() => result.current.panel?.primary?.onPress());
    expect(result.current.sheets.code.purpose).toBe('returned');
    mock.onPost('/rides/41/parcel/returned').reply(200, envelope(parcelRide(driverParcel({ status: 'returned' }), { status: 'completed' })));
    await act(async () => {
      await result.current.sheets.code.onSubmit('654321');
    });
    expect(store.getState().driverRide.ride?.status).toBe('completed');
  });

  it('refuse at the pickup ends the ride (no strike) and re-reads the driver status', async () => {
    mock.onGet('/parcels/options').reply(200, envelope({ refusal_reasons: [{ key: 'prohibited_item', label: 'Looks like a prohibited item' }] }));
    mock.onGet('/driver/status').reply(200, envelope({ status: 'online' }));
    const store = storeWith(parcelRide(driverParcel()));
    const { result } = hookFor(store);
    act(() => result.current.panel?.secondary?.onPress());
    expect(result.current.sheets.reason.kind).toBe('refuse');
    mock.onPost('/rides/41/parcel/refuse').reply(200, envelope(parcelRide(driverParcel({ status: 'cancelled' }), { status: 'cancelled' })));
    await act(async () => {
      await result.current.sheets.reason.onSubmit('prohibited_item', '');
    });
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ reason: 'prohibited_item' });
    expect(store.getState().driverRide.ride?.status).toBe('cancelled');
    expect(toast.success).toHaveBeenCalledWith('Parcel refused. No strike was recorded', undefined, expect.anything());
  });

  it('calls the receiver through the bridge, or opens the chat when calls are chat only', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const onMessage = jest.fn();
    const { result } = hookFor(storeWith(parcelRide(pickedUp(), { status: 'started' })), onMessage);
    mock.onPost('/rides/41/parcel/call-receiver').replyOnce(200, envelope({ mode: 'proxy', number: '+924212345678', expires_at: '2026-10-16T11:00:00Z' }));
    await act(async () => {
      await result.current.panel?.onCallReceiver?.();
    });
    expect(open).toHaveBeenCalledWith('tel:%2B924212345678');
    mock.onPost('/rides/41/parcel/call-receiver').replyOnce(200, envelope({ mode: 'chat_only' }));
    await act(async () => {
      await result.current.panel?.onCallReceiver?.();
    });
    expect(onMessage).toHaveBeenCalled();
  });
});

describe('codes and refusals', () => {
  it('maps the code refusals', () => {
    const base = { message: 'x', fieldErrors: {} };
    expect(codeRefusalOf({ ...base, kind: 'validation', code: 'PARCEL_CODE_INVALID', extra: { attempts_left: 1 } })).toEqual({ kind: 'invalid', message: 'That code is not right. 1 tries left.' });
    expect(codeRefusalOf({ ...base, kind: 'unknown', code: 'PARCEL_CODE_LOCKED', retryAfter: 120 })).toEqual({ kind: 'locked', seconds: 120 });
    expect(codeRefusalOf({ ...base, kind: 'unknown', code: 'PARCEL_CODE_BLOCKED' }).kind).toBe('blocked');
    expect(codeRefusalOf({ ...base, kind: 'conflict', code: 'PARCEL_WRONG_STEP' })).toMatchObject({ kind: 'other', refresh: true });
    expect(codeRefusalOf({ ...base, kind: 'validation', fieldErrors: { code: ['The code has 6 digits.'] } })).toEqual({ kind: 'invalid', message: 'The code has 6 digits.' });
    expect(codeRefusalOf({ ...base, kind: 'server', code: 'boom', message: 'SQLSTATE' })).toMatchObject({ message: "Couldn't do that. Please try again." });
  });

  it('PARCEL_STEP_REQUIRED from start / complete says to use the parcel steps', () => {
    expect(driverRideRefusalToast({ kind: 'conflict', code: 'PARCEL_STEP_REQUIRED', message: 'x', fieldErrors: {} }, 'fallback').title).toMatch(/This is a parcel/);
  });

  it('cuts the note and leaves an empty one out', () => {
    expect(buildReasonBody('other', ' ')).toEqual({ reason: 'other' });
    expect(buildReasonBody('other', 'a'.repeat(250)).note).toHaveLength(200);
  });

  it('accepts only camera photos the server takes', () => {
    expect(toParcelPhotoPick({ didCancel: true })).toBeNull();
    expect(toParcelPhotoPick({ errorCode: 'permission' })).toEqual({ problem: 'permission' });
    expect(toParcelPhotoPick({ assets: [{ uri: 'file:///a.heic', type: 'image/heic' }] })).toEqual({ problem: 'wrongType' });
    expect(toParcelPhotoPick({ assets: [{ uri: 'file:///a.jpg', type: 'image/jpeg', fileSize: 6 * 1024 * 1024 }] })).toEqual({ problem: 'tooLarge' });
    expect(toParcelPhotoPick({ assets: [{ uri: 'file:///a.jpg', type: 'image/jpg' }] })).toEqual({ file: { uri: 'file:///a.jpg', name: 'parcel.jpg', type: 'image/jpeg' } });
  });

  it('the code sheet submits on the last digit and hides the entry once blocked', () => {
    const onSubmit = jest.fn();
    const props = { visible: true, purpose: 'deliver' as const, digits: 6, submitting: false, error: null, lockedSeconds: 0, blocked: false, attempt: 0, onSubmit, onClose: jest.fn() };
    const { rerender } = render(<ParcelCodeSheet {...props} />);
    fireEvent.changeText(screen.getByTestId('parcel-code-input-input'), '123456');
    expect(onSubmit).toHaveBeenCalledWith('123456');
    rerender(<ParcelCodeSheet {...props} blocked />);
    expect(screen.queryByTestId('parcel-code-input-input')).toBeNull();
    expect(screen.queryByTestId('parcel-code-submit')).toBeNull();
  });
});

describe('performance and races', () => {
  const coolDown = (iso: string) => pickedUp({ code: { ...pickedUp().code, resend_available_at: iso } });

  it('the ride hook does not re-render each second during the resend cool-down', () => {
    jest.useFakeTimers({ now: Date.parse('2026-10-16T10:10:30Z') });
    try {
      let renders = 0;
      const store = storeWith(parcelRide(coolDown('2026-10-16T10:11:00Z'), { status: 'started' }));
      const { result } = renderHook(
        () => {
          renders += 1;
          return useParcelFromStore(jest.fn());
        },
        { wrapper: ({ children }: { children: React.ReactNode }) => <Provider store={store}>{children}</Provider> },
      );
      const panel = result.current.panel;
      const before = renders;
      act(() => {
        jest.advanceTimersByTime(5_000);
      });
      expect(renders).toBe(before);
      // parcelOf is memoised on the ride: the panel keeps its identity.
      expect(result.current.panel).toBe(panel);
    } finally {
      jest.useRealTimers();
    }
  });

  it('the section counts down, then stops its interval; none runs once the time has passed', () => {
    jest.useFakeTimers({ now: Date.parse('2026-10-16T10:10:58Z') });
    try {
      const base = { fare: 180, callingReceiver: false, resending: false, onResend: jest.fn() };
      const live = toParcelView(coolDown('2026-10-16T10:11:00Z'));
      if (!live) throw new Error('no parcel');
      const { unmount } = render(<DriverParcelSection {...base} parcel={live} resendAvailableAt="2026-10-16T10:11:00Z" />);
      expect(screen.getByText('Send again in 0:02')).toBeTruthy();
      act(() => {
        jest.advanceTimersByTime(3_000);
      });
      expect(screen.getByText('Send the code again')).toBeTruthy();
      expect(jest.getTimerCount()).toBe(0);
      unmount();

      render(<DriverParcelSection {...base} parcel={live} resendAvailableAt="2026-10-16T10:00:00Z" />);
      expect(screen.getByText('Send the code again')).toBeTruthy();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('a parcel step takes over an in-flight background read; the older read answer is dropped', async () => {
    mock.onGet('/rides/41').reply(
      () => new Promise((resolve) => setTimeout(() => resolve([200, envelope(parcelRide(driverParcel(), { status: 'arrived' }))]), 30)),
    );
    mock.onPost('/rides/41/parcel/refuse').reply(200, envelope(parcelRide(driverParcel({ status: 'cancelled' }), { status: 'cancelled' })));
    const store = storeWith(parcelRide(driverParcel()));
    const read = store.dispatch(refreshDriverRide(41));
    expect(store.getState().driverRide.pendingAction).toBe('refresh');
    const step = await store.dispatch(parcelDriverStep({ rideId: 41, step: 'refuse', reason: 'over_size' }));
    expect(parcelDriverStep.fulfilled.match(step)).toBe(true);
    expect(store.getState().driverRide.ride?.status).toBe('cancelled');
    expect(store.getState().driverRide.pendingAction).toBeNull();
    await read;
    expect(store.getState().driverRide.ride?.status).toBe('cancelled');
    expect(store.getState().driverRide.pendingAction).toBeNull();
  });

  it('a resend answer is applied only to the current, active ride with no step in flight', () => {
    const ride = parcelRide(pickedUp(), { status: 'started' });
    const resent = parcelRide(pickedUp({ code: { ...pickedUp().code, sends_left: 1 } }), { status: 'started' });
    const store = storeWith(ride);
    store.dispatch(driverRideWriteAnswered({ ...resent, id: 99 }));
    expect(store.getState().driverRide.ride).toBe(ride);
    store.dispatch(parcelDriverStep.pending('step-1', { rideId: 41, step: 'deliver', code: '123456' }));
    store.dispatch(driverRideWriteAnswered(resent));
    expect(store.getState().driverRide.ride?.parcel).toEqual(ride.parcel);
    const idle = storeWith(ride);
    idle.dispatch(refreshDriverRide.pending('read-1', 41));
    idle.dispatch(driverRideWriteAnswered(resent));
    expect(idle.getState().driverRide.ride?.parcel).toEqual(resent.parcel);
    // It took over the read: that read's later answer is dropped.
    expect(idle.getState().driverRide.pendingAction).toBeNull();
    idle.dispatch(refreshDriverRide.fulfilled(ride, 'read-1', 41));
    expect(idle.getState().driverRide.ride?.parcel).toEqual(resent.parcel);
    const ended = storeWith(parcelRide(driverParcel({ status: 'delivered' }), { status: 'completed' }));
    ended.dispatch(driverRideWriteAnswered(resent));
    expect(ended.getState().driverRide.ride?.status).toBe('completed');
  });
});
