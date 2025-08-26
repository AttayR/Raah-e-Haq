// src/app/providers/ReduxProvider.tsx
import React from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from '../../store'; // <- use RELATIVE path first
import Loading from '../../components/Loading';

export default function ReduxProvider({ children }: React.PropsWithChildren) {
  return (
    <Provider store={store}>
      <PersistGate loading={<Loading />} persistor={persistor}>
        {children}
      </PersistGate>
    </Provider>
  );
}
