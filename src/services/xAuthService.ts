import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { Timestamp } from 'firebase/firestore';
import { SNSConnection } from '@/types/firestore';

WebBrowser.maybeCompleteAuthSession();

// X API Configuration
const X_AUTH_ENDPOINT = 'https://twitter.com/i/oauth2/authorize';
const X_TOKEN_ENDPOINT = 'https://api.twitter.com/2/oauth2/token';
const X_REVOKE_ENDPOINT = 'https://api.twitter.com/2/oauth2/revoke';
const X_USER_ENDPOINT = 'https://api.twitter.com/2/users/me';

const REDIRECT_URI = 'okiroya://oauth-callback';
const SCOPES = ['tweet.write', 'tweet.read', 'users.read', 'offline.access'];

interface XTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface XUserResponse {
  data: {
    id: string;
    name: string;
    username: string;
  };
}

interface XAuthResult {
  success: boolean;
  connection?: SNSConnection;
  error?: string;
}

/**
 * Generate a random code verifier for PKCE
 */
const generateCodeVerifier = async (): Promise<string> => {
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  return Array.from(randomBytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Generate code challenge from code verifier using SHA256
 */
const generateCodeChallenge = async (verifier: string): Promise<string> => {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  // Convert to URL-safe base64
  return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * Generate a random state parameter
 */
const generateState = async (): Promise<string> => {
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(randomBytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Get X API credentials from config
 */
const getXCredentials = (): { clientId: string; clientSecret: string } => {
  const xConfig = Constants.expoConfig?.extra?.x;

  if (!xConfig?.clientId || !xConfig?.clientSecret) {
    throw new Error('X API credentials are not configured');
  }

  return {
    clientId: xConfig.clientId,
    clientSecret: xConfig.clientSecret,
  };
};

/**
 * Start X OAuth 2.0 PKCE authentication flow
 */
export const startXAuth = async (): Promise<XAuthResult> => {
  try {
    const { clientId } = getXCredentials();
    const codeVerifier = await generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = await generateState();

    // Build authorization URL
    const authUrl = new URL(X_AUTH_ENDPOINT);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('scope', SCOPES.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    // Open browser for authentication
    const result = await WebBrowser.openAuthSessionAsync(
      authUrl.toString(),
      REDIRECT_URI
    );

    if (result.type !== 'success') {
      return {
        success: false,
        error: result.type === 'cancel' ? 'Authentication cancelled' : 'Authentication failed',
      };
    }

    // Parse callback URL
    const callbackUrl = new URL(result.url);
    const code = callbackUrl.searchParams.get('code');
    const returnedState = callbackUrl.searchParams.get('state');
    const error = callbackUrl.searchParams.get('error');

    if (error) {
      return {
        success: false,
        error: `X API error: ${error}`,
      };
    }

    if (!code) {
      return {
        success: false,
        error: 'No authorization code received',
      };
    }

    if (returnedState !== state) {
      return {
        success: false,
        error: 'State mismatch - possible CSRF attack',
      };
    }

    // Exchange code for tokens
    const tokenResult = await exchangeCodeForTokens(code, codeVerifier);

    if (!tokenResult.success || !tokenResult.tokens) {
      return {
        success: false,
        error: tokenResult.error || 'Failed to exchange code for tokens',
      };
    }

    // Get user info
    const userResult = await getXUserInfo(tokenResult.tokens.access_token);

    if (!userResult.success || !userResult.user) {
      return {
        success: false,
        error: userResult.error || 'Failed to get user info',
      };
    }

    const connection: SNSConnection = {
      connected: true,
      accessToken: tokenResult.tokens.access_token,
      refreshToken: tokenResult.tokens.refresh_token,
      connectedAt: Timestamp.now(),
      username: userResult.user.username,
    };

    return {
      success: true,
      connection,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Exchange authorization code for access and refresh tokens
 */
const exchangeCodeForTokens = async (
  code: string,
  codeVerifier: string
): Promise<{ success: boolean; tokens?: XTokenResponse; error?: string }> => {
  try {
    const { clientId } = getXCredentials();

    const params = new URLSearchParams();
    params.set('grant_type', 'authorization_code');
    params.set('code', code);
    params.set('redirect_uri', REDIRECT_URI);
    params.set('code_verifier', codeVerifier);
    params.set('client_id', clientId);

    const response = await fetch(X_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error_description || 'Token exchange failed',
      };
    }

    const tokens: XTokenResponse = await response.json();
    return { success: true, tokens };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
};

/**
 * Get authenticated user info from X API
 */
const getXUserInfo = async (
  accessToken: string
): Promise<{ success: boolean; user?: XUserResponse['data']; error?: string }> => {
  try {
    const response = await fetch(X_USER_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.detail || 'Failed to get user info',
      };
    }

    const data: XUserResponse = await response.json();
    return { success: true, user: data.data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
};

/**
 * Refresh access token using refresh token
 */
export const refreshXToken = async (
  refreshToken: string
): Promise<{ success: boolean; tokens?: XTokenResponse; error?: string }> => {
  try {
    const { clientId } = getXCredentials();

    const params = new URLSearchParams();
    params.set('grant_type', 'refresh_token');
    params.set('refresh_token', refreshToken);
    params.set('client_id', clientId);

    const response = await fetch(X_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error_description || 'Token refresh failed',
      };
    }

    const tokens: XTokenResponse = await response.json();
    return { success: true, tokens };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
};

/**
 * Revoke X access token (disconnect)
 */
export const revokeXToken = async (accessToken: string): Promise<boolean> => {
  try {
    const { clientId } = getXCredentials();

    const params = new URLSearchParams();
    params.set('token', accessToken);
    params.set('token_type_hint', 'access_token');
    params.set('client_id', clientId);

    const response = await fetch(X_REVOKE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Post a tweet using the X API
 */
export const postTweet = async (
  accessToken: string,
  text: string
): Promise<{ success: boolean; tweetId?: string; error?: string }> => {
  try {
    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.detail || 'Failed to post tweet',
      };
    }

    const data = await response.json();
    return {
      success: true,
      tweetId: data.data?.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
};
