/**
 * T-522 (BE-87) women mode in the app: the "Female driver" option only for passengers the server
 * lets ask (with the wait date otherwise), one availability check per pickup cell (never the map
 * list), POST /rides with female_driver_only, the "Keep waiting / Allow any driver" sheet, the
 * women's-safety SOS and post-ride report, and the driver's own women-mode row. No driver's
 * gender is ever read or shown.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { apiClient } from '../../../src/services/api';
import { toast } from '../../../src/core/toast';
import { normalizeUser } from '../../../src/core/auth/normalizeUser';
import { toStoredUser } from '../../../src/core/auth/storedUser';
import { buildRideRequest } from '../../../src/features/ride-booking/buildRideRequest';
import { toDriverWomenMode, toFemaleDriverRequest, toSafetyReportState, toWomenModeSummary } from '../../../src/features/women-mode/api';
import {
  availabilityCellKey,
  femaleDriverOptionOf,
  shouldAskFallback,
  snoozeAfterKeepWaiting,
  womenCell,
} from '../../../src/features/women-mode/rules';
import { bumpSessionEpoch } from '../../../src/store/sessionEpoch';
import { acceptRefusalMessage } from '../../../src/features/driver-requests/hooks';
import { resetFemaleAvailabilityCache, safetyReportRefusal } from '../../../src/features/women-mode/hooks';
import { FemaleDriverOption, FemaleDriverOptionView } from '../../../src/features/women-mode/components/FemaleDriverOption';
import { WomenModeSearching } from '../../../src/features/women-mode/components/WomenModeSearching';
import { SafetyReportSection } from '../../../src/features/women-mode/components/SafetyReportSection';
import { DriverWomenModeRow } from '../../../src/features/women-mode/components/DriverWomenModeRow';
import { useSos } from '../../../src/features/safety/hooks';
import { ApiError } from '../../../src/core/api/errors';
import type { WomenModeSummary } from '../../../src/features/women-mode/types';

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  resetFemaleAvailabilityCache();
  jest.spyOn(toast, 'success').mockImplementation(() => '');
  jest.spyOn(toast, 'info').mockImplementation(() => '');
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const pickup = { latitude: 31.5204, longitude: 74.3587 };
const available = { available: true, reason: null, availableFrom: null };

describe('profile and rules', () => {
  it('keeps the women-mode blocks of the own profile in memory, never in device storage', () => {
    const user = normalizeUser({
      id: 4,
      role: 'passenger',
      status: 'active',
      female_driver_request: { available: false, reason: 'GENDER_RECENTLY_CHANGED', available_from: '2026-11-01T00:00:00+05:00' },
      women_mode: null,
    });
    expect(user?.female_driver_request).toEqual({ available: false, reason: 'GENDER_RECENTLY_CHANGED', available_from: '2026-11-01T00:00:00+05:00' });
    expect(user?.women_mode).toBeNull();
    const stored = toStoredUser(user ?? {});
    expect(stored).not.toHaveProperty('female_driver_request');
    expect(stored).not.toHaveProperty('women_mode');
  });

  it('the option: available, waiting with its date, else hidden', () => {
    expect(femaleDriverOptionOf(toFemaleDriverRequest({ available: true, reason: null }))).toEqual({ kind: 'available' });
    expect(
      femaleDriverOptionOf(toFemaleDriverRequest({ available: false, reason: 'GENDER_RECENTLY_CHANGED', available_from: '2026-11-01T10:00:00Z' })),
    ).toEqual({ kind: 'waiting', availableFrom: '2026-11-01T10:00:00Z' });
    expect(femaleDriverOptionOf(toFemaleDriverRequest({ available: false, reason: 'FEMALE_DRIVER_NOT_ALLOWED' }))).toEqual({ kind: 'hidden' });
    expect(femaleDriverOptionOf(toFemaleDriverRequest({ available: false, reason: 'WOMEN_MODE_OFF' }))).toEqual({ kind: 'hidden' });
    expect(femaleDriverOptionOf(null)).toEqual({ kind: 'hidden' });
  });

  it("cells match the server's grid: 2 km / 111 latitude, 2 km / (111·cos lat) longitude, centred", () => {
    // WomenMode::womenCell for Lahore (31.5204, 74.3587) at grid_km 2.
    const latStep = 2 / 111;
    const lat = Math.round((Math.floor(31.5204 / latStep) + 0.5) * latStep * 1e5) / 1e5;
    const lngStep = 2 / (111 * Math.cos((lat * Math.PI) / 180));
    const lng = Math.round((Math.floor(74.3587 / lngStep) + 0.5) * lngStep * 1e5) / 1e5;
    expect(womenCell(31.5204, 74.3587)).toEqual({ latitude: lat, longitude: lng });
    expect(lngStep).toBeGreaterThan(latStep);
  });

  it('one availability cell for nearby pickups (~2 km), another across the line or for another type', () => {
    const a = availabilityCellKey(31.5204, 74.3587, 'car');
    expect(availabilityCellKey(31.5210, 74.3590, 'car')).toBe(a);
    expect(availabilityCellKey(31.56, 74.3587, 'car')).not.toBe(a);
    expect(availabilityCellKey(31.5204, 74.3587, 'bike')).not.toBe(a);
  });

  it('asks on no_female_drivers_nearby / ask_fallback while it can still release, unless snoozed', () => {
    const summary: WomenModeSummary = {
      femaleDriverOnly: true,
      state: 'no_female_drivers_nearby',
      femaleDriversNearby: false,
      askFallbackAt: '2026-10-16T10:02:00Z',
      canAllowAnyDriver: true,
      releasedAt: null,
    };
    const now = Date.parse('2026-10-16T10:00:00Z');
    expect(shouldAskFallback(summary, now, null)).toBe(true);
    expect(shouldAskFallback({ ...summary, state: 'ask_fallback' }, now, null)).toBe(true);
    expect(shouldAskFallback({ ...summary, state: 'searching' }, now, null)).toBe(false);
    expect(shouldAskFallback({ ...summary, canAllowAnyDriver: false }, now, null)).toBe(false);
    expect(shouldAskFallback(summary, now, now + 1000)).toBe(false);
    expect(snoozeAfterKeepWaiting(summary, now)).toBe(Date.parse('2026-10-16T10:02:00Z'));
  });

  it('maps the ride block (unknown state reads matched) and the driver block', () => {
    expect(toWomenModeSummary(null)).toBeNull();
    expect(toWomenModeSummary({ state: 'weird', can_allow_any_driver: true })?.state).toBe('matched');
    expect(toDriverWomenMode({ gender_verified: true, eligible: true, suspended: false })).toEqual({
      genderVerified: true,
      eligible: true,
      suspended: false,
    });
  });

  it('BE-105: maps ride safety_report (the server decides; a made report wins over can_report)', () => {
    expect(toSafetyReportState(undefined)).toBeNull();
    expect(toSafetyReportState({ can_report: true, report: null })).toEqual({ canReport: true, report: null });
    expect(toSafetyReportState({ can_report: false })).toEqual({ canReport: false, report: null });
    expect(
      toSafetyReportState({ can_report: true, report: { category: 'women_safety', status: 'acknowledged', created_at: '2026-10-16T10:00:00+05:00' } }),
    ).toEqual({ canReport: false, report: { category: 'women_safety', status: 'acknowledged', createdAt: '2026-10-16T10:00:00+05:00' } });
    expect(toSafetyReportState({ can_report: false, report: { status: 'weird' } })?.report?.status).toBe('open');
  });

  it('books with female_driver_only only when chosen', () => {
    const input = {
      pickup: { ...pickup, address: 'A' },
      dropoff: { latitude: 31.6, longitude: 74.4, address: 'B' },
      vehicleType: 'car',
    };
    const on = buildRideRequest({ ...input, femaleDriverOnly: true });
    const off = buildRideRequest(input);
    expect(on.ok && on.request.female_driver_only).toBe(true);
    expect(off.ok && 'female_driver_only' in off.request).toBe(false);
  });
});

describe('booking: Female driver option', () => {
  const Harness = ({ request, start = false }: { request: Parameters<typeof FemaleDriverOptionView>[0]['request']; start?: boolean }) => {
    const [value, setValue] = React.useState(start);
    return <FemaleDriverOptionView request={request} pickup={pickup} vehicleType="car" value={value} onChange={setValue} />;
  };

  it('hidden for a passenger the server does not let ask', () => {
    render(<Harness request={{ available: false, reason: 'FEMALE_DRIVER_NOT_ALLOWED', availableFrom: null }} />);
    expect(screen.queryByTestId('female-driver-option')).toBeNull();
    expect(mock.history.get).toHaveLength(0);
  });

  it('waiting after a recent gender change: disabled with the date, no check', () => {
    render(<Harness request={{ available: false, reason: 'GENDER_RECENTLY_CHANGED', availableFrom: '2026-11-01T10:00:00Z' }} />);
    expect(screen.getByText(/You can ask for a female driver from 1 Nov 2026/)).toBeTruthy();
    expect(screen.getByTestId('female-driver-switch').props.accessibilityState).toMatchObject({ disabled: true });
    expect(mock.history.get).toHaveLength(0);
  });

  it('switched on: one availability check for the pickup, only a boolean back', async () => {
    mock.onGet('/rides/nearby-drivers').reply(200, { success: true, data: { female_drivers_available: false } });
    render(<Harness request={available} />);
    expect(mock.history.get).toHaveLength(0);
    await act(async () => {
      fireEvent(screen.getByTestId('female-driver-switch'), 'onValueChange', true);
    });
    await waitFor(() => expect(screen.getByTestId('female-driver-hint').props.children).toMatch(/No female driver is near your pickup/));
    expect(mock.history.get).toHaveLength(1);
    // The cell's centre (the server's grid), never the exact pickup.
    const cell = womenCell(pickup.latitude, pickup.longitude);
    expect(cell).not.toEqual(pickup);
    expect(mock.history.get[0].params).toEqual({ latitude: cell.latitude, longitude: cell.longitude, female_driver_only: 1, vehicle_type: 'car' });
  });

  it('the same cell is not asked again; a 429 pauses checks with a calm hint', async () => {
    mock.onGet('/rides/nearby-drivers').replyOnce(200, { success: true, data: { female_drivers_available: true } });
    const first = render(<Harness request={available} start />);
    await waitFor(() => expect(screen.getByTestId('female-driver-hint').props.children).toBe('Female drivers are near your pickup.'));
    first.unmount();
    render(<Harness request={available} start />);
    await waitFor(() => expect(screen.getByTestId('female-driver-hint').props.children).toBe('Female drivers are near your pickup.'));
    expect(mock.history.get).toHaveLength(1);

    resetFemaleAvailabilityCache();
    mock.onGet('/rides/nearby-drivers').reply(429, { success: false, code: 'rate_limited', retry_after: 30 });
    screen.unmount();
    render(<Harness request={available} start />);
    await waitFor(() => expect(screen.getByTestId('female-driver-hint').props.children).toMatch(/We checked a lot just now/));
  });

  it('reads the signed-in profile from the store', () => {
    const store = configureStore({
      reducer: { apiAuth: () => ({ user: { id: 1, female_driver_request: { available: true, reason: null } } }) },
    });
    render(
      <Provider store={store}>
        <FemaleDriverOption pickup={pickup} vehicleType="car" value={false} onChange={jest.fn()} />
      </Provider>,
    );
    expect(screen.getByTestId('female-driver-row')).toBeTruthy();
  });

  it('turns itself off when the profile no longer allows it', () => {
    const onChange = jest.fn();
    render(
      <FemaleDriverOptionView
        request={{ available: false, reason: 'WOMEN_MODE_OFF', availableFrom: null }}
        pickup={pickup}
        vehicleType="car"
        value
        onChange={onChange}
      />,
    );
    expect(onChange).toHaveBeenCalledWith(false);
  });
});

describe('searching: keep waiting or allow any driver', () => {
  const raw = (over: Record<string, unknown> = {}) => ({
    female_driver_only: true,
    state: 'no_female_drivers_nearby',
    female_drivers_nearby: false,
    ask_fallback_at: '2026-10-16T10:02:00Z',
    can_allow_any_driver: true,
    released_at: null,
    ...over,
  });

  it('asks at once when none is nearby; Keep waiting posts the answer and holds the sheet back', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-16T10:00:00Z') });
    mock.onPost('/rides/41/women-mode').reply(200, {
      success: true,
      message: 'We keep looking for a female driver',
      data: { id: 41, women_mode: raw({ ask_fallback_at: '2026-10-16T10:02:00Z' }) },
    });
    const { rerender } = render(<WomenModeSearching rideId={41} raw={raw()} />);
    expect(screen.getByTestId('women-mode-ask-text').props.children).toMatch(/No female driver is near your pickup/);
    await act(async () => {
      fireEvent.press(screen.getByTestId('women-mode-keep-waiting'));
    });
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ action: 'keep_waiting' });
    // The next poll still says none is nearby: no sheet until the server's next ask.
    rerender(<WomenModeSearching rideId={41} raw={raw()} />);
    expect(screen.queryByTestId('women-mode-ask-text')).toBeNull();
    expect(screen.getByTestId('women-mode-allow-any-inline')).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(125_000);
    });
    expect(screen.getByTestId('women-mode-ask-text')).toBeTruthy();
  });

  it('Allow any driver releases the ride', async () => {
    mock.onPost('/rides/41/women-mode').reply(200, {
      success: true,
      data: { id: 41, women_mode: raw({ female_driver_only: false, state: 'released', can_allow_any_driver: false }) },
    });
    render(<WomenModeSearching rideId={41} raw={raw({ state: 'ask_fallback', female_drivers_nearby: true })} />);
    expect(screen.getByTestId('women-mode-ask-text').props.children).toMatch(/has taken your ride yet/);
    await act(async () => {
      fireEvent.press(screen.getByTestId('women-mode-allow-any'));
    });
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ action: 'allow_any_driver' });
    await waitFor(() => expect(screen.getByTestId('women-mode-status-text').props.children).toBe('Any nearby driver can now take your ride'));
    expect(screen.queryByTestId('women-mode-ask-text')).toBeNull();
  });

  it('after Allow any driver, a stale poll (sent before the answer) does not re-open the sheet', async () => {
    mock.onPost('/rides/41/women-mode').reply(200, {
      success: true,
      data: { id: 41, women_mode: raw({ female_driver_only: false, state: 'released', can_allow_any_driver: false }) },
    });
    const { rerender } = render(<WomenModeSearching rideId={41} raw={raw()} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('women-mode-allow-any'));
    });
    // The in-flight poll lands with the old block (a new object): still released, no sheet.
    rerender(<WomenModeSearching rideId={41} raw={raw()} />);
    expect(screen.queryByTestId('women-mode-ask-text')).toBeNull();
    expect(screen.queryByTestId('women-mode-allow-any-inline')).toBeNull();
    expect(screen.getByTestId('women-mode-status-text').props.children).toBe('Any nearby driver can now take your ride');
    expect(mock.history.post).toHaveLength(1);
    // The server catches up: its block wins from then on.
    rerender(<WomenModeSearching rideId={41} raw={raw({ female_driver_only: false, state: 'matched', can_allow_any_driver: false })} />);
    expect(screen.queryByTestId('women-mode-status')).toBeNull();
  });

  it('a second "Allow any driver" (409 NOT_WOMEN_MODE_RIDE) says the ride is already open to any driver', async () => {
    mock.onPost('/rides/41/women-mode').reply(409, { success: false, error: { code: 'NOT_WOMEN_MODE_RIDE', message: 'x' } });
    render(<WomenModeSearching rideId={41} raw={raw()} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('women-mode-allow-any'));
    });
    expect(screen.getByTestId('women-mode-error').props.children).toBe('Any nearby driver can already take your ride.');
  });

  it('a failed inline "Allow any driver" (sheet hidden) shows why under the status line', async () => {
    mock.onPost('/rides/41/women-mode').networkError();
    render(<WomenModeSearching rideId={41} raw={raw({ state: 'searching', female_drivers_nearby: true })} />);
    expect(screen.queryByTestId('women-mode-ask-text')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByTestId('women-mode-allow-any-inline'));
    });
    expect(screen.getByTestId('women-mode-inline-error').props.children).toBe("Couldn't change your request. Please try again.");
  });

  it('a refusal (ride no longer searching) is said in the sheet', async () => {
    mock.onPost('/rides/41/women-mode').reply(409, { success: false, error: { code: 'RIDE_NOT_SEARCHING', message: 'x' } });
    render(<WomenModeSearching rideId={41} raw={raw()} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('women-mode-keep-waiting'));
    });
    expect(screen.getByTestId('women-mode-error').props.children).toBe('Your ride is no longer looking for a driver.');
  });

  it('searching quietly: a status line, no sheet; matched or absent: nothing', () => {
    const { rerender, toJSON } = render(<WomenModeSearching rideId={41} raw={raw({ state: 'searching', female_drivers_nearby: true })} />);
    expect(screen.getByTestId('women-mode-status-text').props.children).toBe('Looking for a female driver');
    expect(screen.queryByTestId('women-mode-ask-text')).toBeNull();
    rerender(<WomenModeSearching rideId={41} raw={raw({ state: 'matched', can_allow_any_driver: false })} />);
    expect(toJSON()).toBeNull();
    rerender(<WomenModeSearching rideId={41} raw={undefined} />);
    expect(toJSON()).toBeNull();
  });
});

describe("women's safety", () => {
  it('SOS: a women_safety alert after a general one is sent again so the server upgrades it', async () => {
    const answer = { created: true, incident: { id: 1, status: 'open', category: 'general' }, emergency_numbers: [], emergency_contacts: [] };
    mock.onPost('/rides/41/sos').reply(201, { success: true, data: answer });
    const { result } = renderHook(() => useSos(41));
    await act(async () => {
      await result.current.send(null);
    });
    await act(async () => {
      await result.current.send(null);
    });
    expect(mock.history.post).toHaveLength(1);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({});
    await act(async () => {
      await result.current.send(null, 'women_safety');
    });
    expect(mock.history.post).toHaveLength(2);
    expect(JSON.parse(mock.history.post[1].data)).toEqual({ category: 'women_safety' });
    expect(result.current.category).toBe('women_safety');
    await act(async () => {
      await result.current.send(null, 'women_safety');
    });
    expect(mock.history.post).toHaveLength(2);
  });

  it('post-ride report: note required, then POST with category women_safety', async () => {
    mock.onPost('/rides/41/safety-report').reply(201, {
      success: true,
      message: 'Report sent. Our safety team reviews it first.',
      data: { created: true, incident: { id: 2, status: 'open', category: 'women_safety', source: 'report' } },
    });
    const onReported = jest.fn();
    render(<SafetyReportSection rideId={41} state={{ canReport: true, report: null }} onReported={onReported} />);
    fireEvent.press(screen.getByTestId('safety-report-button'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('safety-report-submit'));
    });
    expect(mock.history.post).toHaveLength(0);
    expect(screen.getByText('Tell us what happened (at least 3 characters).')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('safety-report-note'), 'He made me uncomfortable');
    await act(async () => {
      fireEvent.press(screen.getByTestId('safety-report-submit'));
    });
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ category: 'women_safety', note: 'He made me uncomfortable' });
    expect(toast.success).toHaveBeenCalledWith('Report sent. Our safety team reviews it first.');
    await waitFor(() => expect(screen.getByTestId('safety-report-sent')).toBeTruthy());
    expect(screen.getByTestId('safety-report-status')).toHaveTextContent("Women's-safety report sent · Received");
    expect(onReported).toHaveBeenCalledTimes(1);
  });

  it('BE-105: a report already made shows its status (also after reopening), no button', () => {
    const { rerender } = render(
      <SafetyReportSection rideId={41} state={{ canReport: false, report: { category: 'women_safety', status: 'acknowledged', createdAt: null } }} />,
    );
    expect(screen.queryByTestId('safety-report-button')).toBeNull();
    expect(screen.getByTestId('safety-report-status')).toHaveTextContent("Women's-safety report sent · Our safety team is on it");
    rerender(<SafetyReportSection rideId={41} state={{ canReport: false, report: { category: 'women_safety', status: 'resolved', createdAt: null } }} />);
    expect(screen.getByTestId('safety-report-status')).toHaveTextContent("Women's-safety report sent · Reviewed");
    rerender(<SafetyReportSection rideId={43} state={{ canReport: false, report: null }} />);
    expect(screen.queryByTestId('safety-report-sent')).toBeNull();
    expect(screen.queryByTestId('safety-report-button')).toBeNull();
  });

  it('a closed window says so and the button goes; nothing outside the window', async () => {
    mock.onPost('/rides/41/safety-report').reply(409, { success: false, error: { code: 'REPORT_WINDOW_CLOSED', message: 'x' } });
    const { rerender } = render(<SafetyReportSection rideId={41} state={{ canReport: true, report: null }} />);
    fireEvent.press(screen.getByTestId('safety-report-button'));
    fireEvent.changeText(screen.getByTestId('safety-report-note'), 'Something happened');
    await act(async () => {
      fireEvent.press(screen.getByTestId('safety-report-submit'));
    });
    expect(toast.info).toHaveBeenCalledWith(
      'This ride ended too long ago to report here. Contact support, or call 15 if you are in danger.',
    );
    await waitFor(() => expect(screen.queryByTestId('safety-report-button')).toBeNull());
    rerender(<SafetyReportSection rideId={42} state={{ canReport: false, report: null }} />);
    expect(screen.queryByTestId('safety-report-button')).toBeNull();
  });

  it('refusal mapping: 404 and 429 are handled gracefully', () => {
    expect(safetyReportRefusal(new ApiError({ kind: 'not_found', status: 404, message: 'x' })).done).toBe(true);
    expect(safetyReportRefusal(new ApiError({ kind: 'rate_limited', status: 429, message: 'x' }))).toEqual({
      message: 'Too many reports just now. Please try again in a minute.',
      done: false,
    });
  });
});

describe('session and driver side', () => {
  it('a new session forgets cached answers and the 429 pause', async () => {
    mock.onGet('/rides/nearby-drivers').reply(200, { success: true, data: { female_drivers_available: true } });
    const Opt = () => <FemaleDriverOptionView request={available} pickup={pickup} vehicleType="car" value onChange={jest.fn()} />;
    const first = render(<Opt />);
    await waitFor(() => expect(screen.getByTestId('female-driver-hint').props.children).toBe('Female drivers are near your pickup.'));
    first.unmount();
    act(() => {
      bumpSessionEpoch();
    });
    render(<Opt />);
    await waitFor(() => expect(mock.history.get).toHaveLength(2));
  });

  it("a driver refused for a women-mode ride sees only 'no longer available'", () => {
    const message = acceptRefusalMessage({ kind: 'conflict', status: 409, code: 'FEMALE_DRIVER_REQUIRED', message: 'This passenger asked for a female driver', fieldErrors: {} });
    expect(message).not.toMatch(/female/i);
    expect(message).toBe(acceptRefusalMessage({ kind: 'conflict', status: 409, code: 'RIDE_NOT_AVAILABLE', message: 'x', fieldErrors: {} }));
  });
});

describe('driver Account: women mode row', () => {
  it('verified or suspended only; nothing for every other driver', () => {
    const { rerender, toJSON } = render(<DriverWomenModeRow raw={{ gender_verified: true, eligible: true, suspended: false }} />);
    expect(screen.getByText('Verified: you can get women-mode requests')).toBeTruthy();
    rerender(<DriverWomenModeRow raw={{ gender_verified: true, eligible: false, suspended: true }} />);
    expect(screen.getByText('Paused while our team reviews a report')).toBeTruthy();
    rerender(<DriverWomenModeRow raw={{ gender_verified: true, eligible: false, suspended: false }} />);
    expect(toJSON()).toBeNull();
    rerender(<DriverWomenModeRow raw={null} />);
    expect(toJSON()).toBeNull();
  });
});
