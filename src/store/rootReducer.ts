import { combineReducers, type Reducer, type UnknownAction } from '@reduxjs/toolkit';
import apiAuthReducer from './slices/apiAuthSlice';
import tripReducer from './slices/tripSlice';
import rideReducer from './slices/rideSlice';
import { resetApp } from './actions';

const appReducer = combineReducers({
  apiAuth: apiAuthReducer,
  trip: tripReducer,
  ride: rideReducer,
});

/** `resetApp` (dispatched by logout) returns every slice to its initial state. */
export const rootReducer: Reducer<ReturnType<typeof appReducer>, UnknownAction> = (state, action) =>
  appReducer(resetApp.match(action) ? undefined : state, action);
