import { useState, useEffect } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { signInWithGoogle } from '@/services/authService';
import { AppUser } from '@/types/auth';

WebBrowser.maybeCompleteAuthSession();

// Google OAuth Client ID for iOS
// Note: This needs to be created in Google Cloud Console
const GOOGLE_IOS_CLIENT_ID = '385341847803-PLACEHOLDER.apps.googleusercontent.com';

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

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });

  useEffect(() => {
    const handleResponse = async () => {
      if (response?.type === 'success') {
        setIsLoading(true);
        setError(null);
        try {
          const { id_token } = response.params;
          const user = await signInWithGoogle(id_token);
          onSuccess(user);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Google sign in failed';
          setError(errorMessage);
          onError?.(errorMessage);
        } finally {
          setIsLoading(false);
        }
      } else if (response?.type === 'error') {
        const errorMessage = response.error?.message || 'Google sign in failed';
        setError(errorMessage);
        onError?.(errorMessage);
      }
    };

    handleResponse();
  }, [response]);

  const signIn = async () => {
    setError(null);
    await promptAsync();
  };

  return {
    signIn,
    isLoading: isLoading || !request,
    error,
  };
};
