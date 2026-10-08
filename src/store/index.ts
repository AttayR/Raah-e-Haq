// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  stripOtpTransform,
  clearApiAuthTransientTransform,
  clearFirebaseAuthTransientTransform,
} from './persistTransforms';
import { rootReducer } from './rootReducer';
import type { SessionThunkExtra } from './thunks/sessionThunks';

export { rootReducer } from './rootReducer';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'apiAuth', 'user'],
  // Per-key transforms (redux-persist v6 calls them once per whitelisted slice key).
  transforms: [clearApiAuthTransientTransform, clearFirebaseAuthTransientTransform, stripOtpTransform],
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
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;