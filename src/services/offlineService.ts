import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { UserDocument, WakeUpHistory } from '@/types/firestore';
import { getUserDocument, updateUserSettings } from './userService';
import { recordWakeUpHistory, createWakeUpHistory } from './historyService';

// Storage keys
const CACHED_USER_DATA_KEY = 'offline_cached_user_data';
const PENDING_OPERATIONS_KEY = 'offline_pending_operations';
const LAST_SYNC_KEY = 'offline_last_sync';

// Operation types
type OperationType = 'UPDATE_SETTINGS' | 'RECORD_HISTORY';

interface PendingOperation {
  id: string;
  type: OperationType;
  uid: string;
  data: Record<string, unknown>;
  createdAt: number;
}

interface CachedUserData {
  uid: string;
  data: UserDocument;
  cachedAt: number;
}

// Network state
let isOnline = true;
let networkListeners: ((isOnline: boolean) => void)[] = [];

/**
 * Initialize network monitoring
 */
export const initializeOfflineService = (): (() => void) => {
  const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    const wasOffline = !isOnline;
    isOnline = state.isConnected ?? false;

    // Notify listeners
    networkListeners.forEach(listener => listener(isOnline));

    // If we just came back online, sync pending operations
    if (wasOffline && isOnline) {
      syncPendingOperations();
    }
  });

  return unsubscribe;
};

/**
 * Add network state listener
 */
export const addNetworkListener = (listener: (isOnline: boolean) => void): (() => void) => {
  networkListeners.push(listener);
  return () => {
    networkListeners = networkListeners.filter(l => l !== listener);
  };
};

/**
 * Check if device is online
 */
export const checkIsOnline = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  isOnline = state.isConnected ?? false;
  return isOnline;
};

/**
 * Get current online status (synchronous)
 */
export const getIsOnline = (): boolean => isOnline;

// ===== User Data Caching =====

/**
 * Cache user data locally
 */
export const cacheUserData = async (uid: string, data: UserDocument): Promise<void> => {
  try {
    const cached: CachedUserData = {
      uid,
      data,
      cachedAt: Date.now(),
    };
    await AsyncStorage.setItem(CACHED_USER_DATA_KEY, JSON.stringify(cached));
  } catch (error) {
    console.error('Error caching user data:', error);
  }
};

/**
 * Get cached user data
 */
export const getCachedUserData = async (uid: string): Promise<UserDocument | null> => {
  try {
    const cached = await AsyncStorage.getItem(CACHED_USER_DATA_KEY);
    if (!cached) return null;

    const parsed: CachedUserData = JSON.parse(cached);
    if (parsed.uid !== uid) return null;

    return parsed.data;
  } catch (error) {
    console.error('Error getting cached user data:', error);
    return null;
  }
};

/**
 * Clear cached user data
 */
export const clearCachedUserData = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CACHED_USER_DATA_KEY);
  } catch (error) {
    console.error('Error clearing cached user data:', error);
  }
};

// ===== Pending Operations =====

/**
 * Add pending operation
 */
const addPendingOperation = async (operation: Omit<PendingOperation, 'id' | 'createdAt'>): Promise<void> => {
  try {
    const pending = await getPendingOperations();
    const newOp: PendingOperation = {
      ...operation,
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
    };
    pending.push(newOp);
    await AsyncStorage.setItem(PENDING_OPERATIONS_KEY, JSON.stringify(pending));
  } catch (error) {
    console.error('Error adding pending operation:', error);
  }
};

/**
 * Get all pending operations
 */
export const getPendingOperations = async (): Promise<PendingOperation[]> => {
  try {
    const data = await AsyncStorage.getItem(PENDING_OPERATIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting pending operations:', error);
    return [];
  }
};

/**
 * Remove pending operation
 */
const removePendingOperation = async (operationId: string): Promise<void> => {
  try {
    const pending = await getPendingOperations();
    const filtered = pending.filter(op => op.id !== operationId);
    await AsyncStorage.setItem(PENDING_OPERATIONS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing pending operation:', error);
  }
};

/**
 * Clear all pending operations
 */
export const clearPendingOperations = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PENDING_OPERATIONS_KEY);
  } catch (error) {
    console.error('Error clearing pending operations:', error);
  }
};

// ===== Sync Operations =====

/**
 * Sync all pending operations
 */
export const syncPendingOperations = async (): Promise<{ synced: number; failed: number }> => {
  const online = await checkIsOnline();
  if (!online) {
    return { synced: 0, failed: 0 };
  }

  const pending = await getPendingOperations();
  let synced = 0;
  let failed = 0;

  for (const operation of pending) {
    try {
      await executeOperation(operation);
      await removePendingOperation(operation.id);
      synced++;
    } catch (error) {
      console.error('Error syncing operation:', operation.id, error);
      failed++;
    }
  }

  if (synced > 0) {
    await updateLastSync();
  }

  return { synced, failed };
};

/**
 * Execute a single pending operation
 */
const executeOperation = async (operation: PendingOperation): Promise<void> => {
  switch (operation.type) {
    case 'UPDATE_SETTINGS':
      await updateUserSettings(
        operation.uid,
        operation.data as Parameters<typeof updateUserSettings>[1]
      );
      break;

    case 'RECORD_HISTORY':
      await recordWakeUpHistory(
        operation.uid,
        operation.data as { success: boolean; squatCount: number }
      );
      break;

    default:
      console.warn('Unknown operation type:', operation.type);
  }
};

/**
 * Update last sync timestamp
 */
const updateLastSync = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error updating last sync:', error);
  }
};

/**
 * Get last sync timestamp
 */
export const getLastSync = async (): Promise<number | null> => {
  try {
    const data = await AsyncStorage.getItem(LAST_SYNC_KEY);
    return data ? parseInt(data, 10) : null;
  } catch (error) {
    console.error('Error getting last sync:', error);
    return null;
  }
};

// ===== Offline-Aware Operations =====

/**
 * Get user data with offline support
 */
export const getUserDataOfflineAware = async (uid: string): Promise<UserDocument | null> => {
  const online = await checkIsOnline();

  if (online) {
    try {
      const data = await getUserDocument(uid);
      if (data) {
        await cacheUserData(uid, data);
      }
      return data;
    } catch (error) {
      console.error('Error fetching user data online:', error);
      // Fall back to cache
      return getCachedUserData(uid);
    }
  }

  // Offline - return cached data
  return getCachedUserData(uid);
};

/**
 * Update user settings with offline support
 */
export const updateUserSettingsOfflineAware = async (
  uid: string,
  settings: Parameters<typeof updateUserSettings>[1]
): Promise<void> => {
  const online = await checkIsOnline();

  if (online) {
    await updateUserSettings(uid, settings);
    // Update cache
    const updated = await getUserDocument(uid);
    if (updated) {
      await cacheUserData(uid, updated);
    }
  } else {
    // Queue for later sync
    await addPendingOperation({
      type: 'UPDATE_SETTINGS',
      uid,
      data: settings as Record<string, unknown>,
    });

    // Update local cache
    const cached = await getCachedUserData(uid);
    if (cached) {
      const updatedCache = {
        ...cached,
        settings: { ...cached.settings, ...settings },
      };
      await cacheUserData(uid, updatedCache as UserDocument);
    }
  }
};

/**
 * Record wake-up history with offline support
 */
export const recordWakeUpHistoryOfflineAware = async (
  uid: string,
  data: { success: boolean; squatCount: number }
): Promise<void> => {
  const online = await checkIsOnline();

  if (online) {
    await recordWakeUpHistory(uid, data);
  } else {
    // Queue for later sync
    await addPendingOperation({
      type: 'RECORD_HISTORY',
      uid,
      data: data as Record<string, unknown>,
    });
  }
};

/**
 * Check if there are pending operations
 */
export const hasPendingOperations = async (): Promise<boolean> => {
  const pending = await getPendingOperations();
  return pending.length > 0;
};
