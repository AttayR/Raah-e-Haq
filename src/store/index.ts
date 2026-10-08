// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  stripApiAuthSecretsTransform,
  stripOtpTransform,
  clearApiAuthTransientTransform,
  clearFirebaseAuthTransientTransform,
} from './persistTransforms';
import { rootReducer } from './rootReducer';
import { sessionExpired, type SessionThunkExtra } from './thunks/sessionThunks';
import { setUnauthorizedHandler } from '../services/api';

export { rootReducer } from './rootReducer';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'apiAuth', 'user'],
  // Per-key transforms (redux-persist v6 calls them once per whitelisted slice key).
  transforms: [
    clearApiAuthTransientTransform,
    clearFirebaseAuthTransientTransform,
    stripOtpTransform,
    stripApiAuthSecretsTransform,
  ],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

// The logout thunk purges redux-persist through this, so thunks never import the store.
const thunkExtra: SessionThunkExtra = {
  purgePersistedState: () => persistor.purge(),
};

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefault) =>
    getDefault({ serializableCheck: false, thunk: { extraArgument: thunkExtra } }),
});

export const persistor = persistStore(store);

// A 401 on a request that carried the current session's token ends the session (T-104,
// BE-25: no refresh after a 401).
setUnauthorizedHandler(() => store.dispatch(sessionExpired()));
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;