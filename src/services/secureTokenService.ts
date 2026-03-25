import * as SecureStore from 'expo-secure-store';

// Storage keys
const TOKEN_KEYS = {
  X_ACCESS_TOKEN: 'x_access_token',
  X_REFRESH_TOKEN: 'x_refresh_token',
  X_TOKEN_EXPIRY: 'x_token_expiry',
  X_USERNAME: 'x_username',
} as const;

interface XTokenData {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  username: string | null;
}

/**
 * Save X access token securely
 */
export const saveXAccessToken = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEYS.X_ACCESS_TOKEN, token);
  } catch (error) {
    console.error('Error saving X access token:', error);
    throw error;
  }
};

/**
 * Get X access token from secure storage
 */
export const getXAccessToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEYS.X_ACCESS_TOKEN);
  } catch (error) {
    console.error('Error getting X access token:', error);
    return null;
  }
};

/**
 * Save X refresh token securely
 */
export const saveXRefreshToken = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEYS.X_REFRESH_TOKEN, token);
  } catch (error) {
    console.error('Error saving X refresh token:', error);
    throw error;
  }
};

/**
 * Get X refresh token from secure storage
 */
export const getXRefreshToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEYS.X_REFRESH_TOKEN);
  } catch (error) {
    console.error('Error getting X refresh token:', error);
    return null;
  }
};

/**
 * Save X token expiry time
 */
export const saveXTokenExpiry = async (expiresIn: number): Promise<void> => {
  try {
    // Calculate absolute expiry time (current time + expires_in seconds)
    const expiresAt = Date.now() + expiresIn * 1000;
    await SecureStore.setItemAsync(TOKEN_KEYS.X_TOKEN_EXPIRY, expiresAt.toString());
  } catch (error) {
    console.error('Error saving X token expiry:', error);
    throw error;
  }
};

/**
 * Get X token expiry time
 */
export const getXTokenExpiry = async (): Promise<number | null> => {
  try {
    const expiry = await SecureStore.getItemAsync(TOKEN_KEYS.X_TOKEN_EXPIRY);
    return expiry ? parseInt(expiry, 10) : null;
  } catch (error) {
    console.error('Error getting X token expiry:', error);
    return null;
  }
};

/**
 * Save X username
 */
export const saveXUsername = async (username: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEYS.X_USERNAME, username);
  } catch (error) {
    console.error('Error saving X username:', error);
    throw error;
  }
};

/**
 * Get X username
 */
export const getXUsername = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEYS.X_USERNAME);
  } catch (error) {
    console.error('Error getting X username:', error);
    return null;
  }
};

/**
 * Save all X token data securely
 */
export const saveXTokens = async (
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  username: string
): Promise<void> => {
  try {
    await Promise.all([
      saveXAccessToken(accessToken),
      saveXRefreshToken(refreshToken),
      saveXTokenExpiry(expiresIn),
      saveXUsername(username),
    ]);
  } catch (error) {
    console.error('Error saving X tokens:', error);
    throw error;
  }
};

/**
 * Get all X token data from secure storage
 */
export const getXTokens = async (): Promise<XTokenData> => {
  try {
    const [accessToken, refreshToken, expiresAt, username] = await Promise.all([
      getXAccessToken(),
      getXRefreshToken(),
      getXTokenExpiry(),
      getXUsername(),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresAt,
      username,
    };
  } catch (error) {
    console.error('Error getting X tokens:', error);
    return {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      username: null,
    };
  }
};

/**
 * Clear all X tokens from secure storage
 */
export const clearXTokens = async (): Promise<void> => {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEYS.X_ACCESS_TOKEN),
      SecureStore.deleteItemAsync(TOKEN_KEYS.X_REFRESH_TOKEN),
      SecureStore.deleteItemAsync(TOKEN_KEYS.X_TOKEN_EXPIRY),
      SecureStore.deleteItemAsync(TOKEN_KEYS.X_USERNAME),
    ]);
  } catch (error) {
    console.error('Error clearing X tokens:', error);
    throw error;
  }
};

/**
 * Check if X access token is expired or about to expire
 * Returns true if token will expire within the buffer time (default 5 minutes)
 */
export const isXTokenExpired = async (bufferSeconds: number = 300): Promise<boolean> => {
  try {
    const expiresAt = await getXTokenExpiry();

    if (!expiresAt) {
      return true; // No expiry set, consider expired
    }

    const bufferMs = bufferSeconds * 1000;
    return Date.now() >= expiresAt - bufferMs;
  } catch (error) {
    console.error('Error checking X token expiry:', error);
    return true; // Error occurred, consider expired for safety
  }
};

/**
 * Check if X tokens exist in secure storage
 */
export const hasXTokens = async (): Promise<boolean> => {
  try {
    const accessToken = await getXAccessToken();
    return accessToken !== null;
  } catch (error) {
    console.error('Error checking X tokens:', error);
    return false;
  }
};
