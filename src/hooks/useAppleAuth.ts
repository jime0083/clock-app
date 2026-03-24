import { useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { signInWithApple } from '@/services/authService';
import { AppUser } from '@/types/auth';

interface UseAppleAuthReturn {
  signIn: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  isAvailable: boolean;
}

export const useAppleAuth = (
  onSuccess: (user: AppUser) => void,
  onError?: (error: string) => void
): UseAppleAuthReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);

  // Check if Apple Sign In is available
  const checkAvailability = async () => {
    const available = await AppleAuthentication.isAvailableAsync();
    setIsAvailable(available);
  };

  // Initialize availability check
  checkAvailability();

  const signIn = async () => {
    if (!isAvailable) {
      const errorMessage = 'Apple Sign In is not available on this device';
      setError(errorMessage);
      onError?.(errorMessage);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Generate nonce for security
      const nonce = Math.random().toString(36).substring(2, 10);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (credential.identityToken) {
        const user = await signInWithApple(credential.identityToken, nonce);
        onSuccess(user);
      } else {
        throw new Error('No identity token received from Apple');
      }
    } catch (err) {
      if (err instanceof Error) {
        // User cancelled the sign in
        if (err.message.includes('canceled') || err.message.includes('cancelled')) {
          setError(null);
          return;
        }
        setError(err.message);
        onError?.(err.message);
      } else {
        const errorMessage = 'Apple sign in failed';
        setError(errorMessage);
        onError?.(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signIn,
    isLoading,
    error,
    isAvailable,
  };
};
