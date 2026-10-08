import { Alert } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { useErrorHandler } from '../../src/hooks/useErrorHandler';
import { ApiError } from '../../src/core/api/errors';
import { toast, toastStore } from '../../src/core/toast';

jest.mock('../../src/core/logging/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

afterEach(() => {
  toast.hide();
  jest.restoreAllMocks();
});

describe('useErrorHandler', () => {
  it('shows a toast when the alert is turned off (the boolean param used to shadow showToast)', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError(new Error('Network request failed'), 'LOAD', false);
    });

    expect(alert).not.toHaveBeenCalled();
    expect(toastStore.getCurrent()).toMatchObject({
      type: 'error',
      title: 'Network connection issue. Please check your internet connection.',
    });
  });

  it('uses the ApiError message as is', () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError(
        new ApiError({ kind: 'conflict', message: 'Ride already accepted by another driver' }),
        'ACCEPT',
        false,
      );
    });

    expect(toastStore.getCurrent()?.title).toBe('Ride already accepted by another driver');
  });

  it('gives one feedback path: the alert when asked for, no toast on top', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError('Please log in to request a ride', 'AUTH');
    });

    expect(alert).toHaveBeenCalledTimes(1);
    expect(toastStore.getCurrent()).toBeNull();
  });

  it('shows nothing when both are off', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError('quiet', 'QUIET', false, false);
    });

    expect(alert).not.toHaveBeenCalled();
    expect(toastStore.getCurrent()).toBeNull();
  });
});
