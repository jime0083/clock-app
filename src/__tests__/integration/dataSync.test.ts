/**
 * Data Sync Integration Tests
 *
 * Tests the offline service including:
 * - Network state monitoring
 * - User data caching
 * - Pending operations queue
 * - Sync when coming back online
 */

// Mock AsyncStorage
const mockAsyncStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockAsyncStorage[key] || null)),
  setItem: jest.fn((key: string, value: string) => {
    mockAsyncStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockAsyncStorage[key];
    return Promise.resolve();
  }),
}));

// Mock NetInfo
let mockIsConnected = true;
const mockNetInfoListeners: ((state: { isConnected: boolean }) => void)[] = [];

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((callback: (state: { isConnected: boolean }) => void) => {
    mockNetInfoListeners.push(callback);
    return () => {
      const index = mockNetInfoListeners.indexOf(callback);
      if (index > -1) mockNetInfoListeners.splice(index, 1);
    };
  }),
  fetch: jest.fn(() => Promise.resolve({ isConnected: mockIsConnected })),
}));

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  orderBy: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000 })),
  },
  increment: jest.fn((n: number) => n),
}));

jest.mock('../../services/firebase', () => ({
  db: {},
}));

// Mock userService
const mockGetUserDocument = jest.fn();
const mockUpdateUserSettings = jest.fn();

jest.mock('../../services/userService', () => ({
  getUserDocument: (...args: unknown[]) => mockGetUserDocument(...args),
  updateUserSettings: (...args: unknown[]) => mockUpdateUserSettings(...args),
}));

// Mock historyService
const mockRecordWakeUpHistory = jest.fn();

jest.mock('../../services/historyService', () => ({
  recordWakeUpHistory: (...args: unknown[]) => mockRecordWakeUpHistory(...args),
  createWakeUpHistory: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initializeOfflineService,
  checkIsOnline,
  getIsOnline,
  cacheUserData,
  getCachedUserData,
  clearCachedUserData,
  getPendingOperations,
  clearPendingOperations,
  syncPendingOperations,
  getUserDataOfflineAware,
  updateUserSettingsOfflineAware,
  recordWakeUpHistoryOfflineAware,
  hasPendingOperations,
  addNetworkListener,
} from '../../services/offlineService';
import { UserDocument } from '../../types/firestore';

// Helper to simulate network state change
const simulateNetworkChange = (isConnected: boolean) => {
  mockIsConnected = isConnected;
  mockNetInfoListeners.forEach(listener => listener({ isConnected }));
};

// Helper to clear AsyncStorage mock
const clearAsyncStorageMock = () => {
  Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);
};

describe('Data Sync Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAsyncStorageMock();
    mockIsConnected = true;
    mockNetInfoListeners.length = 0;
  });

  describe('Network State Monitoring', () => {
    it('should initialize network monitoring', () => {
      const unsubscribe = initializeOfflineService();

      expect(typeof unsubscribe).toBe('function');
    });

    it('should report online status correctly', async () => {
      mockIsConnected = true;
      const isOnline = await checkIsOnline();

      expect(isOnline).toBe(true);
    });

    it('should report offline status correctly', async () => {
      mockIsConnected = false;
      const isOnline = await checkIsOnline();

      expect(isOnline).toBe(false);
    });

    it('should notify listeners on network state change', () => {
      const listener = jest.fn();
      initializeOfflineService();
      addNetworkListener(listener);

      simulateNetworkChange(false);

      expect(listener).toHaveBeenCalledWith(false);
    });
  });

  describe('User Data Caching', () => {
    const mockUserData: UserDocument = {
      profile: {
        createdAt: { seconds: Date.now() / 1000 } as any,
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
      },
      settings: {
        alarmTime: '07:00',
        alarmDays: [1, 2, 3, 4, 5],
        customAlarmSound: null,
        calibration: null,
        language: 'ja',
        setupCompleted: true,
      },
      snsConnections: {
        x: {
          connected: true,
          accessToken: 'token',
          refreshToken: 'refresh',
          connectedAt: null,
          username: 'testuser',
        },
      },
      stats: {
        totalFailures: 5,
        monthlyFailures: 2,
        currentMonth: '2024-01',
        totalSquats: 100,
        monthlySquats: 30,
      },
      subscription: {
        isActive: true,
        plan: 'monthly',
        expiresAt: null,
        purchasedAt: null,
      },
    };

    it('should cache user data', async () => {
      await cacheUserData('user-123', mockUserData);

      const cached = await getCachedUserData('user-123');

      expect(cached).toEqual(mockUserData);
    });

    it('should return null for different user', async () => {
      await cacheUserData('user-123', mockUserData);

      const cached = await getCachedUserData('different-user');

      expect(cached).toBeNull();
    });

    it('should clear cached data', async () => {
      await cacheUserData('user-123', mockUserData);
      await clearCachedUserData();

      const cached = await getCachedUserData('user-123');

      expect(cached).toBeNull();
    });
  });

  describe('Pending Operations Queue', () => {
    it('should start with empty pending operations', async () => {
      const pending = await getPendingOperations();

      expect(pending).toEqual([]);
    });

    it('should queue operations when offline', async () => {
      mockIsConnected = false;

      await updateUserSettingsOfflineAware('user-123', { language: 'en' });

      const pending = await getPendingOperations();

      expect(pending.length).toBe(1);
      expect(pending[0].type).toBe('UPDATE_SETTINGS');
      expect(pending[0].uid).toBe('user-123');
    });

    it('should check if there are pending operations', async () => {
      expect(await hasPendingOperations()).toBe(false);

      mockIsConnected = false;
      await updateUserSettingsOfflineAware('user-123', { language: 'en' });

      expect(await hasPendingOperations()).toBe(true);
    });

    it('should clear pending operations', async () => {
      mockIsConnected = false;
      await updateUserSettingsOfflineAware('user-123', { language: 'en' });

      await clearPendingOperations();

      expect(await hasPendingOperations()).toBe(false);
    });
  });

  describe('Offline-Aware Operations', () => {
    const mockUserData: UserDocument = {
      profile: {
        createdAt: { seconds: Date.now() / 1000 } as any,
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
      },
      settings: {
        alarmTime: '07:00',
        alarmDays: [1, 2, 3, 4, 5],
        customAlarmSound: null,
        calibration: null,
        language: 'ja',
        setupCompleted: true,
      },
      snsConnections: {
        x: {
          connected: false,
          accessToken: null,
          refreshToken: null,
          connectedAt: null,
          username: null,
        },
      },
      stats: {
        totalFailures: 0,
        monthlyFailures: 0,
        currentMonth: '2024-01',
        totalSquats: 0,
        monthlySquats: 0,
      },
      subscription: {
        isActive: false,
        plan: null,
        expiresAt: null,
        purchasedAt: null,
      },
    };

    describe('getUserDataOfflineAware', () => {
      it('should fetch from server when online', async () => {
        mockIsConnected = true;
        mockGetUserDocument.mockResolvedValue(mockUserData);

        const data = await getUserDataOfflineAware('user-123');

        expect(mockGetUserDocument).toHaveBeenCalledWith('user-123');
        expect(data).toEqual(mockUserData);
      });

      it('should return cached data when offline', async () => {
        // First, cache some data
        await cacheUserData('user-123', mockUserData);

        // Go offline
        mockIsConnected = false;

        const data = await getUserDataOfflineAware('user-123');

        expect(data).toEqual(mockUserData);
      });

      it('should fall back to cache when server fails', async () => {
        await cacheUserData('user-123', mockUserData);
        mockIsConnected = true;
        mockGetUserDocument.mockRejectedValue(new Error('Network error'));

        const data = await getUserDataOfflineAware('user-123');

        expect(data).toEqual(mockUserData);
      });
    });

    describe('updateUserSettingsOfflineAware', () => {
      it('should update directly when online', async () => {
        mockIsConnected = true;
        mockUpdateUserSettings.mockResolvedValue(undefined);
        mockGetUserDocument.mockResolvedValue(mockUserData);

        await updateUserSettingsOfflineAware('user-123', { language: 'en' });

        expect(mockUpdateUserSettings).toHaveBeenCalledWith('user-123', { language: 'en' });
      });

      it('should queue operation when offline', async () => {
        mockIsConnected = false;
        await cacheUserData('user-123', mockUserData);

        await updateUserSettingsOfflineAware('user-123', { language: 'en' });

        expect(mockUpdateUserSettings).not.toHaveBeenCalled();
        const pending = await getPendingOperations();
        expect(pending.length).toBe(1);
      });

      it('should update local cache when offline', async () => {
        mockIsConnected = false;
        await cacheUserData('user-123', mockUserData);

        await updateUserSettingsOfflineAware('user-123', { language: 'en' });

        const cached = await getCachedUserData('user-123');
        expect(cached?.settings.language).toBe('en');
      });
    });

    describe('recordWakeUpHistoryOfflineAware', () => {
      it('should record directly when online', async () => {
        mockIsConnected = true;
        mockRecordWakeUpHistory.mockResolvedValue('2024-01-15');

        await recordWakeUpHistoryOfflineAware('user-123', {
          success: true,
          squatCount: 10,
        });

        expect(mockRecordWakeUpHistory).toHaveBeenCalledWith('user-123', {
          success: true,
          squatCount: 10,
        });
      });

      it('should queue operation when offline', async () => {
        mockIsConnected = false;

        await recordWakeUpHistoryOfflineAware('user-123', {
          success: false,
          squatCount: 5,
        });

        expect(mockRecordWakeUpHistory).not.toHaveBeenCalled();
        const pending = await getPendingOperations();
        expect(pending.length).toBe(1);
        expect(pending[0].type).toBe('RECORD_HISTORY');
      });
    });
  });

  describe('Sync When Coming Online', () => {
    it('should sync pending operations when coming back online', async () => {
      // Go offline and queue operations
      mockIsConnected = false;
      await updateUserSettingsOfflineAware('user-123', { language: 'en' });
      await recordWakeUpHistoryOfflineAware('user-123', { success: true, squatCount: 10 });

      expect(await hasPendingOperations()).toBe(true);

      // Setup mocks for online operations
      mockUpdateUserSettings.mockResolvedValue(undefined);
      mockRecordWakeUpHistory.mockResolvedValue('2024-01-15');

      // Come back online and sync
      mockIsConnected = true;
      const result = await syncPendingOperations();

      expect(result.synced).toBe(2);
      expect(result.failed).toBe(0);
      expect(await hasPendingOperations()).toBe(false);
    });

    it('should report failed syncs', async () => {
      mockIsConnected = false;
      await updateUserSettingsOfflineAware('user-123', { language: 'en' });

      mockIsConnected = true;
      mockUpdateUserSettings.mockRejectedValue(new Error('Sync failed'));

      const result = await syncPendingOperations();

      expect(result.synced).toBe(0);
      expect(result.failed).toBe(1);
    });

    it('should not sync when still offline', async () => {
      mockIsConnected = false;
      await updateUserSettingsOfflineAware('user-123', { language: 'en' });

      const result = await syncPendingOperations();

      expect(result.synced).toBe(0);
      expect(result.failed).toBe(0);
      expect(await hasPendingOperations()).toBe(true);
    });
  });
});
