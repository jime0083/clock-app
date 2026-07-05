import {
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from './firebase';
import { AppUser } from '@/types/auth';
import { createUserDocument, migrateUserDocumentFields } from './userService';

// Check if user is admin
export const checkIsAdmin = async (uid: string): Promise<boolean> => {
  try {
    const adminUsersRef = collection(db, 'adminUsers');
    const q = query(adminUsersRef, where('uid', '==', uid));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// Convert Firebase User to App User
export const convertToAppUser = async (firebaseUser: User): Promise<AppUser> => {
  const isAdmin = await checkIsAdmin(firebaseUser.uid);
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    isAdmin,
  };
};

// Create or update user profile in Firestore
export const createOrUpdateUserProfile = async (user: AppUser): Promise<void> => {
  try {
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      // Create new user profile using the canonical document shape (Problem 28)
      await createUserDocument(user.uid, {
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      });
    } else {
      // Update existing profile
      await setDoc(
        userRef,
        {
          profile: {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          },
        },
        { merge: true }
      );
      // Backfill any fields missing from older document shapes (Problem 28)
      await migrateUserDocumentFields(user.uid, userDoc.data() as Record<string, unknown>);
    }
  } catch (error) {
    console.error('Error creating/updating user profile:', error);
    throw error;
  }
};

// Sign in with Google credential using Firebase JS SDK
export const signInWithGoogle = async (idToken: string): Promise<AppUser> => {
  // Create a Google credential with the token
  const googleCredential = GoogleAuthProvider.credential(idToken);

  // Sign-in the user with the credential
  const result = await signInWithCredential(auth, googleCredential);

  if (!result.user) {
    throw new Error('No user returned from Google sign in');
  }

  const appUser = await convertToAppUser(result.user);
  await createOrUpdateUserProfile(appUser);
  return appUser;
};

// Sign in with Apple credential using Firebase JS SDK
export const signInWithApple = async (identityToken: string, nonce: string): Promise<AppUser> => {
  // Create an Apple credential with the token
  const provider = new OAuthProvider('apple.com');
  const appleCredential = provider.credential({
    idToken: identityToken,
    rawNonce: nonce,
  });

  // Sign-in the user with the credential
  const result = await signInWithCredential(auth, appleCredential);

  if (!result.user) {
    throw new Error('No user returned from Apple sign in');
  }

  const appUser = await convertToAppUser(result.user);
  await createOrUpdateUserProfile(appUser);
  return appUser;
};

// Sign out
export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth);
};

// Subscribe to auth state changes
export const subscribeToAuthState = (callback: (user: User | null) => void): (() => void) => {
  return onAuthStateChanged(auth, callback);
};

// Delete user account and all associated data
export const deleteAccount = async (uid: string): Promise<void> => {
  try {
    // Delete all Firestore data (user document + subcollections + related
    // records in alarmHistory/penaltyPosts) via the deleteUserData Cloud
    // Function, which uses admin.firestore().recursiveDelete (Problem 29)
    const deleteUserData = httpsCallable(functions, 'deleteUserData');
    await deleteUserData();

    // Delete the Firebase Auth user. This can throw 'auth/requires-recent-login'
    // if the session is stale; the Firestore data above is already gone by then.
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid === uid) {
      await currentUser.delete();
    }
  } catch (error) {
    console.error('Error deleting account:', error);
    throw error;
  }
};

// Get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};
