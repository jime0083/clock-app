import 'dotenv/config';
import { ConfigContext } from 'expo/config';

interface ExtendedExpoConfig {
  name: string;
  slug: string;
  version: string;
  orientation: 'portrait' | 'landscape' | 'default';
  icon: string;
  userInterfaceStyle: 'light' | 'dark' | 'automatic';
  newArchEnabled?: boolean;
  splash: {
    image: string;
    resizeMode: 'contain' | 'cover' | 'native';
    backgroundColor: string;
  };
  ios: {
    supportsTablet: boolean;
    bundleIdentifier: string;
    googleServicesFile: string;
  };
  android: {
    adaptiveIcon: {
      backgroundColor: string;
      foregroundImage: string;
    };
    package: string;
  };
  web: {
    favicon: string;
  };
  plugins: string[];
  extra: {
    eas: {
      projectId: string;
    };
    firebase: {
      apiKey: string | undefined;
      authDomain: string | undefined;
      projectId: string | undefined;
      storageBucket: string | undefined;
      messagingSenderId: string | undefined;
      appId: string | undefined;
    };
  };
}

export default ({ config }: ConfigContext): ExtendedExpoConfig => ({
  ...config,
  name: 'オキロヤ',
  slug: 'okiroya',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/okiroya-icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/images/okiroya-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.okiroya.app',
    googleServicesFile: './GoogleService-Info.plist',
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#ffffff',
      foregroundImage: './assets/images/okiroya-icon.png',
    },
    package: 'com.okiroya.app',
  },
  web: {
    favicon: './assets/images/okiroya-icon.png',
  },
  plugins: ['expo-localization', 'expo-web-browser'],
  extra: {
    eas: {
      projectId: '',
    },
    firebase: {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
    },
  },
});
