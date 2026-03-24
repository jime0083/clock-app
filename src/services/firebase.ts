import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAvf1uARsUn0zNo3JTA7yTNwTbz7Y7woZo',
  authDomain: 'okiroya-9af3f.firebaseapp.com',
  projectId: 'okiroya-9af3f',
  storageBucket: 'okiroya-9af3f.firebasestorage.app',
  messagingSenderId: '385341847803',
  appId: '1:385341847803:ios:b07cd453b00fcf97b0585e',
};

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
