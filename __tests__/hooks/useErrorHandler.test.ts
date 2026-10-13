import { act, renderHook } from '@testing-library/react-native';
import { useErrorHandler } from '../../src/hooks/useErrorHandler';
import { ApiError } from '../../src/core/api/errors';
import { toast, toastStore } from '../../src/core/toast';
import { dialog, dialogStore } from '../../src/core/dialog';

jest.mock('../../src/core/logging/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

afterEach(() => {
  toast.hide();
  dialog.dismissAll();
  jest.restoreAllMocks();
});

describe('useErrorHandler', () => {
  it('shows a toast when the alert is turned off (the boolean param used to shadow showToast)', () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError(new Error('Network request failed'), 'LOAD', false);
    });

    expect(dialogStore.getCurrent()).toBeNull();
    expect(toastStore.getCurrent()).toMatchObject({
      type: 'error',
      title: 'Network connection issue. Please check your internet connection.',
    });
  });

  it('uses the ApiError message as is', () => {
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
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError('Please log in to request a ride', 'AUTH');
    });

    // UI-R3: the themed kit alert(), not the native Alert.
    expect(dialogStore.getCurrent()).toMatchObject({ kind: 'alert', title: 'Something went wrong', confirmLabel: 'OK' });
    expect(dialogStore.getCurrent()?.body).toBeTruthy();
    expect(toastStore.getCurrent()).toBeNull();
  });

  it('shows nothing when both are off', () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError('quiet', 'QUIET', false, false);
    });

    expect(dialogStore.getCurrent()).toBeNull();
    expect(toastStore.getCurrent()).toBeNull();
  });
});
