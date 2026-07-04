import { useState, useCallback } from 'react';
import { startXAuth, revokeXToken } from '@/services/xAuthService';
import { updateSNSConnection } from '@/services/userService';
import { useAuth } from '@/contexts/AuthContext';
import { SNSConnection, defaultSNSConnection } from '@/types/firestore';

// NOTE: X tokens are stored in Firestore only (single source of truth).
// Token refresh is performed exclusively by the server (checkSquatCompletion)
// because X rotates refresh tokens on every use — refreshing from both the
// client and the server invalidates each other's tokens (Problem 21).
// The client only needs the connection state (connected / username) for UI.

interface UseXAuthReturn {
  isConnecting: boolean;
  isDisconnecting: boolean;
  error: string | null;
  connectX: () => Promise<boolean>;
  disconnectX: (currentConnection: SNSConnection) => Promise<boolean>;
}

export const useXAuth = (): UseXAuthReturn => {
  const { user } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Connect to X using OAuth 2.0 PKCE flow
   * Tokens are saved to Firestore so the server can post penalty tweets
   */
  const connectX = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setError('User not authenticated');
      return false;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const result = await startXAuth();

      if (!result.success || !result.connection) {
        setError(result.error || 'Failed to connect to X');
        return false;
      }

      // Save connection (including tokens) to Firestore.
      // Firestore security rules restrict access to the owner only.
      await updateSNSConnection(user.uid, 'x', result.connection);

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [user]);

  /**
   * Disconnect from X
   * Revokes the token on X (best effort) and clears the Firestore connection
   */
  const disconnectX = useCallback(
    async (currentConnection: SNSConnection): Promise<boolean> => {
      if (!user) {
        setError('User not authenticated');
        return false;
      }

      setIsDisconnecting(true);
      setError(null);

      try {
        // Revoke token on X API (best effort — the token may already be
        // rotated by a server-side refresh, in which case revocation fails
        // silently and the Firestore cleanup below still disconnects)
        if (currentConnection.accessToken) {
          await revokeXToken(currentConnection.accessToken);
        }

        // Clear connection in Firestore
        await updateSNSConnection(user.uid, 'x', defaultSNSConnection);

        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        return false;
      } finally {
        setIsDisconnecting(false);
      }
    },
    [user]
  );

  return {
    isConnecting,
    isDisconnecting,
    error,
    connectX,
    disconnectX,
  };
};
