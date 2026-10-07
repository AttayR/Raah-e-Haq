/* eslint-env jest */
/**
 * Global Jest setup: native module mocks so components and logic can run in Node.
 * Tests must never reach the network (production backend), see the axios guard at the end.
 */

// Reanimated / worklets. Reanimated uses its official mock. react-native-worklets is left
// real on purpose: it detects Jest and switches to its JS implementation (JSWorklets), and
// Reanimated's mock needs that real module (serializableMappingCache, createSerializable).
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// AsyncStorage (official mock)
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Safe area (official mock)
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

// React Native Firebase
jest.mock('@react-native-firebase/app', () => {
  const app = {name: '[DEFAULT]', options: {}};
  return {
    __esModule: true,
    default: () => app,
    getApp: jest.fn(() => app),
    initializeApp: jest.fn(() => Promise.resolve(app)),
    firebase: {app: () => app, apps: [app]},
  };
});

jest.mock('@react-native-firebase/auth', () => {
  const authInstance = {
    currentUser: null,
    onAuthStateChanged: jest.fn(() => jest.fn()),
    signInWithPhoneNumber: jest.fn(() => Promise.resolve({confirm: jest.fn()})),
    signInWithCredential: jest.fn(() => Promise.resolve({user: null})),
    signInWithEmailAndPassword: jest.fn(() => Promise.resolve({user: null})),
    createUserWithEmailAndPassword: jest.fn(() => Promise.resolve({user: null})),
    signOut: jest.fn(() => Promise.resolve()),
  };
  const auth = Object.assign(jest.fn(() => authInstance), {
    GoogleAuthProvider: {credential: jest.fn(() => ({}))},
    PhoneAuthProvider: {credential: jest.fn(() => ({}))},
  });
  return {
    __esModule: true,
    default: auth,
    getAuth: jest.fn(() => authInstance),
    onAuthStateChanged: jest.fn(() => jest.fn()),
    signOut: jest.fn(() => Promise.resolve()),
  };
});

jest.mock('@react-native-firebase/firestore', () => {
  const docRef = {
    get: jest.fn(() => Promise.resolve({exists: false, data: () => undefined})),
    set: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve()),
    delete: jest.fn(() => Promise.resolve()),
    onSnapshot: jest.fn(() => jest.fn()),
  };
  const query = {
    doc: jest.fn(() => docRef),
    add: jest.fn(() => Promise.resolve(docRef)),
    where: jest.fn(() => query),
    orderBy: jest.fn(() => query),
    limit: jest.fn(() => query),
    get: jest.fn(() => Promise.resolve({docs: [], empty: true, forEach: jest.fn()})),
    onSnapshot: jest.fn(() => jest.fn()),
  };
  docRef.collection = jest.fn(() => query);
  const db = {collection: jest.fn(() => query), doc: jest.fn(() => docRef)};
  const firestore = Object.assign(jest.fn(() => db), {
    FieldValue: {
      serverTimestamp: jest.fn(() => new Date()),
      arrayUnion: jest.fn(),
      arrayRemove: jest.fn(),
      increment: jest.fn(),
    },
    Timestamp: {now: jest.fn(() => ({toDate: () => new Date()})), fromDate: jest.fn()},
  });
  return {
    __esModule: true,
    default: firestore,
    getFirestore: jest.fn(() => db),
    collection: jest.fn(() => query),
    doc: jest.fn(() => docRef),
    getDoc: jest.fn(() => docRef.get()),
    getDocs: jest.fn(() => query.get()),
    setDoc: jest.fn(() => Promise.resolve()),
    addDoc: jest.fn(() => Promise.resolve(docRef)),
    updateDoc: jest.fn(() => Promise.resolve()),
    deleteDoc: jest.fn(() => Promise.resolve()),
    onSnapshot: jest.fn(() => jest.fn()),
    query: jest.fn(() => query),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    serverTimestamp: jest.fn(() => new Date()),
  };
});

jest.mock('@react-native-firebase/messaging', () => {
  const messagingInstance = {
    requestPermission: jest.fn(() => Promise.resolve(1)),
    hasPermission: jest.fn(() => Promise.resolve(1)),
    getToken: jest.fn(() => Promise.resolve('test-fcm-token')),
    deleteToken: jest.fn(() => Promise.resolve()),
    onMessage: jest.fn(() => jest.fn()),
    onTokenRefresh: jest.fn(() => jest.fn()),
    onNotificationOpenedApp: jest.fn(() => jest.fn()),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
    setBackgroundMessageHandler: jest.fn(),
    registerDeviceForRemoteMessages: jest.fn(() => Promise.resolve()),
    subscribeToTopic: jest.fn(() => Promise.resolve()),
    unsubscribeFromTopic: jest.fn(() => Promise.resolve()),
  };
  const messaging = Object.assign(jest.fn(() => messagingInstance), {
    AuthorizationStatus: {NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2},
  });
  return {
    __esModule: true,
    default: messaging,
    getMessaging: jest.fn(() => messagingInstance),
    AuthorizationStatus: messaging.AuthorizationStatus,
  };
});

jest.mock('@react-native-firebase/storage', () => {
  const ref = {
    putFile: jest.fn(() => Promise.resolve()),
    put: jest.fn(() => Promise.resolve()),
    getDownloadURL: jest.fn(() => Promise.resolve('https://example.test/file')),
    delete: jest.fn(() => Promise.resolve()),
  };
  const storageInstance = {ref: jest.fn(() => ref)};
  return {
    __esModule: true,
    default: jest.fn(() => storageInstance),
    getStorage: jest.fn(() => storageInstance),
    ref: jest.fn(() => ref),
  };
});

// Google sign-in
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({data: null})),
    signOut: jest.fn(() => Promise.resolve()),
    revokeAccess: jest.fn(() => Promise.resolve()),
    getCurrentUser: jest.fn(() => null),
    getTokens: jest.fn(() => Promise.resolve({idToken: '', accessToken: ''})),
  },
  GoogleSigninButton: 'GoogleSigninButton',
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
  isSuccessResponse: jest.fn(() => false),
  isErrorWithCode: jest.fn(() => false),
}));

// Maps
jest.mock('react-native-maps', () => {
  const React = require('react');
  const {View} = require('react-native');
  const MockMapView = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      animateToRegion: jest.fn(),
      animateCamera: jest.fn(),
      fitToCoordinates: jest.fn(),
      fitToSuppliedMarkers: jest.fn(),
    }));
    return React.createElement(View, props, props.children);
  });
  const passthrough = name => {
    const C = props => React.createElement(View, props, props.children);
    C.displayName = name;
    return C;
  };
  return {
    __esModule: true,
    default: MockMapView,
    Marker: passthrough('Marker'),
    Polyline: passthrough('Polyline'),
    Polygon: passthrough('Polygon'),
    Circle: passthrough('Circle'),
    Callout: passthrough('Callout'),
    PROVIDER_GOOGLE: 'google',
    PROVIDER_DEFAULT: null,
  };
});

// Geolocation
jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    getCurrentPosition: jest.fn(),
    watchPosition: jest.fn(() => 1),
    clearWatch: jest.fn(),
    stopObserving: jest.fn(),
    requestAuthorization: jest.fn(),
    setRNConfiguration: jest.fn(),
  },
}));

// NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(() => Promise.resolve({isConnected: true, isInternetReachable: true})),
  },
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({isConnected: true, isInternetReachable: true})),
  useNetInfo: jest.fn(() => ({isConnected: true, isInternetReachable: true})),
}));

// Vector icons: every icon set renders a plain host component.
const iconSets = [
  'AntDesign',
  'Entypo',
  'EvilIcons',
  'Feather',
  'FontAwesome',
  'FontAwesome5',
  'FontAwesome6',
  'Fontisto',
  'Foundation',
  'Ionicons',
  'MaterialCommunityIcons',
  'MaterialIcons',
  'Octicons',
  'SimpleLineIcons',
  'Zocial',
];
iconSets.forEach(set => {
  jest.mock(`react-native-vector-icons/${set}`, () => {
    const React = require('react');
    const {Text} = require('react-native');
    const Icon = ({name, ...rest}) => React.createElement(Text, rest, name);
    Icon.getImageSource = jest.fn(() => Promise.resolve({uri: ''}));
    Icon.loadFont = jest.fn(() => Promise.resolve());
    return {__esModule: true, default: Icon};
  });
});

// Keyboard controller (pulled in by react-native-gifted-chat), official mock
jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);

// Image picker
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(() => Promise.resolve({didCancel: true})),
  launchImageLibrary: jest.fn(() => Promise.resolve({didCancel: true})),
}));

// Linear gradient
jest.mock('react-native-linear-gradient', () => {
  const React = require('react');
  const {View} = require('react-native');
  const LinearGradient = props => React.createElement(View, props, props.children);
  return {__esModule: true, default: LinearGradient};
});

// Toast
jest.mock('react-native-toast-message', () => {
  const Toast = () => null;
  Toast.show = jest.fn();
  Toast.hide = jest.fn();
  return {__esModule: true, default: Toast, BaseToast: () => null, ErrorToast: () => null};
});

// Gesture handler: its official jestSetup is loaded via `setupFiles` in jest.config.js.

// react-native-config: fixed test values. Hosts use the reserved .test TLD so nothing can resolve.
jest.mock('react-native-config', () => {
  const config = {
    API_URL: 'https://api.raah.test/api',
    WS_URL: 'wss://api.raah.test/ws',
    MAPS_KEY: 'test-maps-key',
  };
  return {__esModule: true, default: config, Config: config};
});

// Never let a test reach a real server (the backend is production).
const axios = require('axios');
axios.defaults.adapter = config =>
  Promise.reject(
    new Error(`Network access is disabled in tests: ${config.method} ${config.url}`),
  );
global.fetch = jest.fn(url =>
  Promise.reject(new Error(`Network access is disabled in tests: fetch ${url}`)),
);

// WebSocket: constructing one throws, so no test can open a socket to a real server.
// A plain class (not jest.fn) so resetting mocks cannot turn the guard off.
// Tests that need a socket can jest.spyOn(global, 'WebSocket') with a fake.
global.WebSocket = class DisabledWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  constructor(url) {
    throw new Error(`Network access is disabled in tests: WebSocket ${url}`);
  }
};
