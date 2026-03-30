import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, Auth } from 'firebase/auth';
// @ts-expect-error - getReactNativePersistence is exported in react-native bundle
import { getReactNativePersistence } from '@firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Get Firebase config from environment variables via app.config.ts
const firebaseConfig = Constants.expoConfig?.extra?.firebase;

if (!firebaseConfig || !firebaseConfig.apiKey) {
  throw new Error(
    'Firebase configuration is missing. Please ensure environment variables are set in .env file.'
  );
}

// Initialize Firebase (only if not already initialized)
let app: FirebaseApp;
let auth: Auth;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  // Initialize Auth with AsyncStorage persistence for React Native
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} else {
  app = getApps()[0];
  auth = getAuth(app);
}

// Initialize services
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

export { app, auth, db, storage };
