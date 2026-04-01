import { registerRootComponent } from 'expo';

import App from './App';

// Register notifee background event handler
// This must be called outside of React component lifecycle
import { setBackgroundEventHandler } from './src/services/notificationService';
setBackgroundEventHandler();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
