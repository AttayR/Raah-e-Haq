// src/store/index.ts
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, createTransform } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

import authReducer from './slices/authSlice';
import apiAuthReducer from './slices/apiAuthSlice';
import userReducer from './slices/userSlice';
import tripReducer from './slices/tripSlice';
import rideReducer from './slices/rideSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  apiAuth: apiAuthReducer,
  user: userReducer,
  trip: tripReducer,
  ride: rideReducer,
});

// When rehydrating, never restore auth/apiAuth error (or failed/loading status).
// This prevents "stale" login errors from persisting after the user kills the app mid-login.
const clearAuthErrorsTransform = createTransform(
  (inboundState: any, key) => {
    if (key === 'root' && inboundState) {
      return {
        ...inboundState,
        ...(inboundState.auth != null && {
          auth: {
            ...inboundState.auth,
            error: null,
            status: inboundState.auth.status === 'loading' ? 'idle' : inboundState.auth.status,
          },
        }),
        ...(inboundState.apiAuth != null && {
          apiAuth: {
            ...inboundState.apiAuth,
            error: null,
            status: ['loading', 'failed'].includes(inboundState.apiAuth.status)
              ? 'idle'
              : inboundState.apiAuth.status,
          },
        }),
      };
    }
    return inboundState;
  },
  (outboundState: any) => outboundState,
  { whitelist: ['root'] }
);

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'apiAuth', 'user'],
  transforms: [clearAuthErrorsTransform],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefault) => getDefault({ serializableCheck: false }), // no manual thunk
});

export const persistor = persistStore(store);
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;