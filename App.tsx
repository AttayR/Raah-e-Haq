import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import ReduxProvider from './src/app/providers/ReduxProvider';
import RootNavigator from './src/app/navigation/RootNavigation';

export default function App() {
  return (
    <ReduxProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </ReduxProvider>
  );
}
