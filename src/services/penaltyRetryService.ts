import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { postPenaltyTweet } from './xPostService';

const PENDING_POSTS_KEY = 'penalty_pending_posts';
const BACKGROUND_TASK_NAME = 'PENALTY_RETRY_TASK';
const RETRY_INTERVAL_MINUTES = 30;

interface PendingPost {
  id: string;
  createdAt: number;
  retryCount: number;
  lastRetryAt?: number;
}

interface PostHistory {
  id: string;
  createdAt: number;
  success: boolean;
  tweetId?: string;
  error?: string;
  postedAt?: number;
}

const POST_HISTORY_KEY = 'penalty_post_history';
const MAX_HISTORY_ITEMS = 100;

/**
 * Add a failed post to the retry queue
 */
export const addPendingPost = async (): Promise<void> => {
  try {
    const pending = await getPendingPosts();
    const newPost: PendingPost = {
      id: `post_${Date.now()}`,
      createdAt: Date.now(),
      retryCount: 0,
    };
    pending.push(newPost);
    await AsyncStorage.setItem(PENDING_POSTS_KEY, JSON.stringify(pending));
  } catch (error) {
    console.error('Error adding pending post:', error);
  }
};

/**
 * Get all pending posts
 */
export const getPendingPosts = async (): Promise<PendingPost[]> => {
  try {
    const data = await AsyncStorage.getItem(PENDING_POSTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting pending posts:', error);
    return [];
  }
};

/**
 * Remove a post from the retry queue
 */
export const removePendingPost = async (postId: string): Promise<void> => {
  try {
    const pending = await getPendingPosts();
    const filtered = pending.filter(p => p.id !== postId);
    await AsyncStorage.setItem(PENDING_POSTS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing pending post:', error);
  }
};

/**
 * Update a pending post's retry info
 */
const updatePendingPost = async (postId: string, updates: Partial<PendingPost>): Promise<void> => {
  try {
    const pending = await getPendingPosts();
    const index = pending.findIndex(p => p.id === postId);
    if (index !== -1) {
      pending[index] = { ...pending[index], ...updates };
      await AsyncStorage.setItem(PENDING_POSTS_KEY, JSON.stringify(pending));
    }
  } catch (error) {
    console.error('Error updating pending post:', error);
  }
};

/**
 * Process all pending posts (retry failed posts)
 */
export const processPendingPosts = async (): Promise<{ processed: number; succeeded: number }> => {
  const pending = await getPendingPosts();
  let processed = 0;
  let succeeded = 0;

  for (const post of pending) {
    processed++;

    try {
      const result = await postPenaltyTweet();

      if (result.success) {
        // Remove from pending queue
        await removePendingPost(post.id);
        // Record success in history
        await recordPostHistory({
          id: post.id,
          createdAt: post.createdAt,
          success: true,
          tweetId: result.tweetId,
          postedAt: Date.now(),
        });
        succeeded++;
      } else {
        // Update retry info
        await updatePendingPost(post.id, {
          retryCount: post.retryCount + 1,
          lastRetryAt: Date.now(),
        });
        // Record failure in history
        await recordPostHistory({
          id: `${post.id}_retry_${post.retryCount}`,
          createdAt: post.createdAt,
          success: false,
          error: result.error,
          postedAt: Date.now(),
        });
      }
    } catch (error) {
      // Update retry info on error
      await updatePendingPost(post.id, {
        retryCount: post.retryCount + 1,
        lastRetryAt: Date.now(),
      });
    }
  }

  return { processed, succeeded };
};

/**
 * Record post history
 */
export const recordPostHistory = async (history: PostHistory): Promise<void> => {
  try {
    const histories = await getPostHistory();
    histories.unshift(history);
    // Keep only the last MAX_HISTORY_ITEMS
    const trimmed = histories.slice(0, MAX_HISTORY_ITEMS);
    await AsyncStorage.setItem(POST_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Error recording post history:', error);
  }
};

/**
 * Get post history
 */
export const getPostHistory = async (): Promise<PostHistory[]> => {
  try {
    const data = await AsyncStorage.getItem(POST_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting post history:', error);
    return [];
  }
};

/**
 * Clear all post history
 */
export const clearPostHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(POST_HISTORY_KEY);
  } catch (error) {
    console.error('Error clearing post history:', error);
  }
};

/**
 * Check if there are pending posts
 */
export const hasPendingPosts = async (): Promise<boolean> => {
  const pending = await getPendingPosts();
  return pending.length > 0;
};

// Define the background task
TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
  try {
    const hasPending = await hasPendingPosts();
    if (!hasPending) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const { succeeded } = await processPendingPosts();
    return succeeded > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.Failed;
  } catch (error) {
    console.error('Background task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Register background task for retry
 */
export const registerBackgroundRetryTask = async (): Promise<void> => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
    if (isRegistered) {
      return;
    }

    await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK_NAME, {
      minimumInterval: RETRY_INTERVAL_MINUTES * 60, // 30 minutes in seconds
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (error) {
    console.error('Error registering background task:', error);
  }
};

/**
 * Unregister background task
 */
export const unregisterBackgroundRetryTask = async (): Promise<void> => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_TASK_NAME);
    }
  } catch (error) {
    console.error('Error unregistering background task:', error);
  }
};

/**
 * Post penalty tweet with retry support
 * If posting fails, adds to retry queue
 */
export const postPenaltyWithRetry = async (): Promise<{ success: boolean; tweetId?: string; error?: string }> => {
  try {
    const result = await postPenaltyTweet();

    if (result.success) {
      // Record success
      await recordPostHistory({
        id: `post_${Date.now()}`,
        createdAt: Date.now(),
        success: true,
        tweetId: result.tweetId,
        postedAt: Date.now(),
      });
      return result;
    }

    // Post failed, add to retry queue
    await addPendingPost();
    // Record initial failure
    await recordPostHistory({
      id: `post_${Date.now()}`,
      createdAt: Date.now(),
      success: false,
      error: result.error,
      postedAt: Date.now(),
    });

    // Ensure background task is registered
    await registerBackgroundRetryTask();

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Add to retry queue on error
    await addPendingPost();
    await recordPostHistory({
      id: `post_${Date.now()}`,
      createdAt: Date.now(),
      success: false,
      error: errorMessage,
      postedAt: Date.now(),
    });

    // Ensure background task is registered
    await registerBackgroundRetryTask();

    return { success: false, error: errorMessage };
  }
};
