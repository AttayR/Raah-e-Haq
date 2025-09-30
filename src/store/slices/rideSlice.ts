import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type RideMode = 'auto' | 'bidding';

export interface RideLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface RideSummary {
  rideId: string;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  pickup: RideLocation;
  destination: RideLocation;
  fare: number;
  distance: string;
  duration: string;
  vehicleType: string;
  driverId?: string;
  driverName?: string;
}

export interface RideBid {
  id: string;
  rideId: string;
  driverId: string;
  driverName?: string;
  price: number;
  createdAt: number;
}

export interface RideState {
  mode: RideMode;
  isRequesting: boolean;
  currentRequestId?: string;
  activeRide?: RideSummary;
  bids: RideBid[];
}

const initialState: RideState = {
  mode: 'auto',
  isRequesting: false,
  currentRequestId: undefined,
  activeRide: undefined,
  bids: [],
};

const rideSlice = createSlice({
  name: 'ride',
  initialState,
  reducers: {
    setMode: (state, action: PayloadAction<RideMode>) => {
      state.mode = action.payload;
    },
    setIsRequesting: (state, action: PayloadAction<boolean>) => {
      state.isRequesting = action.payload;
    },
    setCurrentRequestId: (state, action: PayloadAction<string | undefined>) => {
      state.currentRequestId = action.payload;
    },
    setActiveRide: (state, action: PayloadAction<RideSummary | undefined>) => {
      state.activeRide = action.payload;
    },
    setBids: (state, action: PayloadAction<RideBid[]>) => {
      state.bids = action.payload;
    },
    addBid: (state, action: PayloadAction<RideBid>) => {
      const existing = state.bids.find(b => b.id === action.payload.id);
      if (!existing) state.bids.unshift(action.payload);
    },
    clearRideState: () => initialState,
  },
});

export const {
  setMode,
  setIsRequesting,
  setCurrentRequestId,
  setActiveRide,
  setBids,
  addBid,
  clearRideState,
} = rideSlice.actions;

export default rideSlice.reducer;


