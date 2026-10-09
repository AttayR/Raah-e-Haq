import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RideResource } from '../../services/rideService';
import { acceptRideRequest } from '../driver-requests/slice';

/**
 * The ride the signed-in driver is on (T-404). Set from the POST /rides/{id}/assign-driver
 * answer; the driver ride card on the Map reads it. T-405 adds the pickup → start → complete
 * transitions and the restore on launch (GET /driver/status active_ride_id).
 *
 * Not persisted; `resetApp` (logout) clears it through the root reducer.
 */
export interface DriverRideState {
  ride: RideResource | null;
}

export const initialDriverRideState: DriverRideState = { ride: null };

type SliceRoot = { driverRide: DriverRideState };

const driverRideSlice = createSlice({
  name: 'driverRide',
  initialState: initialDriverRideState,
  reducers: {
    /** A newer server copy of the ride (start, refresh). */
    setDriverActiveRide(state, action: PayloadAction<RideResource>) {
      state.ride = action.payload;
    },
    clearDriverActiveRide(state) {
      state.ride = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(acceptRideRequest.fulfilled, (state, action) => {
      state.ride = action.payload;
    });
  },
});

export const { setDriverActiveRide, clearDriverActiveRide } = driverRideSlice.actions;

export const selectDriverActiveRide = (state: SliceRoot): RideResource | null => state.driverRide.ride;

export default driverRideSlice.reducer;
