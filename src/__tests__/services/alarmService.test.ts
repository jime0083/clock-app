const mockRequestNotificationPermissions = jest.fn();
const mockScheduleAlarmNotification = jest.fn();
const mockScheduleAlarmRepeatNotifications = jest.fn();
const mockCancelAlarmRepeatNotifications = jest.fn();
const mockCancelAllAlarmNotifications = jest.fn();
const mockDismissAllNotifications = jest.fn();
const mockSetForegroundEventHandler = jest.fn();
const mockGetInitialNotification = jest.fn();
const mockSetNotificationCategories = jest.fn();

jest.mock('../../services/notificationService', () => ({
  requestNotificationPermissions: (...args: unknown[]) =>
    mockRequestNotificationPermissions(...args),
  scheduleAlarmNotification: (...args: unknown[]) => mockScheduleAlarmNotification(...args),
  scheduleAlarmRepeatNotifications: (...args: unknown[]) =>
    mockScheduleAlarmRepeatNotifications(...args),
  cancelAlarmRepeatNotifications: (...args: unknown[]) =>
    mockCancelAlarmRepeatNotifications(...args),
  cancelAllAlarmNotifications: (...args: unknown[]) => mockCancelAllAlarmNotifications(...args),
  dismissAllNotifications: (...args: unknown[]) => mockDismissAllNotifications(...args),
  setForegroundEventHandler: (...args: unknown[]) => mockSetForegroundEventHandler(...args),
  getInitialNotification: (...args: unknown[]) => mockGetInitialNotification(...args),
  setNotificationCategories: (...args: unknown[]) => mockSetNotificationCategories(...args),
}));

const mockPlayAlarmSound = jest.fn();
const mockStopAlarmSound = jest.fn();
const mockGetIsPlaying = jest.fn();
jest.mock('../../services/audioService', () => ({
  audioService: {
    playAlarmSound: (...args: unknown[]) => mockPlayAlarmSound(...args),
    stopAlarmSound: (...args: unknown[]) => mockStopAlarmSound(...args),
    getIsPlaying: (...args: unknown[]) => mockGetIsPlaying(...args),
  },
}));

const mockGetUserDocument = jest.fn();
const mockUpdateUserDocument = jest.fn();
jest.mock('../../services/userService', () => ({
  getUserDocument: (...args: unknown[]) => mockGetUserDocument(...args),
  updateUserDocument: (...args: unknown[]) => mockUpdateUserDocument(...args),
}));

jest.mock('../../services/firebase', () => ({ db: {} }));

jest.mock('firebase/firestore', () => {
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
    Timestamp: MockTimestamp,
  };
});

const mockGetDoc = jest.fn();

jest.mock('@/locales', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

import { alarmService } from '../../services/alarmService';

describe('alarmService', () => {
  const uid = 'test-user-123';

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRequestNotificationPermissions.mockResolvedValue(true);
    mockSetNotificationCategories.mockResolvedValue(undefined);
    mockGetInitialNotification.mockResolvedValue(null);
    mockGetUserDocument.mockResolvedValue({
      settings: { customAlarmSound: null, alarmTime: '07:00', alarmDays: [1] },
    });
    mockUpdateUserDocument.mockResolvedValue(undefined);
    mockScheduleAlarmNotification.mockResolvedValue(['id-1']);
    mockCancelAlarmRepeatNotifications.mockResolvedValue(undefined);
    mockCancelAllAlarmNotifications.mockResolvedValue(undefined);
    mockDismissAllNotifications.mockResolvedValue(undefined);
    mockStopAlarmSound.mockResolvedValue(undefined);
    mockPlayAlarmSound.mockResolvedValue(undefined);
    mockScheduleAlarmRepeatNotifications.mockResolvedValue(['repeat-1']);
    await alarmService.initialize(uid);
    // The singleton's alarmState may have been left 'ringing'/'snoozed' by a
    // previous test - force it back to 'idle' before each test, then clear
    // the mock call history this reset itself generated.
    await alarmService.stopAlarm();
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should return false when notification permission is not granted', async () => {
      // Force a fresh singleton state by re-requiring the module
      jest.resetModules();
      jest.doMock('../../services/notificationService', () => ({
        requestNotificationPermissions: jest.fn().mockResolvedValue(false),
        scheduleAlarmNotification: jest.fn(),
        scheduleAlarmRepeatNotifications: jest.fn(),
        cancelAlarmRepeatNotifications: jest.fn(),
        cancelAllAlarmNotifications: jest.fn(),
        dismissAllNotifications: jest.fn(),
        setForegroundEventHandler: jest.fn(),
        getInitialNotification: jest.fn().mockResolvedValue(null),
        setNotificationCategories: jest.fn(),
      }));
      jest.doMock('../../services/audioService', () => ({
        audioService: {
          playAlarmSound: jest.fn(),
          stopAlarmSound: jest.fn(),
          getIsPlaying: jest.fn(),
        },
      }));
      jest.doMock('../../services/userService', () => ({
        getUserDocument: jest.fn(),
        updateUserDocument: jest.fn(),
      }));
      jest.doMock('../../services/firebase', () => ({ db: {} }));
      jest.doMock('@/locales', () => ({ __esModule: true, default: { t: (k: string) => k } }));

      const { alarmService: freshAlarmService } = require('../../services/alarmService');
      const result = await freshAlarmService.initialize('other-uid');

      expect(result).toBe(false);
    });

    it('should trigger the alarm immediately when launched from an alarm notification', async () => {
      jest.resetModules();
      const localGetInitial = jest
        .fn()
        .mockResolvedValue({ notification: { data: { type: 'alarm' } } });
      jest.doMock('../../services/notificationService', () => ({
        requestNotificationPermissions: jest.fn().mockResolvedValue(true),
        scheduleAlarmNotification: jest.fn(),
        scheduleAlarmRepeatNotifications: jest.fn(),
        cancelAlarmRepeatNotifications: jest.fn().mockResolvedValue(undefined),
        cancelAllAlarmNotifications: jest.fn(),
        dismissAllNotifications: jest.fn(),
        setForegroundEventHandler: jest.fn(),
        getInitialNotification: localGetInitial,
        setNotificationCategories: jest.fn().mockResolvedValue(undefined),
      }));
      jest.doMock('../../services/audioService', () => ({
        audioService: {
          playAlarmSound: jest.fn().mockResolvedValue(undefined),
          stopAlarmSound: jest.fn().mockResolvedValue(undefined),
          getIsPlaying: jest.fn(),
        },
      }));
      jest.doMock('../../services/userService', () => ({
        getUserDocument: jest.fn().mockResolvedValue({ settings: {} }),
        updateUserDocument: jest.fn(),
      }));
      jest.doMock('../../services/firebase', () => ({ db: {} }));
      jest.doMock('@/locales', () => ({ __esModule: true, default: { t: (k: string) => k } }));

      const { alarmService: freshAlarmService } = require('../../services/alarmService');
      await freshAlarmService.initialize('launch-uid');

      expect(freshAlarmService.hasPendingAlarm()).toBe(true);
      expect(freshAlarmService.getAlarmState()).toBe('ringing');
    });
  });

  describe('scheduleAlarm', () => {
    it('should schedule a notification with the localized title/body', async () => {
      const result = await alarmService.scheduleAlarm({
        alarmTime: '07:00',
        alarmDays: [1, 2],
        customAlarmSound: null,
      });

      expect(result).toBe(true);
      expect(mockScheduleAlarmNotification).toHaveBeenCalledWith(
        '07:00',
        [1, 2],
        expect.any(String),
        expect.any(String)
      );
    });

    it('should return false when alarmTime is empty', async () => {
      const result = await alarmService.scheduleAlarm({
        alarmTime: '',
        alarmDays: [],
        customAlarmSound: null,
      });

      expect(result).toBe(false);
      expect(mockScheduleAlarmNotification).not.toHaveBeenCalled();
    });

    it('should return false when scheduling throws', async () => {
      mockScheduleAlarmNotification.mockRejectedValue(new Error('notifee error'));

      const result = await alarmService.scheduleAlarm({
        alarmTime: '07:00',
        alarmDays: [1],
        customAlarmSound: null,
      });

      expect(result).toBe(false);
    });
  });

  describe('cancelAlarm', () => {
    it('should cancel all alarm notifications', async () => {
      await alarmService.cancelAlarm();

      expect(mockCancelAllAlarmNotifications).toHaveBeenCalled();
    });
  });

  describe('updateAlarm', () => {
    it('should cancel and reschedule', async () => {
      const result = await alarmService.updateAlarm({
        alarmTime: '08:00',
        alarmDays: [2],
        customAlarmSound: null,
      });

      expect(result).toBe(true);
      expect(mockCancelAllAlarmNotifications).toHaveBeenCalled();
      expect(mockScheduleAlarmNotification).toHaveBeenCalled();
    });
  });

  describe('stopAlarm', () => {
    it('should stop the sound, cancel notifications, and reschedule the local backup', async () => {
      await alarmService.stopAlarm();

      expect(mockStopAlarmSound).toHaveBeenCalled();
      expect(mockCancelAlarmRepeatNotifications).toHaveBeenCalled();
      expect(mockDismissAllNotifications).toHaveBeenCalled();
      expect(alarmService.getAlarmState()).toBe('idle');
      // Reschedules using the saved alarm settings
      expect(mockScheduleAlarmNotification).toHaveBeenCalledWith(
        '07:00',
        [1],
        expect.any(String),
        expect.any(String)
      );
    });

    it('should not reschedule when the user has no saved alarm time', async () => {
      mockGetUserDocument.mockResolvedValue({ settings: {} });

      await alarmService.stopAlarm();

      expect(mockScheduleAlarmNotification).not.toHaveBeenCalled();
    });
  });

  describe('snoozeAlarm', () => {
    it('should stop the sound and schedule repeat notifications', async () => {
      await alarmService.snoozeAlarm(5);

      expect(mockStopAlarmSound).toHaveBeenCalled();
      expect(alarmService.getAlarmState()).toBe('snoozed');
      expect(mockScheduleAlarmRepeatNotifications).toHaveBeenCalled();
    });
  });

  describe('isAlarmPlaying', () => {
    it('should reflect the audio service playing state', () => {
      mockGetIsPlaying.mockReturnValue(true);
      expect(alarmService.isAlarmPlaying()).toBe(true);

      mockGetIsPlaying.mockReturnValue(false);
      expect(alarmService.isAlarmPlaying()).toBe(false);
    });
  });

  describe('triggerAlarmFromFCM', () => {
    it('should play the alarm sound and transition to ringing', async () => {
      await alarmService.triggerAlarmFromFCM();

      expect(mockPlayAlarmSound).toHaveBeenCalled();
      expect(alarmService.getAlarmState()).toBe('ringing');
    });

    it('should just re-sync the UI callback when already ringing', async () => {
      const callback = jest.fn();
      alarmService.setOnAlarmTriggered(callback);

      await alarmService.triggerAlarmFromFCM();
      callback.mockClear();
      mockPlayAlarmSound.mockClear();
      await alarmService.triggerAlarmFromFCM();

      expect(mockPlayAlarmSound).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalled();
    });

    it('should reschedule local notifications on acknowledge so ring fillers stop (Problem 44)', async () => {
      await alarmService.triggerAlarmFromFCM();
      // The reschedule is fire-and-forget - flush the pending promise chain
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockScheduleAlarmNotification).toHaveBeenCalledWith(
        '07:00',
        [1],
        expect.any(String),
        expect.any(String)
      );
    });
  });

  describe('checkAlarmWindow additional branches', () => {
    it('should return false when the user document does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      expect(await alarmService.checkAlarmWindow()).toBe(false);
    });

    it('should return false when there is no lastAlarmSentAt', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({}) });

      expect(await alarmService.checkAlarmWindow()).toBe(false);
    });

    it('should return false when Firestore throws', async () => {
      mockGetDoc.mockRejectedValue(new Error('firestore error'));

      expect(await alarmService.checkAlarmWindow()).toBe(false);
    });
  });

  describe('checkAndStartAlarmIfNeeded', () => {
    it('should trigger the alarm when within the window', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ lastAlarmSentAt: new Date().toISOString(), squatCompletedAt: null }),
      });

      const result = await alarmService.checkAndStartAlarmIfNeeded();

      expect(result).toBe(true);
      expect(mockPlayAlarmSound).toHaveBeenCalled();
    });

    it('should do nothing when outside the window', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          lastAlarmSentAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          squatCompletedAt: null,
        }),
      });

      const result = await alarmService.checkAndStartAlarmIfNeeded();

      expect(result).toBe(false);
    });
  });

  describe('pending alarm flag / cleanup', () => {
    it('should clear the pending alarm flag', () => {
      alarmService.clearPendingAlarm();
      expect(alarmService.hasPendingAlarm()).toBe(false);
    });

    it('cleanup should not throw', () => {
      expect(() => alarmService.cleanup()).not.toThrow();
    });
  });
});
