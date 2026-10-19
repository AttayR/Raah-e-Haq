import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { toThunkRejection, type ThunkRejection } from '../../core/api/errors';
import { t } from '../../i18n';
import { currentSessionEpoch, isStaleSession } from '../../store/sessionEpoch';
import { isStaleSessionRejection, staleSessionRejection } from '../../store/thunks/apiThunks';
import { acceptRideRequest } from '../driver-requests/slice';
import { autoAcceptApi, type AutoAcceptSettings, type AutoAcceptUpdate } from './api';

/**
 * The driver's auto-accept settings (T-587, GET/PUT /driver/auto-accept) and the "Ride accepted
 * for you" takeover. Only ever holds what the server answered, except the switch, which shows
 * the new `enabled` while its PUT is in flight and flips back if it is refused (§7.1).
 * Not persisted; `resetApp` (logout) clears it.
 */
export type AutoAcceptLoad = 'idle' | 'loading' | 'done' | 'failed';

export interface AutoAcceptState {
  settings: AutoAcceptSettings | null;
  loadStatus: AutoAcceptLoad;
  /** A PUT is in flight. */
  saving: boolean;
  /** `enabled` before the PUT in flight, to flip back to when it is refused. */
  enabledBeforeSave: boolean | null;
  /** The ride the driver accepted themselves (never shown as auto-accepted). */
  ownAcceptedRideId: number | null;
  /** The auto-accepted ride whose takeover is on screen. */
  takeoverRideId: number | null;
}

export const initialAutoAcceptState: AutoAcceptState = {
  settings: null,
  loadStatus: 'idle',
  saving: false,
  enabledBeforeSave: null,
  ownAcceptedRideId: null,
  takeoverRideId: null,
};

/** Only the slice is typed here, so this file never imports the store. */
type SliceRoot = { driverAutoAccept: AutoAcceptState };
type ThunkConfig = { state: SliceRoot; rejectValue: ThunkRejection };

/** GET /driver/auto-accept. Skipped while a read or a save is running. */
export const loadAutoAccept = createAsyncThunk<AutoAcceptSettings, void, ThunkConfig>(
  'driverAutoAccept/load',
  async (_, { rejectWithValue }) => {
    const startedIn = currentSessionEpoch();
    try {
      const settings = await autoAcceptApi.get();
      return isStaleSession(startedIn) ? rejectWithValue(staleSessionRejection()) : settings;
    } catch (error) {
      return rejectWithValue(toThunkRejection(error, t('autoAccept.loadFailed')));
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState().driverAutoAccept;
      return state.loadStatus !== 'loading' && !state.saving;
    },
  },
);

/** PUT /driver/auto-accept. One at a time (a second tap while saving sends nothing). */
export const saveAutoAccept = createAsyncThunk<AutoAcceptSettings, AutoAcceptUpdate, ThunkConfig>(
  'driverAutoAccept/save',
  async (body, { rejectWithValue }) => {
    const startedIn = currentSessionEpoch();
    try {
      const settings = await autoAcceptApi.update(body);
      return isStaleSession(startedIn) ? rejectWithValue(staleSessionRejection()) : settings;
    } catch (error) {
      return rejectWithValue(toThunkRejection(error, t('autoAccept.saveFailed')));
    }
  },
  { condition: (_, { getState }) => !getState().driverAutoAccept.saving },
);

const autoAcceptSlice = createSlice({
  name: 'driverAutoAccept',
  initialState: initialAutoAcceptState,
  reducers: {
    showAutoAcceptedTakeover(state, action: PayloadAction<number>) {
      state.takeoverRideId = action.payload;
    },
    dismissAutoAcceptedTakeover(state) {
      state.takeoverRideId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadAutoAccept.pending, (state) => {
        state.loadStatus = 'loading';
      })
      .addCase(loadAutoAccept.fulfilled, (state, action) => {
        state.loadStatus = 'done';
        state.settings = action.payload;
      })
      .addCase(loadAutoAccept.rejected, (state, action) => {
        if (action.meta.condition) return;
        if (isStaleSessionRejection(action.payload)) {
          state.loadStatus = 'idle';
          return;
        }
        // Settings already shown stay; only a first read that failed shows the error row.
        state.loadStatus = state.settings ? 'done' : 'failed';
      })
      .addCase(saveAutoAccept.pending, (state, action) => {
        state.saving = true;
        if (state.settings) {
          state.enabledBeforeSave = state.settings.enabled;
          state.settings.enabled = action.meta.arg.enabled;
        }
      })
      .addCase(saveAutoAccept.fulfilled, (state, action) => {
        state.saving = false;
        state.enabledBeforeSave = null;
        state.settings = action.payload;
        state.loadStatus = 'done';
      })
      .addCase(saveAutoAccept.rejected, (state, action) => {
        if (action.meta.condition) return;
        state.saving = false;
        if (state.settings && state.enabledBeforeSave !== null) {
          state.settings.enabled = state.enabledBeforeSave;
        }
        state.enabledBeforeSave = null;
      })
      .addCase(acceptRideRequest.fulfilled, (state, action) => {
        state.ownAcceptedRideId = action.payload.id;
      });
  },
});

export const { showAutoAcceptedTakeover, dismissAutoAcceptedTakeover } = autoAcceptSlice.actions;

/** Tolerates a store without this slice (tests that build a partial root). */
type MaybeRoot = { driverAutoAccept?: AutoAcceptState };

export const selectAutoAcceptState = (state: MaybeRoot): AutoAcceptState =>
  state.driverAutoAccept ?? initialAutoAcceptState;

export const selectAutoAcceptSettings = (state: MaybeRoot): AutoAcceptSettings | null =>
  selectAutoAcceptState(state).settings;

/**
 * Auto-accept is on, the server allows it and it is not paused by a location check (the "Auto"
 * badge, the pickup circle, the online hint and the takeover).
 */
export const selectAutoAcceptActive = (state: MaybeRoot): boolean => {
  const settings = selectAutoAcceptSettings(state);
  return settings !== null && settings.enabled && settings.available && !settings.paused;
};

export const selectAutoAcceptTakeoverRideId = (state: MaybeRoot): number | null =>
  selectAutoAcceptState(state).takeoverRideId;

export default autoAcceptSlice.reducer;
