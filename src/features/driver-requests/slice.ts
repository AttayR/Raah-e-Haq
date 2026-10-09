import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { toThunkRejection, type ThunkRejection } from '../../core/api/errors';
import type { RideResource } from '../../services/rideService';
import { currentSessionEpoch, isStaleSession } from '../../store/sessionEpoch';
import { isStaleSessionRejection, staleSessionRejection } from '../../store/thunks/apiThunks';
import {
  driverRequestsApi,
  PENDING_RIDES_CODES,
  type LatLng,
  type PendingRideRequest,
} from './api';
import { DRIVER_REQUESTS_COPY } from './copy';

/**
 * The driver's incoming ride requests (T-403, DRV-04) and the accept in flight (T-404, DRV-05).
 *
 * `items` only ever holds what GET /rides/pending last answered, minus requests the driver
 * rejected (or lost on accept) and requests whose listing window has passed. Not persisted;
 * `resetApp` (logout) clears it through the root reducer.
 */
export type PendingRequestsLoad = 'idle' | 'loading' | 'done' | 'failed';

export interface DriverRequestsState {
  items: PendingRideRequest[];
  /** `loading` only before the first answer; later polls run behind the list. */
  loadStatus: PendingRequestsLoad;
  /** A poll is in flight. */
  isFetching: boolean;
  /** Display-safe message of the last failed poll (cleared by the next good one). */
  error: string | null;
  /** Server code of the last failed poll (409 DRIVER_*, NO_APPROVED_VEHICLE, 422 LOCATION_REQUIRED). */
  errorCode: string | null;
  /**
   * Ride ids hidden on this device (rejected, or refused on accept). There is no reject
   * endpoint, so an id stays hidden while the server keeps listing it and is forgotten once
   * the server stops listing it (taken, cancelled or expired).
   */
  dismissedIds: number[];
  /** The ride id of the accept in flight (one at a time). */
  acceptingId: number | null;
}

export const initialDriverRequestsState: DriverRequestsState = {
  items: [],
  loadStatus: 'idle',
  isFetching: false,
  error: null,
  errorCode: null,
  dismissedIds: [],
  acceptingId: null,
};

/** Only the slice is typed here, so this file never imports the store. */
type SliceRoot = { driverRequests: DriverRequestsState };
type ThunkConfig = { state: SliceRoot; rejectValue: ThunkRejection };

interface PendingRidesResult {
  requests: PendingRideRequest[];
  /** Epoch ms when the answer arrived; requests whose window already passed are dropped. */
  receivedAt: number;
}

/** 409 refusals of the feed: the driver cannot take any request right now. */
const BLOCKING_FEED_CODES: ReadonlySet<string> = new Set([
  PENDING_RIDES_CODES.driverNotAvailable,
  PENDING_RIDES_CODES.driverOnRide,
  PENDING_RIDES_CODES.noApprovedVehicle,
]);

const isLive = (request: PendingRideRequest, now: number): boolean =>
  request.expiresAt === null || request.expiresAt > now;

/** GET /rides/pending. Skipped while a poll is running, so answers never arrive out of order. */
export const fetchPendingRides = createAsyncThunk<PendingRidesResult, LatLng | null, ThunkConfig>(
  'driverRequests/fetchPending',
  async (location, { rejectWithValue }) => {
    const startedIn = currentSessionEpoch();
    try {
      const page = await driverRequestsApi.listPending(location);
      if (isStaleSession(startedIn)) {
        return rejectWithValue(staleSessionRejection());
      }
      return { requests: page.requests, receivedAt: Date.now() };
    } catch (error) {
      return rejectWithValue(toThunkRejection(error, DRIVER_REQUESTS_COPY.loadFailed));
    }
  },
  { condition: (_, { getState }) => !getState().driverRequests.isFetching },
);

/** POST /rides/{id}/assign-driver. Skipped while another accept is in flight (double tap). */
export const acceptRideRequest = createAsyncThunk<RideResource, number, ThunkConfig>(
  'driverRequests/accept',
  async (rideId, { rejectWithValue }) => {
    const startedIn = currentSessionEpoch();
    try {
      const ride = await driverRequestsApi.accept(rideId);
      return isStaleSession(startedIn) ? rejectWithValue(staleSessionRejection()) : ride;
    } catch (error) {
      return rejectWithValue(toThunkRejection(error, DRIVER_REQUESTS_COPY.acceptFailed));
    }
  },
  { condition: (_, { getState }) => getState().driverRequests.acceptingId === null },
);

const hide = (state: DriverRequestsState, rideId: number): void => {
  state.items = state.items.filter((item) => item.id !== rideId);
  if (!state.dismissedIds.includes(rideId)) {
    state.dismissedIds.push(rideId);
  }
};

const driverRequestsSlice = createSlice({
  name: 'driverRequests',
  initialState: initialDriverRequestsState,
  reducers: {
    /** Reject: no server endpoint, so the request is hidden here until it stops being listed. */
    dismissRideRequest(state, action: PayloadAction<number>) {
      hide(state, action.payload);
    },
    /** Drops requests whose listing window has passed (`now` in epoch ms). */
    pruneExpiredRequests(state, action: PayloadAction<number>) {
      state.items = state.items.filter((item) => isLive(item, action.payload));
    },
    /** Polling stopped (offline, on a ride, app in background, screen left). */
    clearPendingRequests(state) {
      state.items = [];
      state.loadStatus = 'idle';
      state.error = null;
      state.errorCode = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPendingRides.pending, (state) => {
        state.isFetching = true;
        if (state.loadStatus === 'idle') {
          state.loadStatus = 'loading';
        }
      })
      .addCase(fetchPendingRides.fulfilled, (state, action) => {
        const { requests, receivedAt } = action.payload;
        const listed = new Set(requests.map((request) => request.id));
        state.dismissedIds = state.dismissedIds.filter((id) => listed.has(id));
        state.items = requests.filter(
          (request) => !state.dismissedIds.includes(request.id) && isLive(request, receivedAt),
        );
        state.isFetching = false;
        state.loadStatus = 'done';
        state.error = null;
        state.errorCode = null;
      })
      .addCase(fetchPendingRides.rejected, (state, action) => {
        if (action.meta.condition) {
          return;
        }
        state.isFetching = false;
        const payload = action.payload;
        if (isStaleSessionRejection(payload)) {
          return;
        }
        // A 429 only delays the next poll (the hook backs off); the list stays as it was.
        if (payload?.kind === 'rate_limited') {
          if (state.loadStatus === 'loading') {
            state.loadStatus = 'idle';
          }
          return;
        }
        state.loadStatus = 'failed';
        state.error = payload?.message ?? DRIVER_REQUESTS_COPY.loadFailed;
        state.errorCode = payload?.code ?? null;
        if (payload?.code && BLOCKING_FEED_CODES.has(payload.code)) {
          state.items = [];
        }
      })
      .addCase(acceptRideRequest.pending, (state, action) => {
        state.acceptingId = action.meta.arg;
      })
      .addCase(acceptRideRequest.fulfilled, (state) => {
        state.acceptingId = null;
        // The driver is on this ride now; no other request can be taken.
        state.items = [];
      })
      .addCase(acceptRideRequest.rejected, (state, action) => {
        if (action.meta.condition) {
          return;
        }
        state.acceptingId = null;
        // Every 409 means this driver cannot have this ride: take it off the list.
        if (action.payload?.status === 409) {
          hide(state, action.meta.arg);
        }
      });
  },
});

export const { dismissRideRequest, pruneExpiredRequests, clearPendingRequests } = driverRequestsSlice.actions;

export const selectDriverRequestsState = (state: SliceRoot): DriverRequestsState => state.driverRequests;

export const selectAcceptingRideId = (state: SliceRoot): number | null => state.driverRequests.acceptingId;

export default driverRequestsSlice.reducer;
