import { createAsyncThunk, createSlice, isAnyOf, type PayloadAction } from '@reduxjs/toolkit';
import type { RideRatingFields } from '../rating/types';
import { toThunkRejection, type ThunkRejection } from '../../core/api/errors';
import type { RideResource } from '../../services/rideService';
import locationTrackingService from '../../services/locationTrackingService';
import { currentSessionEpoch, isStaleSession } from '../../store/sessionEpoch';
import { isStaleSessionRejection, staleSessionRejection } from '../../store/thunks/apiThunks';
import { acceptRideRequest } from '../driver-requests/slice';
import { DRIVER_LOCATION_CONFIG } from '../driver-location/config';
import { DRIVER_RIDE_CODES, driverRideApi, runTransition, type DriverRideTransition } from './api';
import { DRIVER_RIDE_COPY } from './copy';
import { isRestorableDriverRide } from './steps';
import { PIN_CODES } from '../safety/pin';
import { invalidateStatsForRide } from '../stats/invalidate';

/**
 * The ride the signed-in driver is on (T-404/T-405): the one source of truth for the driver
 * ride screen and the Map's "Open ride" card. Set from the POST /rides/{id}/assign-driver
 * answer, then only ever replaced by the server's answer to a lifecycle step (BE-04), a
 * refresh (GET /rides/{id}) or the launch restore (GET /driver/status active_ride_id).
 *
 * `pendingAction` is the request in flight. Every thunk is skipped while one is set, so a
 * double tap sends one request and a late answer never overwrites a newer one. T-556 (QA
 * 2026-10-16: one "Stop done" tap ignored): a driver's step is never skipped for a background
 * read (the ~8 s poll, the foreground refresh, the restore). It takes over, and the read's
 * answer, older than the step, is dropped (`pendingRequestId`).
 *
 * Not persisted; `resetApp` (logout) clears it through the root reducer, and every thunk drops
 * an answer that arrives after a logout (session epoch).
 */
export type DriverRideAction = DriverRideTransition | 'stop' | 'cancel' | 'refresh' | 'restore';

export interface DriverRideState {
  ride: RideResource | null;
  pendingAction: DriverRideAction | null;
  /** The request id of `pendingAction`: only its own answer applies and clears it (T-556). */
  pendingRequestId: string | null;
}

export const initialDriverRideState: DriverRideState = { ride: null, pendingAction: null, pendingRequestId: null };

type SliceRoot = { driverRide: DriverRideState };
type ThunkConfig = { state: SliceRoot; rejectValue: ThunkRejection };

const isIdle = (state: SliceRoot): boolean => state.driverRide.pendingAction === null;

/** Background reads a driver's step may take over (T-556). */
const isBackgroundRead = (action: DriverRideAction | null): boolean => action === 'refresh' || action === 'restore';

/** No request, or only a background read, in flight: a driver's step may be sent. */
const isFreeForStep = (state: SliceRoot): boolean =>
  isIdle(state) || isBackgroundRead(state.driverRide.pendingAction);

/**
 * The thunk body every request shares: an answer that arrives after a logout is dropped
 * (session epoch), and a failure becomes a display-safe ThunkRejection.
 */
const runGuarded = async <Rejected>(
  request: () => Promise<RideResource>,
  rejectWithValue: (value: ThunkRejection) => Rejected,
  fallback: string,
): Promise<RideResource | Rejected> => {
  const startedIn = currentSessionEpoch();
  try {
    const ride = await request();
    if (isStaleSession(startedIn)) return rejectWithValue(staleSessionRejection());
    invalidateStatsForRide(ride);
    return ride;
  } catch (error) {
    return rejectWithValue(toThunkRejection(error, fallback));
  }
};

export type AdvanceDriverRideArg =
  | { rideId: number; action: Exclude<DriverRideTransition, 'start'> }
  /** BE-81: `pin` while the ride says `pin_required`. */
  | { rideId: number; action: 'start'; pin?: string }
  | { rideId: number; action: 'stop'; stopId: number };

/**
 * One forward step: arrived, start, complete (BE-04, no body: the server computes the fare),
 * or a stop marked done (POST /rides/{id}/stops/{stop}/complete, then GET /rides/{id}, since
 * the stop endpoint does not answer with the ride).
 *
 * Before "arrived", a location ping older than ~20 s is refreshed with one post (T-409), so
 * the server's arrival check (BE-64, 422 `not_near_pickup`) sees where the driver is now.
 */
export const advanceDriverRide = createAsyncThunk<RideResource, AdvanceDriverRideArg, ThunkConfig>(
  'driverRide/advance',
  (arg, { rejectWithValue }) =>
    runGuarded(
      async () => {
        if (arg.action === 'stop') {
          await driverRideApi.completeStop(arg.rideId, arg.stopId);
          return driverRideApi.get(arg.rideId);
        }
        if (arg.action === 'arrived') {
          await locationTrackingService.pingIfStale(DRIVER_LOCATION_CONFIG.arrivalPingMaxAgeMs);
        }
        return runTransition(arg.rideId, arg.action, arg.action === 'start' ? arg.pin : undefined);
      },
      rejectWithValue,
      DRIVER_RIDE_COPY.actionFailed,
    ),
  // T-556: a background read in flight does not swallow the driver's tap.
  { condition: (_, { getState }) => isFreeForStep(getState()) },
);

/** GET /rides/{id}: the latest server copy (on screen mount, foreground, or after a 409). */
export const refreshDriverRide = createAsyncThunk<RideResource, number, ThunkConfig>(
  'driverRide/refresh',
  (rideId, { rejectWithValue }) =>
    runGuarded(() => driverRideApi.get(rideId), rejectWithValue, DRIVER_RIDE_COPY.refreshFailed),
  { condition: (_, { getState }) => isIdle(getState()) },
);

/**
 * GET /rides/{id} for the ride GET /driver/status reports as active (launch, sign-in,
 * foreground). Only an accepted, arrived or started ride is kept.
 */
export const restoreDriverRide = createAsyncThunk<RideResource, number, ThunkConfig>(
  'driverRide/restore',
  (rideId, { rejectWithValue }) =>
    runGuarded(() => driverRideApi.get(rideId), rejectWithValue, DRIVER_RIDE_COPY.refreshFailed),
  { condition: (_, { getState }) => isIdle(getState()) },
);

/** POST /rides/{id}/cancel {note}: the driver gives the ride up before the trip starts. */
export const cancelDriverRide = createAsyncThunk<RideResource, { rideId: number; note: string }, ThunkConfig>(
  'driverRide/cancel',
  ({ rideId, note }, { rejectWithValue }) =>
    runGuarded(() => driverRideApi.cancel(rideId, note.trim()), rejectWithValue, DRIVER_RIDE_COPY.actionFailed),
  { condition: (_, { getState }) => isIdle(getState()) },
);

const isCurrent = (state: DriverRideState, rideId: number): boolean => state.ride?.id === rideId;

/** A request starts: it is now the one in flight. */
const begin = (state: DriverRideState, action: DriverRideAction, requestId: string): void => {
  state.pendingAction = action;
  state.pendingRequestId = requestId;
};

/**
 * A request settled. True when it was the one in flight (the flag is cleared); false for a
 * background read a driver's step took over, whose answer is older than that step (T-556).
 */
const settle = (state: DriverRideState, requestId: string): boolean => {
  if (state.pendingRequestId !== requestId) return false;
  state.pendingAction = null;
  state.pendingRequestId = null;
  return true;
};

/** Applies a server copy of the current ride (an answer for another ride is ignored). */
const applyRide = (state: DriverRideState, ride: RideResource): void => {
  if (isCurrent(state, ride.id)) {
    state.ride = ride;
  }
};

/**
 * The ride is not this driver's any more: 403 NOT_ASSIGNED_DRIVER (another driver, or the
 * driver cancelled on another device), or 403/404 on a read (BE-24 ownership).
 */
const lostRide = (payload: ThunkRejection | undefined, isRead: boolean): boolean => {
  if (!payload) return false;
  if (payload.code === DRIVER_RIDE_CODES.notAssignedDriver) return true;
  return isRead && (payload.kind === 'not_found' || payload.kind === 'forbidden');
};

const driverRideSlice = createSlice({
  name: 'driverRide',
  initialState: initialDriverRideState,
  reducers: {
    /** A newer server copy of the ride. */
    setDriverActiveRide(state, action: PayloadAction<RideResource>) {
      state.ride = action.payload;
    },
    /** The driver has seen the outcome (summary, cancelled), or the ride was taken away. */
    clearDriverActiveRide(state) {
      state.ride = null;
    },
    /** T-505: the rating answer (or the re-read after a 409) for the ride on screen. */
    driverRideRatingChanged(
      state,
      action: PayloadAction<{ rideId: number } & RideRatingFields>,
    ) {
      if (state.ride && state.ride.id === action.payload.rideId) {
        state.ride.my_rating = action.payload.my_rating;
        state.ride.can_rate = action.payload.can_rate;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(acceptRideRequest.fulfilled, (state, action) => {
        state.ride = action.payload;
      })
      .addCase(advanceDriverRide.pending, (state, action) => {
        begin(state, action.meta.arg.action, action.meta.requestId);
      })
      .addCase(advanceDriverRide.fulfilled, (state, action) => {
        settle(state, action.meta.requestId);
        applyRide(state, action.payload);
      })
      .addCase(refreshDriverRide.pending, (state, action) => {
        begin(state, 'refresh', action.meta.requestId);
      })
      .addCase(refreshDriverRide.fulfilled, (state, action) => {
        // Taken over by a driver's step: this copy predates it.
        if (settle(state, action.meta.requestId)) applyRide(state, action.payload);
      })
      .addCase(restoreDriverRide.pending, (state, action) => {
        begin(state, 'restore', action.meta.requestId);
      })
      .addCase(restoreDriverRide.fulfilled, (state, action) => {
        // A ride accepted while the restore ran is newer than this answer.
        if (settle(state, action.meta.requestId) && state.ride === null && isRestorableDriverRide(action.payload)) {
          state.ride = action.payload;
        }
      })
      .addCase(cancelDriverRide.pending, (state, action) => {
        begin(state, 'cancel', action.meta.requestId);
      })
      .addCase(cancelDriverRide.fulfilled, (state, action) => {
        settle(state, action.meta.requestId);
        // Cancelled, or back in the queue for another driver: no longer ours either way.
        if (isCurrent(state, action.payload.id)) {
          state.ride = null;
        }
      })
      .addMatcher(
        isAnyOf(
          advanceDriverRide.rejected,
          refreshDriverRide.rejected,
          restoreDriverRide.rejected,
          cancelDriverRide.rejected,
        ),
        (state, action) => {
          // A skipped thunk (condition) never set pendingAction; leave the running one alone.
          if (action.meta.condition) return;
          const own = settle(state, action.meta.requestId);
          // T-556: a background read taken over by a driver's step says nothing about the ride now.
          if (!own && (refreshDriverRide.rejected.match(action) || restoreDriverRide.rejected.match(action))) return;
          const payload = action.payload;
          if (isStaleSessionRejection(payload)) return;
          const arg = action.meta.arg;
          const rideId = typeof arg === 'number' ? arg : arg.rideId;
          if (isCurrent(state, rideId) && lostRide(payload, refreshDriverRide.rejected.match(action))) {
            state.ride = null;
          } else if (state.ride && isCurrent(state, rideId) && payload?.code === PIN_CODES.blocked) {
            // BE-81: the start is blocked until an admin clears it; no PIN entry is offered.
            state.ride.pin_blocked = true;
          }
        },
      );
  },
});

export const { setDriverActiveRide, clearDriverActiveRide, driverRideRatingChanged } = driverRideSlice.actions;

export const selectDriverActiveRide = (state: SliceRoot): RideResource | null => state.driverRide.ride;

export const selectDriverRidePendingAction = (state: SliceRoot): DriverRideAction | null =>
  state.driverRide.pendingAction;

export default driverRideSlice.reducer;
