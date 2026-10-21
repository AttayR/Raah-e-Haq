/**
 * T-709 (found 2026-10-21 in the T-598 repro, ride 332): a "Cancel ride?" dialog opened while
 * searching stayed open over the completed-ride receipt, still saying "Free to cancel until…".
 * The question closes (through the themed dialog store, answered "no") once the ride leaves a
 * cancellable state, and no cancel request is sent. The T-589 live copy switch keeps working.
 */
import React from 'react';
import { Provider, useSelector } from 'react-redux';
import MockAdapter from 'axios-mock-adapter';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { apiClient } from '../../src/services/api';
import { dialog, dialogStore } from '../../src/core/dialog';
import { toast } from '../../src/core/toast';
import { resetScreenToasts } from '../../src/core/toast/screenToast';
import { usePassengerCancel } from '../../src/features/active-ride/cancel';
import { ACTIVE_RIDE_POLL_MS, useActiveRidePolling } from '../../src/features/active-ride/hooks';
import { createActiveRide, selectActiveRide } from '../../src/features/active-ride/slice';
import type { RideResource } from '../../src/services/rideService';
import { envelope, makeRide, makeRideRequest, makeStore, type TestStore } from '../../test-utils/rideFixtures';

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
});
afterEach(() => {
  mock.restore();
  act(() => {
    dialog.dismissAll();
    toast.hide();
    resetScreenToasts();
  });
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const wrapperFor = (store: TestStore) =>
  function Wrapper({ children }: React.PropsWithChildren) {
    return <Provider store={store}>{children}</Provider>;
  };

const FREE = { fee_now: 0, free_until: null, reason: null };
const ride332 = (status: RideResource['status'], extra: Partial<RideResource> = {}) =>
  makeRide({ id: 332, status, cancellation_preview: FREE, ...extra });

const openDialog = async () => {
  await waitFor(() => expect(dialogStore.getCurrent()).not.toBeNull());
  const current = dialogStore.getCurrent();
  if (!current) throw new Error('no dialog');
  return current;
};

describe('T-709: the cancel question closes when the ride can no longer be cancelled', () => {
  it('opened while searching, a ride poll returns completed: the dialog closes and no cancel is sent', async () => {
    jest.useFakeTimers();
    const store = makeStore();
    store.dispatch(createActiveRide.fulfilled(ride332('requested'), 'req', makeRideRequest()));
    mock.onGet('/rides/332').reply(200, envelope(ride332('requested')));
    const cancelRide = jest.fn(() => Promise.resolve('cancelled' as const));

    const { result } = renderHook(
      () => {
        useActiveRidePolling(true);
        const ride = useSelector(selectActiveRide);
        return usePassengerCancel(ride, cancelRide, jest.fn(), jest.fn());
      },
      { wrapper: wrapperFor(store) },
    );
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current();
    });
    const asked = await openDialog();
    expect(asked.title).toBe('Cancel request?');

    // The trip ran meanwhile (ride 332): the next poll reads it completed.
    mock.onGet('/rides/332').reply(200, envelope(ride332('completed', { driver_id: 5 })));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(ACTIVE_RIDE_POLL_MS + 1_000);
    });
    expect(selectActiveRide(store.getState())?.status).toBe('completed');

    // Closed through the dialog store (the host fades it out with its last text).
    expect(dialogStore.getCurrent()).toBeNull();
    await act(async () => {
      await pending;
    });
    expect(cancelRide).not.toHaveBeenCalled();
    expect(mock.history.post.filter(r => r.url === '/rides/332/cancel')).toHaveLength(0);
  });

  it.each(['cancelled', 'started'] as const)('"Cancel ride?" open when the ride becomes %s: closed, nothing sent', async status => {
    const cancelRide = jest.fn(() => Promise.resolve('cancelled' as const));
    const { result, rerender } = renderHook(
      ({ ride }: { ride: RideResource }) => usePassengerCancel(ride, cancelRide, jest.fn(), jest.fn()),
      { initialProps: { ride: ride332('accepted', { driver_id: 5 }) } },
    );
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current();
    });
    expect((await openDialog()).title).toBe('Cancel ride?');

    act(() => rerender({ ride: ride332(status, { driver_id: 5 }) }));
    expect(dialogStore.getCurrent()).toBeNull();
    await act(async () => {
      await pending;
    });
    expect(cancelRide).not.toHaveBeenCalled();
  });

  it('the screen switches to another cancellable ride: the question closes, the new ride is never cancelled', async () => {
    const cancelRide = jest.fn(() => Promise.resolve('cancelled' as const));
    const { result, rerender } = renderHook(
      ({ ride }: { ride: RideResource }) => usePassengerCancel(ride, cancelRide, jest.fn(), jest.fn()),
      { initialProps: { ride: ride332('accepted', { driver_id: 5 }) } },
    );
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current();
    });
    await openDialog();

    act(() => rerender({ ride: makeRide({ id: 333, status: 'accepted', driver_id: 5, cancellation_preview: FREE }) }));
    expect(dialogStore.getCurrent()).toBeNull();
    await act(async () => {
      await pending;
    });
    expect(cancelRide).not.toHaveBeenCalled();
  });

  it('still cancellable: the T-589 switch keeps the same dialog open, and it still cancels', async () => {
    const cancelRide = jest.fn(() => Promise.resolve('cancelled' as const));
    const { result, rerender } = renderHook(
      ({ ride }: { ride: RideResource }) => usePassengerCancel(ride, cancelRide, jest.fn(), jest.fn()),
      { initialProps: { ride: ride332('requested') } },
    );
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current();
    });
    const asked = await openDialog();
    act(() => rerender({ ride: ride332('accepted', { driver_id: 5 }) }));
    act(() => rerender({ ride: ride332('arrived', { driver_id: 5 }) }));
    expect(dialogStore.getCurrent()).toMatchObject({ id: asked.id, title: 'Cancel ride?' });

    await act(async () => {
      dialog.answer(asked.id, true);
      await pending;
    });
    expect(cancelRide).toHaveBeenCalledWith(332);
  });
});
