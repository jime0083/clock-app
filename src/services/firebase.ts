import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
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
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Initialize services
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

export { app, auth, db, storage };
