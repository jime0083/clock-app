/**
 * E2E Test: Alarm to Wake-up Judgment Flow
 *
 * Tests the complete wake-up journey against the current (post-Phase 20/21/23)
 * architecture:
 * 1. Alarm trigger time/day matching and the 5-minute squat window
 * 2. Squat detection counting logic
 * 3. Success: alarmService.recordSquatCompletion() (squatCompletedAt) +
 *    historyService.recordWakeUpHistory (local history/stats)
 * 4. Failure: alarmService.recordAlarmFailure() (alarmFailedAt) +
 *    historyService.recordWakeUpHistory - NOTE: the penalty tweet is posted
 *    server-side (Cloud Functions checkSquatCompletion) based on
 *    alarmFailedAt. There is no client-side X posting anymore.
 */

// Mock Firebase Firestore
const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock('firebase/firestore', () => {
  // A real class (not a plain object) so `instanceof Timestamp` checks in
  // alarmService/historyService behave like the real Firestore SDK
  class MockTimestamp {
    constructor(
      public seconds: number,
      public nanoseconds: number
    ) {}
    toMillis() {
      return this.seconds * 1000;
    }
    static now() {
      return new MockTimestamp(Math.floor(Date.now() / 1000), 0);
    }
  }

  return {
    doc: jest.fn(() => ({ id: 'mock-doc' })),
    getDoc: (...args: unknown[]) => mockGetDoc(...args),
    getDocFromServer: (...args: unknown[]) => mockGetDoc(...args),
    setDoc: (...args: unknown[]) => mockSetDoc(...args),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    getDocs: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    increment: jest.fn((n: number) => n),
    Timestamp: MockTimestamp,
  };
});

jest.mock('../../services/firebase', () => ({
  db: {},
}));

// Mock userService (alarmService depends on getUserDocument/updateUserDocument)
const mockGetUserDocument = jest.fn();
const mockUpdateUserDocument = jest.fn();
jest.mock('../../services/userService', () => ({
  getUserDocument: (...args: unknown[]) => mockGetUserDocument(...args),
  updateUserDocument: (...args: unknown[]) => mockUpdateUserDocument(...args),
}));

// Mock notificationService (alarmService orchestrates these, real notifee/FCM
// calls are out of scope for this test)
jest.mock('../../services/notificationService', () => ({
  requestNotificationPermissions: jest.fn(() => Promise.resolve(true)),
  scheduleAlarmNotification: jest.fn(() => Promise.resolve()),
  scheduleAlarmRepeatNotifications: jest.fn(() => Promise.resolve()),
  cancelAlarmRepeatNotifications: jest.fn(() => Promise.resolve()),
  cancelAllAlarmNotifications: jest.fn(() => Promise.resolve()),
  dismissAllNotifications: jest.fn(() => Promise.resolve()),
  setForegroundEventHandler: jest.fn(),
  getInitialNotification: jest.fn(() => Promise.resolve(null)),
  setNotificationCategories: jest.fn(() => Promise.resolve()),
}));

// Mock audioService (playback itself is not what this flow test verifies)
const mockStopAlarmSound = jest.fn(() => Promise.resolve());
jest.mock('../../services/audioService', () => ({
  audioService: {
    playAlarmSound: jest.fn(() => Promise.resolve()),
    stopAlarmSound: () => mockStopAlarmSound(),
    getIsPlaying: jest.fn(() => false),
  },
}));

jest.mock('@/locales', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

import { alarmService } from '../../services/alarmService';
import { recordWakeUpHistory } from '../../services/historyService';

describe('E2E: Alarm to Wake-up Judgment Flow', () => {
  const uid = 'test-user-123';

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetUserDocument.mockResolvedValue({ settings: { customAlarmSound: null } });
    mockUpdateUserDocument.mockResolvedValue(undefined);
    mockSetDoc.mockResolvedValue(undefined);
    await alarmService.initialize(uid);
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

      processAccelerometerData({ z: 1.0 });
      expect(squatCount).toBe(0);

      processAccelerometerData({ z: 0.6 });
      expect(isInSquatPosition).toBe(true);

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

      for (let i = 0; i < requiredSquats; i++) {
        onSquatCompleted();
      }

      expect(currentSquats).toBe(10);
      expect(isCompleted).toBe(true);
    });
  });

  describe('checkAlarmWindow (5-minute squat window)', () => {
    it('should return true at 4:59 elapsed (just inside the window)', async () => {
      const elapsedMs = 4 * 60 * 1000 + 59 * 1000; // 4:59
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          lastAlarmSentAt: new Date(Date.now() - elapsedMs).toISOString(),
          squatCompletedAt: null,
        }),
      });

      expect(await alarmService.checkAlarmWindow()).toBe(true);
    });

    it('should return false at 5:01 elapsed (just past the window)', async () => {
      const elapsedMs = 5 * 60 * 1000 + 1000; // 5:01
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          lastAlarmSentAt: new Date(Date.now() - elapsedMs).toISOString(),
          squatCompletedAt: null,
        }),
      });

      expect(await alarmService.checkAlarmWindow()).toBe(false);
    });

    it('should return false if squats were completed after this alarm was sent', async () => {
      const alarmSentAt = Date.now() - 60 * 1000;
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          lastAlarmSentAt: new Date(alarmSentAt).toISOString(),
          squatCompletedAt: new Date(alarmSentAt + 1000).toISOString(), // after the alarm
        }),
      });

      expect(await alarmService.checkAlarmWindow()).toBe(false);
    });

    it('should return true if squatCompletedAt predates this alarm (stale completion from a previous day)', async () => {
      const alarmSentAt = Date.now() - 60 * 1000;
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          lastAlarmSentAt: new Date(alarmSentAt).toISOString(),
          squatCompletedAt: new Date(alarmSentAt - 24 * 60 * 60 * 1000).toISOString(), // yesterday
        }),
      });

      expect(await alarmService.checkAlarmWindow()).toBe(true);
    });
  });

  describe('Success Flow', () => {
    it('should record squatCompletedAt and stop the alarm', async () => {
      await alarmService.recordSquatCompletion();

      expect(mockUpdateUserDocument).toHaveBeenCalledWith(
        uid,
        expect.objectContaining({ squatCompletedAt: expect.anything() })
      );
      expect(mockStopAlarmSound).toHaveBeenCalled();
    });

    it('should record success history with the full squat count', async () => {
      await recordWakeUpHistory(uid, { success: true, squatCount: 10 });

      expect(mockSetDoc).toHaveBeenCalled();
      const [, historyData] = mockSetDoc.mock.calls[0];
      expect(historyData.success).toBe(true);
      expect(historyData.squatCount).toBe(10);
      expect(historyData.completedAt).not.toBeNull();
    });
  });

  describe('Failure Flow', () => {
    it('should record alarmFailedAt and stop the alarm (no client-side X post)', async () => {
      await alarmService.recordAlarmFailure();

      expect(mockUpdateUserDocument).toHaveBeenCalledWith(
        uid,
        expect.objectContaining({ alarmFailedAt: expect.anything() })
      );
      expect(mockStopAlarmSound).toHaveBeenCalled();
    });

    it('should record failure history with the partial squat count', async () => {
      await recordWakeUpHistory(uid, { success: false, squatCount: 5 });

      expect(mockSetDoc).toHaveBeenCalled();
      const [, historyData] = mockSetDoc.mock.calls[0];
      expect(historyData.success).toBe(false);
      expect(historyData.squatCount).toBe(5);
      expect(historyData.completedAt).toBeNull();
    });

    it('should have no client-side X posting module (Problem 20/21: server posts based on alarmFailedAt)', () => {
      expect(() => require('../../services/xPostService')).toThrow();
      expect(() => require('../../services/secureTokenService')).toThrow();
    });
  });

  describe('Complete Wake-up Journey', () => {
    it('should complete full success journey', async () => {
      await alarmService.recordSquatCompletion();
      await recordWakeUpHistory(uid, { success: true, squatCount: 10 });

      expect(mockUpdateUserDocument).toHaveBeenCalledWith(
        uid,
        expect.objectContaining({ squatCompletedAt: expect.anything() })
      );
      expect(mockStopAlarmSound).toHaveBeenCalled();
      const [, historyData] = mockSetDoc.mock.calls[0];
      expect(historyData.success).toBe(true);
    });

    it('should complete full failure journey (server posts penalty based on alarmFailedAt)', async () => {
      await alarmService.recordAlarmFailure();
      await recordWakeUpHistory(uid, { success: false, squatCount: 5 });

      expect(mockUpdateUserDocument).toHaveBeenCalledWith(
        uid,
        expect.objectContaining({ alarmFailedAt: expect.anything() })
      );
      expect(mockStopAlarmSound).toHaveBeenCalled();
      const [, historyData] = mockSetDoc.mock.calls[0];
      expect(historyData.success).toBe(false);
    });
  });
});
