/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundPushHandler } from './src/features/notifications/background';

// FCM background handler before the app component (React Native Firebase requirement, T-502).
registerBackgroundPushHandler();

AppRegistry.registerComponent(appName, () => App);
