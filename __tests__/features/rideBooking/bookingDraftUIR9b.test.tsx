/**
 * UI-R9b (passenger-destination-search Interactions): leaving Booking with a planned trip and no
 * ride keeps it in memory (never a server write, never storage); Home's "Where to?" restores it
 * within 10 minutes (other entries do not); "Discard", a requested ride and sign-out drop it; a
 * pickup at the passenger's position is not kept.
 */
import { act, renderHook } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BOOKING_DRAFT_TTL_MS,
  clearBookingDraft,
  keepBookingDraft,
  takeBookingDraft,
  toBookingDraft,
  type BookingDraft,
} from '../../../src/features/ride-booking/bookingDraftStore';
import { initialBookingState } from '../../../src/features/ride-booking/prefill';
import { useDiscardOnLeave, useKeepBookingDraft } from '../../../src/features/ride-booking/useBookingDraft';
import { BOOKING_COPY } from '../../../src/features/ride-booking/copy';
import { dialog, dialogStore } from '../../../src/core/dialog';
import { apiClient } from '../../../src/services/api';
import { bumpSessionEpoch } from '../../../src/store/sessionEpoch';

const pickup = { latitude: 31.52, longitude: 74.35, address: 'Liberty Market, Lahore' };
const destination = { latitude: 31.46, longitude: 74.26, address: 'Emporium Mall, Lahore' };
const stop = { latitude: 31.5, longitude: 74.3, address: 'Stop, Lahore' };
const draft = (over: Partial<BookingDraft> = {}): BookingDraft => ({
  pickup,
  destination,
  stops: [stop],
  pickupQuery: pickup.address,
  destQuery: destination.address,
  ...over,
});

beforeEach(() => clearBookingDraft());

describe('the draft store (memory only)', () => {
  it('keeps a trip for 10 minutes, offered more than once, then drops it', () => {
    keepBookingDraft(draft(), 1000);
    expect(takeBookingDraft(1000 + BOOKING_DRAFT_TTL_MS)).toEqual(draft());
    expect(takeBookingDraft(1000 + BOOKING_DRAFT_TTL_MS)).toEqual(draft());
    expect(takeBookingDraft(1001 + BOOKING_DRAFT_TTL_MS)).toBeNull();
    expect(takeBookingDraft(1000)).toBeNull();
  });

  it('a pickup at the passenger\'s position is not kept; nothing chosen keeps nothing (and forgets the old one)', () => {
    expect(toBookingDraft(draft({ pickupQuery: BOOKING_COPY.currentLocation }))).toMatchObject({ pickup: null, pickupQuery: '' });
    expect(toBookingDraft(draft({ pickupQuery: BOOKING_COPY.resolvingAddress }))).toMatchObject({ pickup: null });
    // A pinned pickup ("Pinned on map") is a real choice.
    expect(toBookingDraft(draft({ pickupQuery: BOOKING_COPY.pinnedOnMap }))?.pickup).toEqual(pickup);
    keepBookingDraft(draft());
    keepBookingDraft(draft({ pickup: null, destination: null, stops: [], pickupQuery: BOOKING_COPY.currentLocation, destQuery: '' }));
    expect(takeBookingDraft()).toBeNull();
  });

  it('nothing is written to storage or sent', async () => {
    const setItem = jest.spyOn(AsyncStorage, 'setItem');
    const request = jest.spyOn(apiClient, 'request');
    keepBookingDraft(draft());
    takeBookingDraft();
    expect(setItem).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    setItem.mockRestore();
    request.mockRestore();
  });
});

describe('restore on "Where to?" only', () => {
  it('both ends: straight to Choose a ride with the stops; other entries start fresh', () => {
    keepBookingDraft(draft());
    expect(initialBookingState(undefined)).toMatchObject({ pickup: null, destination: null, stage: 'home', stops: [] });
    expect(initialBookingState({ destination })).toMatchObject({ pickup: null, stage: 'home' });
    expect(initialBookingState({ entry: 'whereTo', whereToTop: 600 })).toMatchObject({
      pickup,
      destination,
      stops: [stop],
      pickupQuery: pickup.address,
      destQuery: destination.address,
      stage: 'vehicle',
      routePending: true,
    });
  });

  it('a destination with the GPS pickup: the planner, the route once the pickup is known', () => {
    keepBookingDraft(draft({ pickup: null, pickupQuery: BOOKING_COPY.currentLocation }));
    expect(initialBookingState({ entry: 'whereTo' })).toMatchObject({ pickup: null, destination, stage: 'home', routePending: true });
  });

  it('nothing kept: the normal start', () => {
    expect(initialBookingState({ entry: 'whereTo' })).toMatchObject({ pickup: null, destination: null, stage: 'home', stops: [] });
  });
});

describe('Booking keeps and drops the draft', () => {
  const flow = (over: Partial<BookingDraft> = {}) => {
    const d = draft(over);
    return {
      pickup: d.pickup,
      destination: d.destination,
      stops: d.stops,
      pickupField: { text: d.pickupQuery, revision: 0 },
      destField: { text: d.destQuery, revision: 0 },
    };
  };

  it('leaving without a ride keeps the trip', () => {
    const { unmount } = renderHook(() => useKeepBookingDraft({ flow: flow(), rideShown: false }));
    unmount();
    expect(takeBookingDraft()).toMatchObject({ destination, stops: [stop] });
  });

  it('review: a sign-out (401) before Booking unmounts never leaves the trip for the next user', () => {
    const { unmount } = renderHook(() => useKeepBookingDraft({ flow: flow(), rideShown: false }));
    bumpSessionEpoch();
    clearBookingDraft();
    unmount();
    expect(takeBookingDraft()).toBeNull();
  });

  it('a draft of an ended session is never offered', () => {
    keepBookingDraft(draft());
    bumpSessionEpoch();
    expect(takeBookingDraft()).toBeNull();
  });

  it('a ride on screen drops it (and nothing is kept on leaving)', () => {
    keepBookingDraft(draft());
    const { unmount } = renderHook(() => useKeepBookingDraft({ flow: flow(), rideShown: true }));
    expect(takeBookingDraft()).toBeNull();
    unmount();
    expect(takeBookingDraft()).toBeNull();
  });

  it('"Discard" in the leave question drops it', async () => {
    const answers = dialogStore.subscribe(() => {
      const current = dialogStore.getCurrent();
      if (current) dialog.answer(current.id, true);
    });
    const onLeave = jest.fn();
    const keep = renderHook(() => useKeepBookingDraft({ flow: flow(), rideShown: false }));
    const leave = renderHook(() =>
      useDiscardOnLeave({
        flow: { stepBack: () => false, destination, stops: [] },
        rideShown: false,
        onLeave,
        onDiscard: keep.result.current,
      }),
    );
    await act(async () => {
      leave.result.current();
      for (let i = 0; i < 5; i += 1) await Promise.resolve();
    });
    expect(onLeave).toHaveBeenCalled();
    keep.unmount();
    expect(takeBookingDraft()).toBeNull();
    answers();
  });
});
