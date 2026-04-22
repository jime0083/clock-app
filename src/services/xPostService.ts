import { postTweet, uploadMedia } from './xAuthService';
import { getXTokens, isXTokenExpired, clearXTokens } from './secureTokenService';
import { refreshXToken } from './xAuthService';
import { saveXTokens } from './secureTokenService';
import { getUserDocument } from './userService';
import { auth } from './firebase';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import i18n from '@/locales';

interface PostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
  requiresReauth?: boolean;
}

// Token refresh buffer: refresh 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_SECONDS = 300;

// Penalty images for random selection
const PENALTY_IMAGES = [
  require('@assets/images/日本人男性.png'),
  require('@assets/images/日本人女性.png'),
  require('@assets/images/日本人女性2.png'),
  require('@assets/images/黒人男性.png'),
  require('@assets/images/黒人女性.png'),
  require('@assets/images/白人男性.png'),
  require('@assets/images/白人女性.png'),
];

/**
 * Restore tokens from Firestore to Secure Storage
 * Returns the access token if successful
 */
const restoreTokensFromFirestore = async (): Promise<string | null> => {
  console.log('[XPost] restoreTokensFromFirestore: Attempting to restore tokens from Firestore');

  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('[XPost] restoreTokensFromFirestore: No authenticated user');
      return null;
    }

    const userDoc = await getUserDocument(currentUser.uid);
    if (!userDoc?.snsConnections?.x) {
      console.log('[XPost] restoreTokensFromFirestore: No X connection in Firestore');
      return null;
    }

    const xConnection = userDoc.snsConnections.x;
    console.log('[XPost] restoreTokensFromFirestore: Firestore connection:', {
      connected: xConnection.connected,
      hasAccessToken: !!xConnection.accessToken,
      hasRefreshToken: !!xConnection.refreshToken,
      username: xConnection.username,
    });

    if (!xConnection.connected || !xConnection.accessToken) {
      console.log('[XPost] restoreTokensFromFirestore: No valid tokens in Firestore');
      return null;
    }

    // Save tokens to Secure Storage for future use
    console.log('[XPost] restoreTokensFromFirestore: Saving tokens to Secure Storage');
    await saveXTokens(
      xConnection.accessToken,
      xConnection.refreshToken || '',
      7200, // Default 2 hours expiry
      xConnection.username || ''
    );

    console.log('[XPost] restoreTokensFromFirestore: Tokens restored successfully');
    return xConnection.accessToken;
  } catch (error) {
    console.error('[XPost] restoreTokensFromFirestore: Error:', error);
    return null;
  }
};

/**
 * Get a valid access token, refreshing if necessary
 * Falls back to Firestore if Secure Storage is empty
 */
const getValidToken = async (): Promise<string | null> => {
  console.log('[XPost] getValidToken: Starting token validation');

  const tokenData = await getXTokens();
  console.log('[XPost] getValidToken: Token data retrieved:', {
    hasAccessToken: !!tokenData.accessToken,
    hasRefreshToken: !!tokenData.refreshToken,
    expiresAt: tokenData.expiresAt,
    username: tokenData.username,
  });

  // If no token in Secure Storage, try to restore from Firestore
  if (!tokenData.accessToken) {
    console.log('[XPost] getValidToken: No access token in Secure Storage, trying Firestore');
    const restoredToken = await restoreTokensFromFirestore();
    if (restoredToken) {
      console.log('[XPost] getValidToken: Token restored from Firestore');
      return restoredToken;
    }
    console.log('[XPost] getValidToken: No access token found in Secure Storage or Firestore');
    return null;
  }

  // Check if token needs refresh
  const needsRefresh = await isXTokenExpired(TOKEN_REFRESH_BUFFER_SECONDS);
  console.log('[XPost] getValidToken: Token expiry check:', {
    needsRefresh,
    bufferSeconds: TOKEN_REFRESH_BUFFER_SECONDS,
    currentTime: Date.now(),
    expiresAt: tokenData.expiresAt,
  });

  if (needsRefresh && tokenData.refreshToken) {
    console.log('[XPost] getValidToken: Attempting token refresh');
    const result = await refreshXToken(tokenData.refreshToken);
    console.log('[XPost] getValidToken: Refresh result:', {
      success: result.success,
      hasTokens: !!result.tokens,
      error: result.error,
    });

    if (!result.success || !result.tokens) {
      // Refresh failed, token is invalid
      console.log('[XPost] getValidToken: Refresh failed, clearing tokens');
      await clearXTokens();
      return null;
    }

    // Save new tokens
    console.log('[XPost] getValidToken: Saving refreshed tokens');
    await saveXTokens(
      result.tokens.access_token,
      result.tokens.refresh_token,
      result.tokens.expires_in,
      tokenData.username || ''
    );

    return result.tokens.access_token;
  }

  if (needsRefresh && !tokenData.refreshToken) {
    console.log('[XPost] getValidToken: Token expired but no refresh token available');
  }

  console.log('[XPost] getValidToken: Returning existing access token');
  return tokenData.accessToken;
};

/**
 * Get a random penalty image as base64
 */
const getRandomPenaltyImageBase64 = async (): Promise<string | null> => {
  try {
    // Select random image
    const randomIndex = Math.floor(Math.random() * PENALTY_IMAGES.length);
    const imageSource = PENALTY_IMAGES[randomIndex];

    // Load asset
    const asset = Asset.fromModule(imageSource);
    await asset.downloadAsync();

    if (!asset.localUri) {
      return null;
    }

    // Read as base64
    const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
      encoding: 'base64',
    });

    return base64;
  } catch (error) {
    console.error('Error loading penalty image:', error);
    return null;
  }
};

/**
 * Post a penalty tweet with image when user fails to wake up
 */
export const postPenaltyTweet = async (): Promise<PostResult> => {
  console.log('[XPost] postPenaltyTweet: Starting penalty tweet post');

  try {
    // Get valid access token
    console.log('[XPost] postPenaltyTweet: Getting valid access token');
    const accessToken = await getValidToken();

    if (!accessToken) {
      console.log('[XPost] postPenaltyTweet: No valid access token, returning error');
      return {
        success: false,
        error: 'No valid access token',
        requiresReauth: true,
      };
    }

    console.log('[XPost] postPenaltyTweet: Access token obtained successfully');

    // Get penalty text from translations
    const penaltyText = i18n.t('penalty.postText');
    console.log('[XPost] postPenaltyTweet: Penalty text:', penaltyText);

    // Get random penalty image
    console.log('[XPost] postPenaltyTweet: Loading penalty image...');
    const imageBase64 = await getRandomPenaltyImageBase64();
    console.log('[XPost] postPenaltyTweet: Image loaded:', imageBase64 ? `${imageBase64.length} chars` : 'null');

    let mediaId: string | undefined;

    // Upload image if available
    if (imageBase64) {
      console.log('[XPost] postPenaltyTweet: Uploading image to X...');
      const uploadResult = await uploadMedia(accessToken, imageBase64, 'image/png');
      console.log('[XPost] postPenaltyTweet: Image upload result:', {
        success: uploadResult.success,
        mediaId: uploadResult.mediaId,
        error: uploadResult.error,
      });
      if (uploadResult.success && uploadResult.mediaId) {
        mediaId = uploadResult.mediaId;
      } else {
        console.log('[XPost] postPenaltyTweet: Image upload failed, posting without image');
      }
    }

    // Post the tweet (with or without image)
    console.log('[XPost] postPenaltyTweet: Posting tweet...', { hasMediaId: !!mediaId });
    const result = await postTweet(accessToken, penaltyText, mediaId);
    console.log('[XPost] postPenaltyTweet: Tweet post result:', {
      success: result.success,
      tweetId: result.tweetId,
      error: result.error,
    });

    if (!result.success) {
      // Check if error indicates auth issue
      const isAuthError =
        result.error?.includes('401') ||
        result.error?.includes('403') ||
        result.error?.toLowerCase().includes('unauthorized');

      console.log('[XPost] postPenaltyTweet: Tweet post failed, isAuthError:', isAuthError);

      if (isAuthError) {
        await clearXTokens();
        return {
          success: false,
          error: result.error,
          requiresReauth: true,
        };
      }

      return {
        success: false,
        error: result.error,
      };
    }

    console.log('[XPost] postPenaltyTweet: Tweet posted successfully!');
    return {
      success: true,
      tweetId: result.tweetId,
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
 * Post a custom tweet
 */
export const postCustomTweet = async (text: string): Promise<PostResult> => {
  try {
    // Validate text length (X limit is 280 characters)
    if (text.length > 280) {
      return {
        success: false,
        error: 'Tweet exceeds 280 characters',
      };
    }

    if (text.trim().length === 0) {
      return {
        success: false,
        error: 'Tweet cannot be empty',
      };
    }

    // Get valid access token
    const accessToken = await getValidToken();

    if (!accessToken) {
      return {
        success: false,
        error: 'No valid access token',
        requiresReauth: true,
      };
    }

    // Post the tweet
    const result = await postTweet(accessToken, text);

    if (!result.success) {
      const isAuthError =
        result.error?.includes('401') ||
        result.error?.includes('403') ||
        result.error?.toLowerCase().includes('unauthorized');

      if (isAuthError) {
        await clearXTokens();
        return {
          success: false,
          error: result.error,
          requiresReauth: true,
        };
      }

      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      tweetId: result.tweetId,
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
 * Check if X posting is available (user is connected and has valid token)
 */
export const isXPostingAvailable = async (): Promise<boolean> => {
  try {
    const tokenData = await getXTokens();
    return tokenData.accessToken !== null;
  } catch {
    return false;
  }
};
