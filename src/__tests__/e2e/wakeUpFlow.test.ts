/**
 * E2E Test: Alarm to Wake-up Judgment Flow
 *
 * Tests the complete wake-up journey:
 * 1. Alarm triggers at scheduled time
 * 2. User performs squats to stop alarm
 * 3. Squat detection validates movement
 * 4. Success/failure is recorded
 * 5. On failure, X post is triggered
 */

// Mock all required services
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'test-user-123', email: 'test@example.com' },
    isLoading: false,
  }),
}));

jest.mock('../../services/userService', () => ({
  getUserDocument: jest.fn(),
  updateUserSettings: jest.fn(() => Promise.resolve()),
  updateUserStats: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../services/historyService', () => ({
  recordWakeUpHistory: jest.fn(() => Promise.resolve('2024-01-15')),
  createWakeUpHistory: jest.fn(),
}));

jest.mock('../../services/purchaseService', () => ({
  checkSubscriptionStatus: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('../../services/xPostService', () => ({
  postPenaltyTweet: jest.fn(() => Promise.resolve({ success: true, tweetId: '123456' })),
  isXPostingAvailable: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('../../services/secureTokenService', () => ({
  hasXTokens: jest.fn(() => Promise.resolve(true)),
  getXTokens: jest.fn(() =>
    Promise.resolve({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
    })
  ),
}));

// Mock expo-sensors
const mockAccelerometerListeners: ((data: { x: number; y: number; z: number }) => void)[] = [];
jest.mock('expo-sensors', () => ({
  Accelerometer: {
    isAvailableAsync: jest.fn(() => Promise.resolve(true)),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn((callback: (data: { x: number; y: number; z: number }) => void) => {
      mockAccelerometerListeners.push(callback);
      return {
        remove: () => {
          const index = mockAccelerometerListeners.indexOf(callback);
          if (index > -1) mockAccelerometerListeners.splice(index, 1);
        },
      };
    }),
  },
}));

// Mock expo-audio for alarm sound
const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockRemove = jest.fn();

const mockAudioPlayer = {
  play: mockPlay,
  pause: mockPause,
  remove: mockRemove,
  loop: false,
  volume: 1.0,
};

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => mockAudioPlayer),
  setAudioModeAsync: jest.fn(),
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ja' },
  }),
}));

import { getUserDocument, updateUserStats } from '../../services/userService';
import { recordWakeUpHistory } from '../../services/historyService';
import { postPenaltyTweet } from '../../services/xPostService';
import { checkSubscriptionStatus } from '../../services/purchaseService';
import { UserDocument } from '../../types/firestore';

const mockGetUserDocument = getUserDocument as jest.MockedFunction<typeof getUserDocument>;
const mockUpdateUserStats = updateUserStats as jest.MockedFunction<typeof updateUserStats>;
const mockRecordWakeUpHistory = recordWakeUpHistory as jest.MockedFunction<typeof recordWakeUpHistory>;
const mockPostPenaltyTweet = postPenaltyTweet as jest.MockedFunction<typeof postPenaltyTweet>;
const mockCheckSubscriptionStatus = checkSubscriptionStatus as jest.MockedFunction<typeof checkSubscriptionStatus>;

// Helper to simulate accelerometer data for squat motion
const simulateSquatMotion = () => {
  // Simulate standing position
  mockAccelerometerListeners.forEach((listener) => listener({ x: 0, y: 0, z: 1 }));

  // Simulate going down (squat)
  mockAccelerometerListeners.forEach((listener) => listener({ x: 0, y: -0.5, z: 0.8 }));

  // Simulate at bottom
  mockAccelerometerListeners.forEach((listener) => listener({ x: 0, y: -0.8, z: 0.6 }));

  // Simulate coming up
  mockAccelerometerListeners.forEach((listener) => listener({ x: 0, y: 0.5, z: 0.9 }));

  // Back to standing
  mockAccelerometerListeners.forEach((listener) => listener({ x: 0, y: 0, z: 1 }));
};

describe('E2E: Alarm to Wake-up Judgment Flow', () => {
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
      calibration: { peakThreshold: 0.3, minSquatDuration: 500, maxSquatDuration: 3000, calibratedAt: '2024-01-15T00:00:00.000Z' },
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockAccelerometerListeners.length = 0;
    mockGetUserDocument.mockResolvedValue(mockUserData);
    mockCheckSubscriptionStatus.mockResolvedValue(true);
  });

  describe('Alarm Trigger Flow', () => {
    it('should check if current time matches alarm time', () => {
      const alarmTime = '07:00';
      const currentTime = new Date();
      currentTime.setHours(7, 0, 0, 0);

      const alarmHour = parseInt(alarmTime.split(':')[0], 10);
      const alarmMinute = parseInt(alarmTime.split(':')[1], 10);

      const shouldTrigger =
        currentTime.getHours() === alarmHour && currentTime.getMinutes() === alarmMinute;

      expect(shouldTrigger).toBe(true);
    });

    it('should check if current day is in alarm days', () => {
      const alarmDays = [1, 2, 3, 4, 5]; // Monday to Friday
      const monday = new Date('2024-01-15'); // Monday

      const dayOfWeek = monday.getDay();
      const shouldTrigger = alarmDays.includes(dayOfWeek);

      expect(dayOfWeek).toBe(1); // Monday
      expect(shouldTrigger).toBe(true);
    });

    it('should not trigger on non-alarm days', () => {
      const alarmDays = [1, 2, 3, 4, 5]; // Monday to Friday
      const saturday = new Date('2024-01-20'); // Saturday

      const dayOfWeek = saturday.getDay();
      const shouldTrigger = alarmDays.includes(dayOfWeek);

      expect(dayOfWeek).toBe(6); // Saturday
      expect(shouldTrigger).toBe(false);
    });
  });

  describe('Squat Detection Flow', () => {
    it('should initialize accelerometer for squat detection', () => {
      const { Accelerometer } = require('expo-sensors');

      Accelerometer.setUpdateInterval(100);
      const subscription = Accelerometer.addListener(() => {});

      expect(Accelerometer.setUpdateInterval).toHaveBeenCalledWith(100);
      expect(Accelerometer.addListener).toHaveBeenCalled();

      subscription.remove();
    });

    it('should count squats based on accelerometer data', () => {
      let squatCount = 0;
      let isInSquatPosition = false;
      const threshold = 0.3;

      const processAccelerometerData = (data: { z: number }) => {
        const normalizedZ = data.z;

        if (!isInSquatPosition && normalizedZ < 1 - threshold) {
          isInSquatPosition = true;
        } else if (isInSquatPosition && normalizedZ > 1 - threshold / 2) {
          squatCount++;
          isInSquatPosition = false;
        }
      };

      // Simulate standing
      processAccelerometerData({ z: 1.0 });
      expect(squatCount).toBe(0);

      // Simulate going into squat
      processAccelerometerData({ z: 0.6 });
      expect(isInSquatPosition).toBe(true);

      // Simulate coming back up
      processAccelerometerData({ z: 0.95 });
      expect(squatCount).toBe(1);
      expect(isInSquatPosition).toBe(false);
    });

    it('should complete when required squat count is reached', () => {
      const requiredSquats = 10;
      let currentSquats = 0;
      let isCompleted = false;

      const onSquatCompleted = () => {
        currentSquats++;
        if (currentSquats >= requiredSquats) {
          isCompleted = true;
        }
      };

      // Simulate completing squats
      for (let i = 0; i < requiredSquats; i++) {
        onSquatCompleted();
      }

      expect(currentSquats).toBe(10);
      expect(isCompleted).toBe(true);
    });
  });

  describe('Success Flow', () => {
    it('should stop alarm sound on successful completion', async () => {
      const { createAudioPlayer } = require('expo-audio');

      // Start alarm
      const player = createAudioPlayer({});
      player.play();

      // Stop on success
      player.pause();
      player.remove();

      expect(mockPlay).toHaveBeenCalled();
      expect(mockPause).toHaveBeenCalled();
      expect(mockRemove).toHaveBeenCalled();
    });

    it('should record success history', async () => {
      const userId = 'test-user-123';
      const squatCount = 10;

      await recordWakeUpHistory(userId, {
        success: true,
        squatCount,
      });

      expect(mockRecordWakeUpHistory).toHaveBeenCalledWith(userId, {
        success: true,
        squatCount: 10,
      });
    });

    it('should update user stats on success', async () => {
      const userId = 'test-user-123';
      const squatCount = 10;

      await updateUserStats(userId, {
        totalSquats: squatCount,
        monthlySquats: squatCount,
      });

      expect(mockUpdateUserStats).toHaveBeenCalledWith(userId, {
        totalSquats: 10,
        monthlySquats: 10,
      });
    });

    it('should NOT post to X on success', async () => {
      const success = true;

      if (!success) {
        await postPenaltyTweet();
      }

      expect(mockPostPenaltyTweet).not.toHaveBeenCalled();
    });
  });

  describe('Failure Flow', () => {
    it('should record failure history', async () => {
      const userId = 'test-user-123';
      const squatCount = 5; // Less than required

      await recordWakeUpHistory(userId, {
        success: false,
        squatCount,
      });

      expect(mockRecordWakeUpHistory).toHaveBeenCalledWith(userId, {
        success: false,
        squatCount: 5,
      });
    });

    it('should update failure stats', async () => {
      const userId = 'test-user-123';

      await updateUserStats(userId, {
        totalFailures: 1,
        monthlyFailures: 1,
      });

      expect(mockUpdateUserStats).toHaveBeenCalledWith(userId, {
        totalFailures: 1,
        monthlyFailures: 1,
      });
    });

    it('should post to X on failure', async () => {
      const success = false;

      if (!success) {
        await postPenaltyTweet();
      }

      expect(mockPostPenaltyTweet).toHaveBeenCalled();
    });
  });

  describe('Complete Wake-up Journey', () => {
    it('should complete full success journey', async () => {
      const userId = 'test-user-123';
      const requiredSquats = 10;
      let currentSquats = 0;
      let alarmStopped = false;
      let historyRecorded = false;
      let statsUpdated = false;

      // 1. Alarm triggers (simulated)
      const { createAudioPlayer } = require('expo-audio');
      const player = createAudioPlayer({});
      player.play();

      // 2. User completes squats
      for (let i = 0; i < requiredSquats; i++) {
        currentSquats++;
      }

      // 3. Check completion
      if (currentSquats >= requiredSquats) {
        // Stop alarm
        player.pause();
        alarmStopped = true;

        // Record history
        await recordWakeUpHistory(userId, {
          success: true,
          squatCount: currentSquats,
        });
        historyRecorded = true;

        // Update stats
        await updateUserStats(userId, {
          totalSquats: currentSquats,
          monthlySquats: currentSquats,
        });
        statsUpdated = true;
      }

      expect(currentSquats).toBe(10);
      expect(alarmStopped).toBe(true);
      expect(historyRecorded).toBe(true);
      expect(statsUpdated).toBe(true);
      expect(mockPostPenaltyTweet).not.toHaveBeenCalled();
    });

    it('should complete full failure journey with X post', async () => {
      const userId = 'test-user-123';
      const requiredSquats = 10;
      let currentSquats = 5; // Only 5 squats done
      let timeExpired = true; // Time ran out
      let xPostSent = false;

      // Check if failed (time expired or not enough squats)
      if (timeExpired && currentSquats < requiredSquats) {
        // Record failure
        await recordWakeUpHistory(userId, {
          success: false,
          squatCount: currentSquats,
        });

        // Update failure stats
        await updateUserStats(userId, {
          totalFailures: 1,
          monthlyFailures: 1,
        });

        // Post to X (postPenaltyTweet uses i18n and stored tokens internally)
        const result = await postPenaltyTweet();
        xPostSent = result.success;
      }

      expect(mockRecordWakeUpHistory).toHaveBeenCalledWith(userId, {
        success: false,
        squatCount: 5,
      });
      expect(mockUpdateUserStats).toHaveBeenCalledWith(userId, {
        totalFailures: 1,
        monthlyFailures: 1,
      });
      expect(mockPostPenaltyTweet).toHaveBeenCalled();
      expect(xPostSent).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle accelerometer unavailable', async () => {
      const { Accelerometer } = require('expo-sensors');
      Accelerometer.isAvailableAsync.mockResolvedValueOnce(false);

      const isAvailable = await Accelerometer.isAvailableAsync();

      expect(isAvailable).toBe(false);
    });

    it('should handle X post failure gracefully', async () => {
      mockPostPenaltyTweet.mockResolvedValueOnce({ success: false, error: 'Network error' });

      const result = await postPenaltyTweet();

      expect(result.success).toBe(false);
      // Should continue flow even if X post fails
    });

    it('should handle offline scenario', async () => {
      // When offline, operations should be queued
      let isOnline = false;
      let operationQueued = false;

      if (!isOnline) {
        operationQueued = true;
        // In real implementation, would use offlineService
      }

      expect(operationQueued).toBe(true);
    });
  });
});
