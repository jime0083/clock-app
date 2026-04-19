import { useState, useCallback, useEffect } from 'react';
import { startXAuth, revokeXToken, refreshXToken } from '@/services/xAuthService';
import { updateSNSConnection } from '@/services/userService';
import {
  saveXTokens,
  getXTokens,
  clearXTokens,
  isXTokenExpired,
  hasXTokens,
} from '@/services/secureTokenService';
import { useAuth } from '@/contexts/AuthContext';
import { SNSConnection, defaultSNSConnection } from '@/types/firestore';
import { Timestamp } from 'firebase/firestore';

interface UseXAuthReturn {
  isConnecting: boolean;
  isDisconnecting: boolean;
  isRefreshing: boolean;
  error: string | null;
  connectX: () => Promise<boolean>;
  disconnectX: (currentConnection: SNSConnection) => Promise<boolean>;
  refreshTokenIfNeeded: (currentConnection: SNSConnection) => Promise<SNSConnection | null>;
  getValidAccessToken: (currentConnection: SNSConnection) => Promise<string | null>;
  initializeFromSecureStorage: () => Promise<SNSConnection | null>;
}

// Token refresh buffer: refresh 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_SECONDS = 300;

export const useXAuth = (): UseXAuthReturn => {
  const { user } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Connect to X using OAuth 2.0 PKCE flow
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

      // Save tokens securely
      if (
        result.connection.accessToken &&
        result.connection.refreshToken &&
        result.connection.username
      ) {
        await saveXTokens(
          result.connection.accessToken,
          result.connection.refreshToken,
          7200, // X tokens typically expire in 2 hours
          result.connection.username
        );
      }

      // Save connection to Firestore (including tokens for server-side access)
      // Note: Firestore security rules ensure only the user can access their own tokens
      const firestoreConnection: SNSConnection = {
        connected: true,
        accessToken: result.connection.accessToken,
        refreshToken: result.connection.refreshToken,
        connectedAt: result.connection.connectedAt,
        username: result.connection.username,
      };

      await updateSNSConnection(user.uid, 'x', firestoreConnection);

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
        // Get access token from secure storage
        const tokenData = await getXTokens();

        if (tokenData.accessToken) {
          // Revoke token on X API
          await revokeXToken(tokenData.accessToken);
        }

        // Clear tokens from secure storage
        await clearXTokens();

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

  /**
   * Refresh token if it's expired or about to expire
   */
  const refreshTokenIfNeeded = useCallback(
    async (currentConnection: SNSConnection): Promise<SNSConnection | null> => {
      if (!user) {
        setError('User not authenticated');
        return null;
      }

      try {
        // Check if token needs refresh
        const needsRefresh = await isXTokenExpired(TOKEN_REFRESH_BUFFER_SECONDS);

        if (!needsRefresh) {
          return currentConnection;
        }

        setIsRefreshing(true);

        // Get refresh token from secure storage
        const tokenData = await getXTokens();

        if (!tokenData.refreshToken) {
          setError('No refresh token available');
          return null;
        }

        // Refresh the token
        const result = await refreshXToken(tokenData.refreshToken);

        if (!result.success || !result.tokens) {
          setError(result.error || 'Failed to refresh token');
          // Token refresh failed, clear tokens and mark as disconnected
          await clearXTokens();
          await updateSNSConnection(user.uid, 'x', defaultSNSConnection);
          return null;
        }

        // Save new tokens securely (local secure storage)
        await saveXTokens(
          result.tokens.access_token,
          result.tokens.refresh_token,
          result.tokens.expires_in,
          tokenData.username || ''
        );

        // Update connection with new tokens in Firestore (for server-side access)
        const updatedConnection: SNSConnection = {
          ...currentConnection,
          accessToken: result.tokens.access_token,
          refreshToken: result.tokens.refresh_token,
          connectedAt: Timestamp.now(),
        };

        await updateSNSConnection(user.uid, 'x', updatedConnection);

        return updatedConnection;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        return null;
      } finally {
        setIsRefreshing(false);
      }
    },
    [user]
  );

  /**
   * Get a valid access token, refreshing if necessary
   */
  const getValidAccessToken = useCallback(
    async (currentConnection: SNSConnection): Promise<string | null> => {
      if (!currentConnection.connected) {
        return null;
      }

      // Check if token needs refresh
      const needsRefresh = await isXTokenExpired(TOKEN_REFRESH_BUFFER_SECONDS);

      if (needsRefresh) {
        const refreshed = await refreshTokenIfNeeded(currentConnection);
        if (!refreshed) {
          return null;
        }
      }

      // Get access token from secure storage
      const tokenData = await getXTokens();
      return tokenData.accessToken;
    },
    [refreshTokenIfNeeded]
  );

  /**
   * Initialize connection state from secure storage
   * Call this on app startup to restore X connection
   */
  const initializeFromSecureStorage = useCallback(async (): Promise<SNSConnection | null> => {
    try {
      const hasTokensStored = await hasXTokens();

      if (!hasTokensStored) {
        return null;
      }

      const tokenData = await getXTokens();

      if (!tokenData.accessToken || !tokenData.username) {
        return null;
      }

      // Check if token is still valid
      const isExpired = await isXTokenExpired(TOKEN_REFRESH_BUFFER_SECONDS);

      if (isExpired && tokenData.refreshToken) {
        // Try to refresh the token
        const result = await refreshXToken(tokenData.refreshToken);

        if (!result.success || !result.tokens) {
          // Refresh failed, clear tokens
          await clearXTokens();
          return null;
        }

        // Save new tokens
        await saveXTokens(
          result.tokens.access_token,
          result.tokens.refresh_token,
          result.tokens.expires_in,
          tokenData.username
        );
      }

      return {
        connected: true,
        accessToken: null, // Don't expose in return
        refreshToken: null,
        connectedAt: Timestamp.now(),
        username: tokenData.username,
      };
    } catch (err) {
      console.error('Error initializing from secure storage:', err);
      return null;
    }
  }, []);

  return {
    isConnecting,
    isDisconnecting,
    isRefreshing,
    error,
    connectX,
    disconnectX,
    refreshTokenIfNeeded,
    getValidAccessToken,
    initializeFromSecureStorage,
  };
};
