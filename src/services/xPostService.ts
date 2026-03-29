import { postTweet, uploadMedia } from './xAuthService';
import { getXTokens, isXTokenExpired, clearXTokens } from './secureTokenService';
import { refreshXToken } from './xAuthService';
import { saveXTokens } from './secureTokenService';
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
 * Get a valid access token, refreshing if necessary
 */
const getValidToken = async (): Promise<string | null> => {
  const tokenData = await getXTokens();

  if (!tokenData.accessToken) {
    return null;
  }

  // Check if token needs refresh
  const needsRefresh = await isXTokenExpired(TOKEN_REFRESH_BUFFER_SECONDS);

  if (needsRefresh && tokenData.refreshToken) {
    const result = await refreshXToken(tokenData.refreshToken);

    if (!result.success || !result.tokens) {
      // Refresh failed, token is invalid
      await clearXTokens();
      return null;
    }

    // Save new tokens
    await saveXTokens(
      result.tokens.access_token,
      result.tokens.refresh_token,
      result.tokens.expires_in,
      tokenData.username || ''
    );

    return result.tokens.access_token;
  }

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
  try {
    // Get valid access token
    const accessToken = await getValidToken();

    if (!accessToken) {
      return {
        success: false,
        error: 'No valid access token',
        requiresReauth: true,
      };
    }

    // Get penalty text from translations
    const penaltyText = i18n.t('penalty.postText');

    // Get random penalty image
    const imageBase64 = await getRandomPenaltyImageBase64();

    let mediaId: string | undefined;

    // Upload image if available
    if (imageBase64) {
      const uploadResult = await uploadMedia(accessToken, imageBase64, 'image/png');
      if (uploadResult.success && uploadResult.mediaId) {
        mediaId = uploadResult.mediaId;
      }
    }

    // Post the tweet with image
    const result = await postTweet(accessToken, penaltyText, mediaId);

    if (!result.success) {
      // Check if error indicates auth issue
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
