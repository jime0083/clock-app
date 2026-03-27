import { useState, useEffect } from 'react';
import {
  GoogleSignin,
  statusCodes,
  isSuccessResponse,
  isErrorWithCode,
} from '@react-native-google-signin/google-signin';
import { signInWithGoogle } from '@/services/authService';
import { AppUser } from '@/types/auth';

// Configure Google Sign-In
// Web Client ID is required for Firebase Auth integration
const WEB_CLIENT_ID = '385341847803-fvpfbb2o45nfldjbe7fn84pca0bgsaqr.apps.googleusercontent.com';

// Initialize Google Sign-In configuration
GoogleSignin.configure({
  webClientId: WEB_CLIENT_ID,
  iosClientId: '385341847803-kj8ofskj97uaer269k1kfq4tn88ngf8r.apps.googleusercontent.com',
  offlineAccess: false,
});

interface UseGoogleAuthReturn {
  signIn: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export const useGoogleAuth = (
  onSuccess: (user: AppUser) => void,
  onError?: (error: string) => void
): UseGoogleAuthReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if Google Play Services are available (iOS always returns true)
      await GoogleSignin.hasPlayServices();

      // Perform sign in
      const response = await GoogleSignin.signIn();

      if (isSuccessResponse(response)) {
        const { idToken } = response.data;

        if (idToken) {
          // Sign in to Firebase with the Google ID token
          const user = await signInWithGoogle(idToken);
          onSuccess(user);
        } else {
          throw new Error('No ID token received from Google');
        }
      } else {
        throw new Error('Google sign in was cancelled');
      }
    } catch (err) {
      let errorMessage = 'Google sign in failed';

      if (isErrorWithCode(err)) {
        switch (err.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            errorMessage = 'Sign in was cancelled';
            break;
          case statusCodes.IN_PROGRESS:
            errorMessage = 'Sign in is already in progress';
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            errorMessage = 'Google Play Services not available';
            break;
          default:
            errorMessage = err.message || 'Unknown error occurred';
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signIn,
    isLoading,
    error,
  };
};

// Export sign out function for use elsewhere
export const signOutFromGoogle = async (): Promise<void> => {
  try {
    await GoogleSignin.signOut();
  } catch (err) {
    console.error('Error signing out from Google:', err);
  }
};
