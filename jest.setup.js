// Mock react-native-reanimated FIRST (before other imports)
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock expo winter runtime
jest.mock('expo/src/winter/runtime.native', () => ({}), { virtual: true });
jest.mock('expo/src/winter/installGlobal', () => ({}), { virtual: true });

// Mock expo modules
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'ja' }],
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      x: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      },
    },
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

// Silence console.error and console.warn in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
  SafeAreaProvider: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }) => children,
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(() => Promise.resolve({ sound: { playAsync: jest.fn(), stopAsync: jest.fn(), unloadAsync: jest.fn() } })),
    },
    setAudioModeAsync: jest.fn(),
  },
}));

// Mock expo-sensors
jest.mock('expo-sensors', () => ({
  Accelerometer: {
    isAvailableAsync: jest.fn(() => Promise.resolve(true)),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));
