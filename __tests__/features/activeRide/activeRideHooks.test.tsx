/**
 * T-301: the status poll and the launch restore hooks. The poll is one interval keyed on the
 * ride id that stops on a final status, when disabled and on unmount; the restore asks the
 * server once and hands the ride to the caller (which navigates to it).
 */
import React from 'react';
import { Provider } from 'react-redux';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import { createActiveRide } from '../../../src/features/active-ride/slice';
import {
  useActiveRidePolling,
  useRestoreActiveRide,
} from '../../../src/features/active-ride/hooks';
import { envelope, makeRide, makeRideRequest, makeStore, page, type TestStore } from '../../../test-utils/rideFixtures';

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
  jest.useRealTimers();
});

const wrapperFor = (store: TestStore) =>
  function Wrapper({ children }: React.PropsWithChildren) {
    return <Provider store={store}>{children}</Provider>;
  };

const withRide = (status: 'requested' | 'completed' = 'requested') => {
  const store = makeStore();
  store.dispatch(createActiveRide.fulfilled(makeRide({ id: 21, status }), 'req', makeRideRequest()));
  return store;
};

/**
 * Runs the timers that are due now (one poll interval) and the promises they start, so the
 * request and its reducer settle inside act() without depending on microtask counts.
 */
const tick = async () => {
  await act(async () => {
    await jest.runOnlyPendingTimersAsync();
  });
};

/** Lets an already started request (the read on focus) settle. */
const settle = async () => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
};

describe('useActiveRidePolling', () => {
  it('reads the ride at once on focus, then every interval, and stops once it is completed', async () => {
    jest.useFakeTimers();
    const store = withRide();
    mock
      .onGet('/rides/21')
      .replyOnce(200, envelope(makeRide({ id: 21, status: 'requested' })))
      .onGet('/rides/21')
      .replyOnce(200, envelope(makeRide({ id: 21, status: 'accepted' })))
      .onGet('/rides/21')
      .replyOnce(200, envelope(makeRide({ id: 21, status: 'completed' })));

    renderHook(() => useActiveRidePolling(true), { wrapper: wrapperFor(store) });

    // T-301 follow-up: no wait of one interval when the screen gains focus.
    await settle();
    expect(mock.history.get).toHaveLength(1);

    await tick();
    expect(store.getState().activeRide.ride?.status).toBe('accepted');
    await tick();
    expect(store.getState().activeRide.ride?.status).toBe('completed');

    await tick();
    await tick();
    expect(mock.history.get).toHaveLength(3);
  });

  it('refreshes again when the screen regains focus', async () => {
    jest.useFakeTimers();
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21 })));
    const { rerender } = renderHook(({ focused }: { focused: boolean }) => useActiveRidePolling(focused), {
      wrapper: wrapperFor(withRide()),
      initialProps: { focused: true },
    });
    await settle();
    rerender({ focused: false });
    await tick();
    expect(mock.history.get).toHaveLength(1);

    rerender({ focused: true });
    await settle();
    expect(mock.history.get).toHaveLength(2);
  });

  it('does not poll while disabled (screen unfocused) or for a finished ride', async () => {
    jest.useFakeTimers();
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21 })));

    renderHook(() => useActiveRidePolling(false), { wrapper: wrapperFor(withRide()) });
    renderHook(() => useActiveRidePolling(true), { wrapper: wrapperFor(withRide('completed')) });
    await settle();
    await tick();

    expect(mock.history.get).toHaveLength(0);
  });

  it('clears its interval on unmount', async () => {
    jest.useFakeTimers();
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21 })));

    const { unmount } = renderHook(() => useActiveRidePolling(true), { wrapper: wrapperFor(withRide()) });
    await settle();
    unmount();
    await tick();
    await tick();

    // Only the read on focus; no interval survives the unmount.
    expect(mock.history.get).toHaveLength(1);
  });
});

describe('useRestoreActiveRide', () => {
  it('hands the server ride to the caller once', async () => {
    mock.onGet('/rides').reply(200, page([makeRide({ id: 33, status: 'accepted' })]));
    const store = makeStore();
    const onRestored = jest.fn();

    const { rerender } = renderHook(() => useRestoreActiveRide(onRestored), { wrapper: wrapperFor(store) });

    await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1));
    expect(onRestored.mock.calls[0][0]).toMatchObject({ id: 33 });
    rerender({});
    expect(mock.history.get).toHaveLength(1);
  });

  it('does not call back when there is no active ride, or after unmount', async () => {
    mock.onGet('/rides').reply(200, page([]));
    const none = jest.fn();
    renderHook(() => useRestoreActiveRide(none), { wrapper: wrapperFor(makeStore()) });
    await waitFor(() => expect(mock.history.get).toHaveLength(1));

    mock.onGet('/rides').reply(200, page([makeRide({ status: 'requested' })]));
    const late = jest.fn();
    const store = makeStore();
    const { unmount } = renderHook(() => useRestoreActiveRide(late), { wrapper: wrapperFor(store) });
    unmount();
    await waitFor(() => expect(store.getState().activeRide.restoreStatus).toBe('done'));

    expect(none).not.toHaveBeenCalled();
    expect(late).not.toHaveBeenCalled();
  });
});
