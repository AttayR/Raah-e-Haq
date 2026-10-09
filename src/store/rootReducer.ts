import { combineReducers, type Reducer, type UnknownAction } from '@reduxjs/toolkit';
import apiAuthReducer from './slices/apiAuthSlice';
import activeRideReducer from '../features/active-ride/slice';
import driverStatusReducer from '../features/driver-status/slice';
import { resetApp } from './actions';

const appReducer = combineReducers({
  apiAuth: apiAuthReducer,
  // The passenger's active ride (T-301); replaces the unused `trip` and `ride` slices.
  activeRide: activeRideReducer,
  // The driver's server-backed online state (T-401).
  driverStatus: driverStatusReducer,
});

/** `resetApp` (dispatched by logout) returns every slice to its initial state. */
export const rootReducer: Reducer<ReturnType<typeof appReducer>, UnknownAction> = (state, action) =>
  appReducer(resetApp.match(action) ? undefined : state, action);
