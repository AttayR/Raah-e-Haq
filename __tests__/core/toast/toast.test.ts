import axios, { AxiosError, AxiosHeaders, AxiosResponse } from 'axios';
import { ApiError } from '../../../src/core/api/errors';
import {
  TOAST_DURATION_MS,
  TOAST_DURATION_WITH_ACTION_MS,
  errorToastMessage,
  toast,
  toastStore,
} from '../../../src/core/toast';

const axiosErrorWith = (status: number, data: unknown) => {
  const config = { headers: new AxiosHeaders() };
  const response = { status, data, headers: {}, config, statusText: '' } as unknown as AxiosResponse;
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, {}, response);
};

afterEach(() => toast.hide());

describe('toast queue', () => {
  it('shows one toast at a time, in order', () => {
    const first = toast.error('First');
    toast.success('Second');

    expect(toastStore.getCurrent()).toMatchObject({ id: first, type: 'error', title: 'First' });
    toast.hide(first);
    expect(toastStore.getCurrent()).toMatchObject({ type: 'success', title: 'Second' });
  });

  it('notifies subscribers and stops after unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = toastStore.subscribe(listener);
    toast.info('Hello');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    toast.info('Again');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('uses the spec durations: 3 s, 4 s with an action, loading stays until hidden', () => {
    toast.info('Plain');
    toast.info('With action', undefined, { action: { label: 'Undo', onPress: jest.fn() } });
    const loadingId = toast.loading('Working');
    toast.warning('Custom', undefined, { duration: 1000 });

    const durations = toastStore.getQueue().map(t => t.duration);
    expect(durations).toEqual([TOAST_DURATION_MS, TOAST_DURATION_WITH_ACTION_MS, 0, 1000]);

    toast.hide(loadingId);
    expect(toastStore.getQueue().some(t => t.id === loadingId)).toBe(false);
  });

  it('does not queue the same message twice while it is pending', () => {
    const a = toast.error('Network error');
    const b = toast.error('Network error');
    expect(b).toBe(a);
    expect(toastStore.getQueue()).toHaveLength(1);
  });

  it('caps the queue but keeps the visible toast', () => {
    const visible = toast.info('Visible');
    for (let i = 0; i < 10; i += 1) toast.info(`Pending ${i}`);
    const queue = toastStore.getQueue();
    expect(queue).toHaveLength(5);
    expect(queue[0].id).toBe(visible);
    expect(queue[queue.length - 1].title).toBe('Pending 9');
  });

  it('runs onHide when a toast is hidden from code, by id or all at once', () => {
    const first = jest.fn();
    const second = jest.fn();
    const id = toast.loading('Working', undefined, { onHide: first });
    toast.info('Next', undefined, { onHide: second });

    toast.hide(id);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();

    toast.hide();
    expect(second).toHaveBeenCalledTimes(1);
    toast.hide(id); // already gone: no second call
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('hide() with no id clears everything', () => {
    toast.info('a');
    toast.info('b');
    toast.hide();
    expect(toastStore.getCurrent()).toBeNull();
  });
});

describe('toast.fromError', () => {
  it('shows the ApiError message', () => {
    const id = toast.fromError(
      new ApiError({ kind: 'validation', message: 'The email has already been taken.' }),
      'Fallback',
    );
    expect(id).not.toBeNull();
    expect(toastStore.getCurrent()).toMatchObject({ type: 'error', title: 'The email has already been taken.' });
  });

  it('maps a raw axios error through the API layer (5xx text is never shown)', () => {
    expect(errorToastMessage(axiosErrorWith(500, { message: 'SQLSTATE[42S22] users.phone' }), 'Fallback')).toBe(
      'Something went wrong on our side. Please try again.',
    );
    expect(errorToastMessage(axiosErrorWith(429, { message: 'Too many OTP requests' }), 'Fallback')).toBe(
      'Too many OTP requests',
    );
  });

  it('uses the message of a rejected thunk payload', () => {
    expect(errorToastMessage({ message: 'Invalid credentials', kind: 'auth' }, 'Fallback')).toBe('Invalid credentials');
    expect(errorToastMessage('Plain string payload', 'Fallback')).toBe('Plain string payload');
    expect(errorToastMessage(undefined, 'Fallback')).toBe('Fallback');
  });

  it('uses the fallback for other thrown errors (their text is technical)', () => {
    expect(errorToastMessage(new TypeError("undefined is not an object (evaluating 'a.b')"), 'Fallback')).toBe(
      'Fallback',
    );
  });

  it('shows nothing for a cancelled request', () => {
    expect(toast.fromError(new axios.Cancel('aborted'), 'Fallback')).toBeNull();
    expect(toast.fromError(new ApiError({ kind: 'cancelled', message: 'Request was cancelled' }), 'Fallback')).toBeNull();
    expect(toastStore.getCurrent()).toBeNull();
  });
});
