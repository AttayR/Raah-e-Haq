import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import rideService, { type RideRequest, type RideResource } from '../../services/rideService';
import { toThunkRejection, type ThunkRejection } from '../../core/api/errors';
import { currentSessionEpoch, isStaleSession, STALE_SESSION_MESSAGE } from '../../store/sessionEpoch';
import { fetchActiveRide } from './api';
import { isRideInProgress, isRideTerminal } from './status';

/**
 * The passenger's active ride: the single source of truth for every screen (T-301, PAX-10).
 * It replaces the unused `ride`/`trip` slices and the per-screen copy in useRide.
 *
 * Not persisted: on launch it is restored from the server (restoreActiveRide), never from a
 * device cache, so a ride that ended while the app was closed is never shown as live.
 * `resetApp` (logout) returns it to the initial state through the root reducer.
 */
export type ActiveRideRestoreStatus = 'idle' | 'loading' | 'done' | 'failed';

export interface ActiveRideState {
  ride: RideResource | null;
  /** The launch restore (GET /rides): `done` once the server answered, ride or not. */
  restoreStatus: ActiveRideRestoreStatus;
  /** POST /rides or POST /rides/{id}/cancel in flight. */
  isSubmitting: boolean;
  /** GET /rides/{id} poll in flight (a slow poll never overlaps the next one). */
  isRefreshing: boolean;
  /** Display-safe message of the last failed create/cancel. */
  error: string | null;
}

export const initialActiveRideState: ActiveRideState = {
  ride: null,
  restoreStatus: 'idle',
  isSubmitting: false,
  isRefreshing: false,
  error: null,
};

/**
 * Only what these thunks read is typed here, so this file never imports the store. The
 * signed-in user (apiAuth.user) is read to restore only that passenger's ride.
 */
type SliceRoot = { activeRide: ActiveRideState; apiAuth?: { user: { id: number } | null } };
type ThunkConfig = { state: SliceRoot; rejectValue: ThunkRejection };

const staleSession = (): ThunkRejection => ({
  message: STALE_SESSION_MESSAGE,
  kind: 'cancelled',
  fieldErrors: {},
});

/**
 * Asks the server for the signed-in passenger's in-progress ride (launch restore, T-301).
 * Only a ride whose passenger_id is the signed-in user is kept. Skipped while one is already
 * running. A result that arrives after a logout is dropped.
 */
export const restoreActiveRide = createAsyncThunk<RideResource | null, void, ThunkConfig>(
  'activeRide/restore',
  async (_, { getState, rejectWithValue }) => {
    const startedIn = currentSessionEpoch();
    const passengerId = getState().apiAuth?.user?.id;
    if (typeof passengerId !== 'number') {
      // Signed out (or no profile yet): there is no passenger to restore a ride for.
      return null;
    }
    try {
      const ride = await fetchActiveRide(passengerId);
      return isStaleSession(startedIn) ? rejectWithValue(staleSession()) : ride;
    } catch (error) {
      return rejectWithValue(toThunkRejection(error, 'Could not check for an active ride'));
    }
  },
  { condition: (_, { getState }) => getState().activeRide.restoreStatus !== 'loading' },
);

/** POST /rides; the created ride becomes the active ride. */
export const createActiveRide = createAsyncThunk<RideResource, RideRequest, ThunkConfig>(
  'activeRide/create',
  async (request, { rejectWithValue }) => {
    const startedIn = currentSessionEpoch();
    try {
      const ride = await rideService.createRide(request);
      return isStaleSession(startedIn) ? rejectWithValue(staleSession()) : ride;
    } catch (error) {
      return rejectWithValue(toThunkRejection(error, 'Failed to request ride'));
    }
  },
);

/** GET /rides/{id} (the status poll). Skipped while the previous poll is still running. */
export const refreshActiveRide = createAsyncThunk<RideResource, number, ThunkConfig>(
  'activeRide/refresh',
  async (rideId, { rejectWithValue }) => {
    const startedIn = currentSessionEpoch();
    try {
      const ride = await rideService.getRide(rideId);
      return isStaleSession(startedIn) ? rejectWithValue(staleSession()) : ride;
    } catch (error) {
      return rejectWithValue(toThunkRejection(error, 'Failed to refresh ride'));
    }
  },
  { condition: (_, { getState }) => !getState().activeRide.isRefreshing },
);

/** POST /rides/{id}/cancel; on success the active ride is the cancelled ride (not in progress). */
export const cancelActiveRide = createAsyncThunk<RideResource, number, ThunkConfig>(
  'activeRide/cancel',
  async (rideId, { rejectWithValue }) => {
    const startedIn = currentSessionEpoch();
    try {
      const ride = await rideService.cancelRide(rideId);
      return isStaleSession(startedIn) ? rejectWithValue(staleSession()) : ride;
    } catch (error) {
      return rejectWithValue(toThunkRejection(error, 'Failed to cancel ride'));
    }
  },
);

const activeRideSlice = createSlice({
  name: 'activeRide',
  initialState: initialActiveRideState,
  reducers: {
    /** The screen has shown a finished ride's outcome; start over. */
    clearActiveRide: (state) => {
      state.ride = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(restoreActiveRide.pending, (state) => {
        state.restoreStatus = 'loading';
      })
      .addCase(restoreActiveRide.fulfilled, (state, action) => {
        state.restoreStatus = 'done';
        // A ride booked while the restore ran is newer than the server's answer.
        if (!state.ride) {
          state.ride = action.payload;
        }
      })
      .addCase(restoreActiveRide.rejected, (state) => {
        state.restoreStatus = 'failed';
      })
      .addCase(createActiveRide.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(createActiveRide.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.ride = action.payload;
      })
      .addCase(createActiveRide.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload?.message ?? 'Failed to request ride';
      })
      .addCase(refreshActiveRide.pending, (state) => {
        state.isRefreshing = true;
      })
      .addCase(refreshActiveRide.fulfilled, (state, action: PayloadAction<RideResource>) => {
        state.isRefreshing = false;
        // Ignore an answer for a ride that is no longer the active one (cleared), and a late
        // answer that would bring a finished ride (e.g. just cancelled) back to life.
        if (state.ride && state.ride.id === action.payload.id && !isRideTerminal(state.ride)) {
          state.ride = action.payload;
        }
      })
      .addCase(refreshActiveRide.rejected, (state, action) => {
        state.isRefreshing = false;
        // The ride is gone or not ours any more (BE-24 ownership): stop treating it as active.
        const kind = action.payload?.kind;
        if (state.ride && state.ride.id === action.meta.arg && (kind === 'not_found' || kind === 'forbidden')) {
          state.ride = null;
        }
      })
      .addCase(cancelActiveRide.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(cancelActiveRide.fulfilled, (state, action) => {
        state.isSubmitting = false;
        // The cancelled ride stays until the screen has shown it (T-304: one outcome card,
        // the same one a poll that saw the cancel first shows); clearActiveRide ends it.
        if (state.ride && state.ride.id === action.payload.id) {
          state.ride = action.payload;
        }
      })
      .addCase(cancelActiveRide.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload?.message ?? 'Failed to cancel ride';
      });
  },
});

export const { clearActiveRide } = activeRideSlice.actions;

export const selectActiveRide = (state: SliceRoot): RideResource | null => state.activeRide.ride;
export const selectActiveRideRestoreStatus = (state: SliceRoot): ActiveRideRestoreStatus =>
  state.activeRide.restoreStatus;
/** POST /rides or the cancel is in flight. */
export const selectActiveRideSubmitting = (state: SliceRoot): boolean => state.activeRide.isSubmitting;
/** The active ride only while it is in progress (not completed or cancelled). */
export const selectInProgressRide = (state: SliceRoot): RideResource | null =>
  isRideInProgress(state.activeRide.ride) ? state.activeRide.ride : null;

export default activeRideSlice.reducer;
