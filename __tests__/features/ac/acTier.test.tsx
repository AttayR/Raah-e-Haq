/**
 * T-522 (BE-86) AC tier in the app: the catalogue's `ac` flag and the AC badge on the Car AC
 * option, the live ride and the driver's request; the passenger's "AC not working" report
 * (POST /rides/{id}/report-ac) and its refund status; the driver's Vehicle AC screen
 * (GET/POST /driver/vehicle/ac); the registration AC switch; the AC strike and accept refusal.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { apiClient } from '../../../src/services/api';
import { toast } from '../../../src/core/toast';
import ActiveRidePanel from '../../../src/features/active-ride/components/ActiveRidePanel';
import { advanceRideStage, type PassengerRideStageState } from '../../../src/features/active-ride/stage';
import { AcReportSection } from '../../../src/features/ac/components/AcReportSection';
import { RegistrationAcSwitch } from '../../../src/features/ac/components/RegistrationAcSwitch';
import { acReportRefusal } from '../../../src/features/ac/hooks';
import { acReportStatusText } from '../../../src/features/ac/format';
import {
  acAllowedFor,
  buildAcReportBody,
  isAcRide,
  toAcReportState,
  toRegistrationVehicleRules,
  toVehicleAcSummary,
  vehicleYearOptions,
} from '../../../src/features/ac/api';
import VehicleInfoStep from '../../../src/screens/Auth/steps/VehicleInfoStep';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { normalizeFareEstimates, normalizeVehicleTypes } from '../../../src/features/ride-booking/api';
import { toVehicleOptions } from '../../../src/features/ride-booking/vehicleOptions';
import { VehicleOptionCard } from '../../../src/components/ui';
import { buildRideRequest } from '../../../src/features/ride-booking/buildRideRequest';
import { buildRegistrationRequest } from '../../../src/features/auth/registration/buildRegistrationRequest';
import { INITIAL_REGISTRATION_FORM } from '../../../src/features/auth/registration/registrationForm';
import { mapRegistrationServerErrors } from '../../../src/features/auth/registration/serverFieldErrors';
import { strikeKindLabel } from '../../../src/features/driver-statements/screens/DriverStrikesScreen';
import { acceptRefusalMessage } from '../../../src/features/driver-requests/hooks';
import { ApiError } from '../../../src/core/api/errors';
import type { RideResource } from '../../../src/services/rideService';
import { makeRide } from '../../../test-utils/rideFixtures';

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => ({ goBack: mockGoBack }), useIsFocused: () => true };
});
// Required after the mock, so the screen sees the mocked navigation hooks.
const VehicleAcScreen = require('../../../src/features/ac/screens/VehicleAcScreen').default;

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  jest.spyOn(toast, 'success').mockImplementation(() => '');
  jest.spyOn(toast, 'info').mockImplementation(() => '');
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

const stateOf = (ride: RideResource): PassengerRideStageState => {
  const state = advanceRideStage(null, ride);
  if (!state) throw new Error('no stage');
  return state;
};

describe('catalogue and booking', () => {
  it('keeps car_ac (an admin-activated tier) with its ac flag; other types carry no flag', () => {
    const types = normalizeVehicleTypes([
      { key: 'car', label: 'Car', capacity: 4, ac: false, base_vehicle_type: 'car' },
      { key: 'car_ac', label: 'Car AC', capacity: 4, ac: true, base_vehicle_type: 'car' },
    ]);
    expect(types).toEqual([
      { key: 'car', label: 'Car', capacity: 4 },
      { key: 'car_ac', label: 'Car AC', capacity: 4, ac: true },
    ]);
    const estimates = normalizeFareEstimates({
      distance_km: 5,
      duration_min: 12,
      estimates: [{ vehicle_type: 'car_ac', fare: 420, currency: 'PKR', ac: true, base_vehicle_type: 'car', breakdown: {} }],
    });
    const options = toVehicleOptions(types, estimates);
    expect(options.map((o) => [o.id, o.ac, o.unavailable])).toEqual([
      ['car', false, true],
      ['car_ac', true, false],
    ]);
  });

  it('books the AC tier as vehicle_type car_ac', () => {
    const built = buildRideRequest({
      pickup: { latitude: 31.5, longitude: 74.3, address: 'A' },
      dropoff: { latitude: 31.6, longitude: 74.4, address: 'B' },
      vehicleType: 'car_ac',
    });
    expect(built.ok && built.request.vehicle_type).toBe('car_ac');
  });

  it('the Car AC option shows the AC badge and says it to screen readers', () => {
    render(<VehicleOptionCard vehicleKey="car_ac" name="Car AC" meta="4 seats" fare="Rs 420" ac onPress={jest.fn()} testID="opt" />);
    expect(screen.getByTestId('opt-ac')).toBeTruthy();
    expect(screen.getByTestId('opt').props.accessibilityLabel).toBe('Car AC, Air-conditioned car, 4 seats, Rs 420');
  });

  it('a plain car has no AC badge', () => {
    render(<VehicleOptionCard vehicleKey="car" name="Car" onPress={jest.fn()} testID="opt" />);
    expect(screen.queryByTestId('opt-ac')).toBeNull();
  });
});

describe('mappers', () => {
  it('reads is_ac (or the car_ac key) and the passenger ac_report', () => {
    expect(isAcRide({ is_ac: true })).toBe(true);
    expect(isAcRide({ vehicle_type: 'car_ac' })).toBe(true);
    expect(isAcRide({ is_ac: false, vehicle_type: 'car' })).toBe(false);
    expect(toAcReportState(undefined)).toBeNull();
    expect(
      toAcReportState({
        can_report: false,
        report: { id: 7, kind: 'ac_not_working', status: 'upheld', refund_amount: '60.00', suggested_refund: '60.00' },
      }),
    ).toEqual({
      canReport: false,
      report: { id: 7, status: 'upheld', refundAmount: 60, suggestedRefund: 60, createdAt: null, resolvedAt: null },
    });
  });

  it('report status texts: refunded, under review with the AC part, reviewed', () => {
    const base = { id: 1, refundAmount: 0, suggestedRefund: null, createdAt: null, resolvedAt: null };
    expect(acReportStatusText({ ...base, status: 'upheld', refundAmount: 60 })).toBe('Rs\u00A060 refunded to your wallet');
    expect(acReportStatusText({ ...base, status: 'open', suggestedRefund: 60 })).toBe(
      'Under review. Up to Rs\u00A060 comes back when it is upheld.',
    );
    expect(acReportStatusText({ ...base, status: 'rejected' })).toBe('Reviewed. No refund this time.');
  });

  it('sends the note only when written, cut to 500', () => {
    expect(buildAcReportBody('  ')).toEqual({});
    expect(buildAcReportBody('x'.repeat(600)).note).toHaveLength(500);
  });

  it('maps the driver AC summary and its problems', () => {
    const summary = toVehicleAcSummary({
      vehicle: { id: 3, vehicle_type: 'car', year: 2018, has_ac: true, ac_status: 'suspended', ac_reason: 'Reports' },
      min_vehicle_year: 2010,
      serves_ac_rides: false,
      problems: [{ code: 'AC_NOT_APPROVED', message: 'The AC has not been approved yet' }, { code: 'X' }],
    });
    expect(summary).toEqual({
      vehicle: { id: 3, vehicleType: 'car', year: 2018, hasAc: true, acStatus: 'suspended', acReason: 'Reports' },
      minVehicleYear: 2010,
      servesAcRides: false,
      problems: [{ code: 'AC_NOT_APPROVED', message: 'The AC has not been approved yet' }],
    });
    expect(toVehicleAcSummary({ vehicle: null, min_vehicle_year: 2010, serves_ac_rides: false }).vehicle).toBeNull();
  });

  it('refusals that end the report re-read the ride; 404 for an outsider too', () => {
    const conflict = (code: string) => new ApiError({ kind: 'conflict', status: 409, code, message: 'x' });
    expect(acReportRefusal(conflict('ALREADY_REPORTED'))).toEqual({ message: 'You have already reported the AC on this ride.', refresh: true });
    expect(acReportRefusal(conflict('NOT_AC_RIDE')).refresh).toBe(true);
    expect(acReportRefusal(conflict('REPORT_WINDOW_CLOSED')).refresh).toBe(true);
    expect(acReportRefusal(new ApiError({ kind: 'not_found', status: 404, message: 'Not found' })).refresh).toBe(true);
    expect(acReportRefusal(new ApiError({ kind: 'network', message: 'Network error.' })).refresh).toBe(false);
  });
});

describe('passenger: AC not working', () => {
  const report = { id: 9, kind: 'ac_not_working', status: 'upheld', refund_amount: '60.00', suggested_refund: '60.00' };

  it('reports with the optional note, toasts the server message and shows the refund', async () => {
    mock.onPost('/rides/41/report-ac').reply(201, {
      success: true,
      message: 'Sorry about the AC. We refunded Rs 60 to your wallet.',
      data: { report },
    });
    const onReported = jest.fn();
    render(<AcReportSection rideId={41} state={{ canReport: true, report: null }} onReported={onReported} />);
    fireEvent.press(screen.getByTestId('ac-report-button'));
    fireEvent.changeText(screen.getByTestId('ac-report-note'), 'AC was off');
    await act(async () => {
      fireEvent.press(screen.getByTestId('ac-report-submit'));
    });
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ note: 'AC was off' });
    expect(toast.success).toHaveBeenCalledWith('Sorry about the AC. We refunded Rs 60 to your wallet.');
    expect(onReported).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId('ac-report-button')).toBeNull());
    expect(screen.getByTestId('ac-report-status-text').props.children).toBe('Rs\u00A060 refunded to your wallet');
  });

  it('409 ALREADY_REPORTED: says so and the button goes', async () => {
    mock.onPost('/rides/41/report-ac').reply(409, { success: false, error: { code: 'ALREADY_REPORTED', message: 'x' } });
    render(<AcReportSection rideId={41} state={{ canReport: true, report: null }} />);
    fireEvent.press(screen.getByTestId('ac-report-button'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('ac-report-submit'));
    });
    expect(toast.info).toHaveBeenCalledWith('You have already reported the AC on this ride.');
    await waitFor(() => expect(screen.queryByTestId('ac-report-button')).toBeNull());
  });

  it('a network failure stays in the sheet with the error', async () => {
    mock.onPost('/rides/41/report-ac').networkError();
    render(<AcReportSection rideId={41} state={{ canReport: true, report: null }} />);
    fireEvent.press(screen.getByTestId('ac-report-button'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('ac-report-submit'));
    });
    expect(screen.getByTestId('ac-report-error')).toBeTruthy();
    expect(screen.getByTestId('ac-report-button')).toBeTruthy();
  });

  it('nothing without ac_report (drivers, non-AC rides)', () => {
    const { toJSON } = render(<AcReportSection rideId={41} state={null} />);
    expect(toJSON()).toBeNull();
  });

  it('the live ride shows the AC badge and the report on an AC ride only', () => {
    const acRide = makeRide({
      status: 'started',
      vehicle_type: 'car_ac',
      is_ac: true,
      ac_report: { can_report: true, report: null },
      driver_id: 5,
      driver: { id: 5, name: 'Ali', rating: 4.9 },
    });
    const { rerender } = render(<ActiveRidePanel stageState={stateOf(acRide)} ride={acRide} onCancel={jest.fn()} onDone={jest.fn()} />);
    expect(screen.getByTestId('active-ride-ac')).toBeTruthy();
    expect(screen.getByTestId('active-ride-ac-report-button')).toBeTruthy();
    const plain = makeRide({ status: 'started', vehicle_type: 'car', driver_id: 5, driver: { id: 5, name: 'Ali', rating: 4.9 } });
    rerender(<ActiveRidePanel stageState={stateOf(plain)} ride={plain} onCancel={jest.fn()} onDone={jest.fn()} />);
    expect(screen.queryByTestId('active-ride-ac')).toBeNull();
    expect(screen.queryByTestId('active-ride-ac-report')).toBeNull();
  });
});

describe('driver: Vehicle AC screen', () => {
  const summary = (over: Record<string, unknown> = {}) => ({
    success: true,
    data: {
      vehicle: { id: 3, vehicle_type: 'car', year: 2018, has_ac: false, ac_status: 'none', ac_reason: null, ...over },
      min_vehicle_year: 2010,
      serves_ac_rides: false,
      problems: [{ code: 'AC_NOT_DECLARED', message: 'The driver has not declared AC for this car' }],
    },
  });

  it('loads the status, declares AC and shows what is still needed', async () => {
    mock.onGet('/driver/vehicle/ac').reply(200, summary());
    mock.onPost('/driver/vehicle/ac').reply(200, {
      success: true,
      data: {
        vehicle: { id: 3, vehicle_type: 'car', year: 2018, has_ac: true, ac_status: 'pending', ac_reason: null },
        min_vehicle_year: 2010,
        serves_ac_rides: false,
        problems: [{ code: 'AC_NOT_APPROVED', message: 'The AC has not been approved yet' }],
      },
    });
    render(<VehicleAcScreen />);
    await waitFor(() => expect(screen.getByTestId('vehicle-ac-status-badge')).toBeTruthy());
    expect(screen.getByText('Off')).toBeTruthy();
    // Not declared yet: the "not declared" item is not a to-do for the driver.
    expect(screen.queryByTestId('vehicle-ac-problem-AC_NOT_DECLARED')).toBeNull();
    expect(screen.getByText('AC rides need a car from 2010 or newer.')).toBeTruthy();

    await act(async () => {
      fireEvent(screen.getByTestId('vehicle-ac-switch'), 'onValueChange', true);
    });
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ has_ac: true });
    await waitFor(() => expect(screen.getByText('Waiting for our check')).toBeTruthy());
    expect(screen.getByTestId('vehicle-ac-problem-AC_NOT_APPROVED')).toBeTruthy();
    expect(toast.success).toHaveBeenCalledWith('AC declared. We will check your car before you get AC rides.');
  });

  it('shows the 422 VEHICLE_TOO_OLD message and keeps the switch off', async () => {
    mock.onGet('/driver/vehicle/ac').reply(200, summary({ year: 2005 }));
    mock.onPost('/driver/vehicle/ac').reply(422, {
      success: false,
      error: { code: 'VEHICLE_TOO_OLD', message: 'AC rides need a car from 2010 or newer' },
    });
    render(<VehicleAcScreen />);
    await waitFor(() => expect(screen.getByTestId('vehicle-ac-switch')).toBeTruthy());
    await act(async () => {
      fireEvent(screen.getByTestId('vehicle-ac-switch'), 'onValueChange', true);
    });
    await waitFor(() => expect(screen.getByTestId('vehicle-ac-save-error')).toBeTruthy());
    expect(screen.getByText('AC rides need a car from 2010 or newer')).toBeTruthy();
    expect(screen.getByText('Off')).toBeTruthy();
  });

  it('a suspended AC shows the admin reason; no vehicle shows the empty state', async () => {
    mock.onGet('/driver/vehicle/ac').replyOnce(200, summary({ has_ac: true, ac_status: 'suspended', ac_reason: 'Passengers reported the AC' }));
    const { unmount } = render(<VehicleAcScreen />);
    await waitFor(() => expect(screen.getByTestId('vehicle-ac-reason')).toBeTruthy());
    expect(screen.getByText('Paused after AC reports')).toBeTruthy();
    unmount();
    mock.onGet('/driver/vehicle/ac').replyOnce(200, { success: true, data: { vehicle: null, min_vehicle_year: 2010, serves_ac_rides: false } });
    render(<VehicleAcScreen />);
    await waitFor(() => expect(screen.getByTestId('vehicle-ac-no-vehicle')).toBeTruthy());
  });

  it('load failure: error state with retry', async () => {
    mock.onGet('/driver/vehicle/ac').networkError();
    render(<VehicleAcScreen />);
    await waitFor(() => expect(screen.getByTestId('vehicle-ac-error')).toBeTruthy());
  });
});

describe('registration and driver bits', () => {
  const driverForm = { ...INITIAL_REGISTRATION_FORM, role: 'driver' as const, phoneNumber: '3001234567', vehicleType: 'car', vehicleHasAc: true };

  it('sends vehicle_has_ac only for a car with the switch on', () => {
    expect(buildRegistrationRequest(driverForm).vehicle_has_ac).toBe(true);
    expect(buildRegistrationRequest({ ...driverForm, vehicleType: 'bike' }).vehicle_has_ac).toBeUndefined();
    expect(buildRegistrationRequest({ ...driverForm, vehicleHasAc: false }).vehicle_has_ac).toBeUndefined();
  });

  it('a 422 on vehicle_has_ac lands on the vehicle step under the switch', () => {
    const mapped = mapRegistrationServerErrors({ vehicle_has_ac: ['AC rides need a car from 2010 or newer.'] }, 'driver');
    expect(mapped.step).toBe('vehicle');
    expect(mapped.firstField).toBe('vehicleHasAc');
    const onChange = jest.fn();
    render(<RegistrationAcSwitch value={false} onChange={onChange} error={mapped.fieldErrors.vehicleHasAc} />);
    expect(screen.getByTestId('registration-ac-error').props.children).toBe('AC rides need a car from 2010 or newer.');
    fireEvent(screen.getByTestId('registration-ac-switch'), 'onValueChange', true);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('BE-105: reads meta.ac and meta.vehicle_year; unknown parts stay null', () => {
    const body = {
      success: true,
      data: [],
      meta: { fare_notice: null, ac: { vehicle_type: 'car', min_vehicle_year: 2010 }, vehicle_year: { min: 1980, max: 2027 } },
    };
    expect(toRegistrationVehicleRules(body)).toEqual({ acVehicleType: 'car', acMinVehicleYear: 2010, vehicleYear: { min: 1980, max: 2027 }, vehicleMakes: null });
    expect(toRegistrationVehicleRules({ success: true, data: [] })).toEqual({ acVehicleType: 'car', acMinVehicleYear: null, vehicleYear: null, vehicleMakes: null });
    expect(toRegistrationVehicleRules({ meta: { vehicle_year: { min: 2030, max: 2027 } } }).vehicleYear).toBeNull();
  });

  it('BE-105: year options follow the server range (newest 20), with the local range as fallback', () => {
    expect(vehicleYearOptions({ min: 1980, max: 2027 }, 2030, 1980).slice(0, 2)).toEqual(['2027', '2026']);
    expect(vehicleYearOptions({ min: 1980, max: 2027 }, 2030, 1980)).toHaveLength(20);
    expect(vehicleYearOptions({ min: 2020, max: 2027 }, 2030, 1980)).toEqual(['2027', '2026', '2025', '2024', '2023', '2022', '2021', '2020']);
    expect(vehicleYearOptions(null, 2027, 1980)[0]).toBe('2027');
  });

  it('BE-105: the AC switch shows for the AC type and is blocked below the minimum year', () => {
    const rules = { acVehicleType: 'car', acMinVehicleYear: 2010, vehicleYear: null, vehicleMakes: null };
    expect(acAllowedFor(rules, 'bike', '2020')).toEqual({ shown: false, tooOld: false });
    expect(acAllowedFor(rules, 'car', '2009')).toEqual({ shown: true, tooOld: true });
    expect(acAllowedFor(rules, 'car', '2010')).toEqual({ shown: true, tooOld: false });
    expect(acAllowedFor(rules, 'car', '')).toEqual({ shown: true, tooOld: false });
    // Not loaded / older server: shown for a car, the 422 stays the check.
    expect(acAllowedFor(null, 'car', '1999')).toEqual({ shown: true, tooOld: false });
  });

  it('BE-105: a too-old car shows the switch off and disabled with the minimum year', () => {
    const onChange = jest.fn();
    render(<RegistrationAcSwitch value onChange={onChange} error="server said no" tooOldMinYear={2010} />);
    expect(screen.getByTestId('registration-ac-hint')).toHaveTextContent('AC rides need a car from 2010 or newer.');
    const toggle = screen.getByTestId('registration-ac-switch');
    expect(toggle.props.accessibilityState).toMatchObject({ checked: false, disabled: true });
    expect(screen.queryByTestId('registration-ac-error')).toBeNull();
  });

  it('BE-105: the vehicle step gates the AC switch by meta.ac.min_vehicle_year and turns AC off for an old year', async () => {
    mock.onGet('/public/vehicle-types').reply(200, {
      success: true,
      data: [],
      meta: { ac: { vehicle_type: 'car', min_vehicle_year: 2010 }, vehicle_year: { min: 1980, max: 2027 } },
    });
    const onDataChange = jest.fn();
    const form = { ...driverForm, vehicleYear: '2015' };
    const { rerender } = render(
      <ThemeProvider>
        <VehicleInfoStep data={form} onDataChange={onDataChange} errors={{}} />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('registration-ac-hint')).toHaveTextContent(/^Optional\./));
    await waitFor(() => expect(mock.history.get.filter((r) => r.url === '/public/vehicle-types')).toHaveLength(1));
    expect(onDataChange).not.toHaveBeenCalledWith({ vehicleHasAc: false });
    rerender(
      <ThemeProvider>
        <VehicleInfoStep data={{ ...form, vehicleYear: '2005' }} onDataChange={onDataChange} errors={{}} />
      </ThemeProvider>,
    );
    await waitFor(() => expect(onDataChange).toHaveBeenCalledWith({ vehicleHasAc: false }));
    expect(screen.getByTestId('registration-ac-hint')).toHaveTextContent('AC rides need a car from 2010 or newer.');
  });

  it('labels a confirmed AC strike and the AC accept refusal', () => {
    expect(strikeKindLabel('ac_not_working')).toBe('AC not working (confirmed)');
    expect(acceptRefusalMessage({ kind: 'conflict', status: 409, code: 'AC_VEHICLE_REQUIRED', message: 'x', fieldErrors: {} })).toBe(
      'This is an AC ride. Only a car with an approved AC can take it.',
    );
  });
});
