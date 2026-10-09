import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { toThunkRejection, type ThunkRejection } from '../../core/api/errors';
import { currentSessionEpoch, isStaleSession } from '../../store/sessionEpoch';
import { staleSessionRejection } from '../../store/thunks/apiThunks';
import {
  driverStatusApi,
  type DriverAvailability,
  type DriverStatusInfo,
  type DriverStatusTarget,
} from './api';
import { DRIVER_STATUS_COPY } from './copy';

/**
 * The signed-in driver's online/offline state (T-401, DRV-01/DRV-13): the one source of
 * truth for driver Home and Map. It only ever holds what the server answered
 * (GET/PUT /driver/status, BE-06); the toggle is never optimistic.
 *
 * Not persisted: it is read from the server when the driver area mounts (after sign-in or
 * a restored session), on driver Home mount and when the app returns to the foreground.
 * `resetApp` (logout) returns it to the initial state through the root reducer.
 */
export type DriverStatusLoad = 'idle' | 'loading' | 'done' | 'failed';

export interface DriverStatusState {
  /** null until the server has answered once. */
  status: DriverAvailability | null;
  activeRideId: number | null;
  changedAt: string | null;
  loadStatus: DriverStatusLoad;
  /** PUT /driver/status in flight. */
  isUpdating: boolean;
  /** Display-safe message of the last failed load or toggle. */
  error: string | null;
}

export const initialDriverStatusState: DriverStatusState = {
  status: null,
  activeRideId: null,
  changedAt: null,
  loadStatus: 'idle',
  isUpdating: false,
  error: null,
};

/** Only the slice is typed here, so this file never imports the store. */
type SliceRoot = { driverStatus: DriverStatusState };
type ThunkConfig = { state: SliceRoot; rejectValue: ThunkRejection };

/** No load and no toggle overlap, so an older answer can never overwrite a newer one. */
const isIdle = (state: SliceRoot): boolean =>
  state.driverStatus.loadStatus !== 'loading' && !state.driverStatus.isUpdating;

/** GET /driver/status. Skipped while a load or a toggle is running. */
export const loadDriverStatus = createAsyncThunk<DriverStatusInfo, void, ThunkConfig>(
  'driverStatus/load',
  async (_, { rejectWithValue }) => {
    const startedIn = currentSessionEpoch();
    try {
      const info = await driverStatusApi.get();
      return isStaleSession(startedIn) ? rejectWithValue(staleSessionRejection()) : info;
    } catch (error) {
      return rejectWithValue(toThunkRejection(error, DRIVER_STATUS_COPY.loadFailed));
    }
  },
  { condition: (_, { getState }) => isIdle(getState()) },
);

/** PUT /driver/status {status}. The state changes only from the server's answer. */
export const setDriverStatus = createAsyncThunk<DriverStatusInfo, DriverStatusTarget, ThunkConfig>(
  'driverStatus/set',
  async (target, { rejectWithValue }) => {
    const startedIn = currentSessionEpoch();
    try {
      const info = await driverStatusApi.set(target);
      return isStaleSession(startedIn) ? rejectWithValue(staleSessionRejection()) : info;
    } catch (error) {
      return rejectWithValue(toThunkRejection(error, DRIVER_STATUS_COPY.updateFailed));
    }
  },
  { condition: (_, { getState }) => isIdle(getState()) },
);

const apply = (state: DriverStatusState, info: DriverStatusInfo): void => {
  state.status = info.status;
  state.activeRideId = info.activeRideId;
  state.changedAt = info.changedAt;
  state.error = null;
};

const driverStatusSlice = createSlice({
  name: 'driverStatus',
  initialState: initialDriverStatusState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadDriverStatus.pending, (state) => {
        state.loadStatus = 'loading';
      })
      .addCase(loadDriverStatus.fulfilled, (state, action: PayloadAction<DriverStatusInfo>) => {
        state.loadStatus = 'done';
        apply(state, action.payload);
      })
      .addCase(loadDriverStatus.rejected, (state, action) => {
        state.loadStatus = 'failed';
        // The last confirmed status stays; the screen says it could not refresh.
        state.error = action.payload?.message ?? DRIVER_STATUS_COPY.loadFailed;
      })
      .addCase(setDriverStatus.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(setDriverStatus.fulfilled, (state, action: PayloadAction<DriverStatusInfo>) => {
        state.isUpdating = false;
        state.loadStatus = 'done';
        apply(state, action.payload);
      })
      .addCase(setDriverStatus.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload?.message ?? DRIVER_STATUS_COPY.updateFailed;
      });
  },
});

export const selectDriverStatusState = (state: SliceRoot): DriverStatusState => state.driverStatus;

/** `available` and `on_ride` both count as online (BE-06 is_online). */
export const selectDriverIsOnline = (state: SliceRoot): boolean =>
  state.driverStatus.status === 'available' || state.driverStatus.status === 'on_ride';

export const selectDriverIsOnRide = (state: SliceRoot): boolean =>
  state.driverStatus.status === 'on_ride';

/** True while the status is being read or changed: the toggle waits. */
export const selectDriverStatusBusy = (state: SliceRoot): boolean => !isIdle(state);

export default driverStatusSlice.reducer;
