// src/app/providers/ReduxProvider.tsx
import React from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor, useAppDispatch, useAppSelector } from '../../store'; // <- use RELATIVE path first
import SplashScreen from '../../components/SplashScreen';
import AuthProvider from './AuthProvider';

export default function ReduxProvider({ children }: React.PropsWithChildren) {
  return (
    <Provider store={store}>
      <PersistGate loading={<SplashScreen />} persistor={persistor}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </PersistGate>
    </Provider>
  );
}

// Export the typed hooks
export { useAppDispatch, useAppSelector };
