import { createSlice, PayloadAction } from '@reduxjs/toolkit';


type Trip = { id: string; from?: string; to?: string; status: 'idle'|'searching'|'accepted'|'ongoing'|'completed' };


type TripState = { current?: Trip; history: Trip[] };
const initialState: TripState = { current: undefined, history: [] };


const tripSlice = createSlice({
name: 'trip',
initialState,
reducers: {
setCurrentTrip: (s, a: PayloadAction<Trip|undefined>) => { s.current = a.payload; },
pushHistory: (s, a: PayloadAction<Trip>) => { s.history.unshift(a.payload); },
resetTrips: () => initialState,
},
});


export const { setCurrentTrip, pushHistory, resetTrips } = tripSlice.actions;
export default tripSlice.reducer;