/**
 * T-302 (PAX-23, BE-37): a refused POST /rides shows the server's own reason (for a 422 the
 * field message, not "Validation failed"), is logged as a warning (no red LogBox), and
 * PHONE_NOT_VERIFIED offers phone verification instead of a generic failure.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { act, renderHook } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import { logger } from '../../../src/core/logging/logger';
import * as modals from '../../../src/components/NotificationManager';
import { RideRequestRefused, useActiveRideActions } from '../../../src/features/active-ride/hooks';
import { classifyRideRequestFailure } from '../../../src/features/ride-booking/rideRequestFailure';
import { envelope, makeRide, makeRideRequest, makeStore } from '../../../test-utils/rideFixtures';

let mock: MockAdapter;
let showError: jest.SpyInstance;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  showError = jest.spyOn(modals, 'showErrorModal').mockImplementation(() => undefined);
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

const validation422 = {
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    details: { vehicle_type: ['The selected vehicle type is invalid.'] },
  },
};

const phone403 = {
  success: false,
  message: 'Verify your phone number before requesting a ride.',
  error: { code: 'PHONE_NOT_VERIFIED', message: 'Verify your phone number before requesting a ride.' },
};

const renderActions = (onPhoneNotVerified?: () => void) => {
  const store = makeStore();
  const wrapper = ({ children }: React.PropsWithChildren) => <Provider store={store}>{children}</Provider>;
  return renderHook(() => useActiveRideActions({ onPhoneNotVerified }), { wrapper }).result;
};

describe('classifyRideRequestFailure', () => {
  const base = { kind: 'validation' as const, message: 'Validation failed', fieldErrors: {} };

  it('a 422 shows the first field message', () => {
    expect(
      classifyRideRequestFailure({ ...base, status: 422, fieldErrors: { vehicle_type: ['The selected vehicle type is invalid.'] } }, 'x'),
    ).toEqual({ kind: 'message', message: 'The selected vehicle type is invalid.' });
    expect(classifyRideRequestFailure({ ...base, status: 422 }, 'x')).toEqual({ kind: 'message', message: 'Validation failed' });
  });

  it('PHONE_NOT_VERIFIED, ACCOUNT_* and a missing payload', () => {
    expect(
      classifyRideRequestFailure({ ...base, kind: 'forbidden', status: 403, code: 'PHONE_NOT_VERIFIED', message: 'Verify' }, 'x'),
    ).toEqual({ kind: 'phone_not_verified', message: 'Verify' });
    expect(
      classifyRideRequestFailure({ ...base, kind: 'forbidden', status: 403, code: 'ACCOUNT_SUSPENDED', message: 'Suspended' }, 'x'),
    ).toEqual({ kind: 'handled' });
    expect(classifyRideRequestFailure({ ...base, kind: 'forbidden', status: 403, code: 'NOT_A_PASSENGER', message: 'Only passengers' }, 'x'))
      .toEqual({ kind: 'message', message: 'Only passengers' });
    expect(classifyRideRequestFailure(undefined, 'fallback')).toEqual({ kind: 'message', message: 'fallback' });
  });
});

describe('useActiveRideActions.requestRide success (T-311)', () => {
  it('opens no "Ride Requested" modal: the ride panel shows the searching stage', async () => {
    mock.onPost('/rides').reply(201, envelope(makeRide({ id: 31 })));
    const requestedModal = jest.spyOn(modals, 'showRideRequestedModal').mockImplementation(() => undefined);
    const successModal = jest.spyOn(modals, 'showSuccessModal').mockImplementation(() => undefined);
    const modal = jest.spyOn(modals, 'showModal').mockImplementation(() => undefined);
    const result = renderActions();

    let ride: unknown;
    await act(async () => {
      ride = await result.current.requestRide(makeRideRequest());
    });

    expect(ride).toMatchObject({ id: 31 });
    expect(requestedModal).not.toHaveBeenCalled();
    expect(successModal).not.toHaveBeenCalled();
    expect(modal).not.toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
  });
});

describe('useActiveRideActions.requestRide refusals', () => {
  it('a 422 shows the server field message and logs a warning, not an error', async () => {
    mock.onPost('/rides').reply(422, validation422);
    const warn = jest.spyOn(logger, 'warn');
    const error = jest.spyOn(logger, 'error');
    const result = renderActions();

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current.requestRide(makeRideRequest()).catch((e) => e);
    });

    expect(thrown).toBeInstanceOf(RideRequestRefused);
    expect(showError).toHaveBeenCalledWith('Ride Request Failed', 'The selected vehicle type is invalid.', expect.anything());
    expect(warn).toHaveBeenCalledWith('Failed to create ride', expect.objectContaining({ status: 422 }));
    expect(error).not.toHaveBeenCalled();
  });

  it('PHONE_NOT_VERIFIED offers verification and calls the screen back on the action', async () => {
    mock.onPost('/rides').reply(403, phone403);
    const onPhoneNotVerified = jest.fn();
    const result = renderActions(onPhoneNotVerified);

    await act(async () => {
      await result.current.requestRide(makeRideRequest()).catch(() => undefined);
    });

    expect(showError).toHaveBeenCalledTimes(1);
    const [title, message, primary, secondary] = showError.mock.calls[0];
    expect(title).toBe('Verify your phone number');
    expect(message).toBe('Verify your phone number before requesting a ride.');
    expect(primary.label).toBe('Verify number');
    expect(secondary.label).toBe('Not now');
    expect(onPhoneNotVerified).not.toHaveBeenCalled();
    act(() => primary.onPress());
    expect(onPhoneNotVerified).toHaveBeenCalledTimes(1);
  });

  it('403 ACCOUNT_* shows no booking modal (the API client routes it to account status)', async () => {
    mock.onPost('/rides').reply(403, {
      success: false,
      message: 'Your account is suspended.',
      code: 'ACCOUNT_SUSPENDED',
      data: { status: 'suspended' },
    });
    const result = renderActions();

    await act(async () => {
      await result.current.requestRide(makeRideRequest()).catch(() => undefined);
    });

    expect(showError).not.toHaveBeenCalled();
  });
});
