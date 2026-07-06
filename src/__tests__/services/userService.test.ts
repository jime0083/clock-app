const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({ id: 'mock-doc' })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteField: jest.fn(() => '__deleteField__'),
  Timestamp: { now: jest.fn(() => ({ seconds: 0, nanoseconds: 0 })) },
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
}));

jest.mock('../../services/firebase', () => ({ db: {} }));

import {
  getUserDocument,
  createUserDocument,
  migrateUserDocumentFields,
  updateUserDocument,
  updateUserProfile,
  getUserSettings,
  updateUserSettings,
  getUserStats,
  updateUserStats,
  incrementSquatCount,
  incrementFailureCount,
  updateSNSConnection,
  updateXConnection,
  disconnectX,
  getSubscriptionStatus,
  updateSubscriptionStatus,
} from '../../services/userService';
import { UserDocument } from '../../types/firestore';

const fullUserDoc: UserDocument = {
  profile: {
    createdAt: { seconds: 0 } as never,
    email: 'a@b.com',
    displayName: 'A',
    photoURL: null,
  },
  settings: {
    alarmTime: '07:00',
    alarmDays: [1, 2, 3],
    customAlarmSound: null,
    calibration: null,
    language: 'ja',
    setupCompleted: true,
    timezone: 'Asia/Tokyo',
  },
  snsConnections: {
    x: {
      connected: true,
      accessToken: 'tok',
      refreshToken: 'ref',
      connectedAt: null,
      username: 'u',
    },
  },
  stats: {
    totalFailures: 1,
    monthlyFailures: 1,
    currentMonth: '2026-07',
    totalSquats: 10,
    monthlySquats: 10,
  },
  subscription: { isActive: true, plan: 'monthly', expiresAt: null, purchasedAt: null },
};

describe('userService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetDoc.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  describe('getUserDocument', () => {
    it('should return the document data when it exists', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => true, data: () => fullUserDoc });

      expect(await getUserDocument('uid-1')).toEqual(fullUserDoc);
    });

    it('should return null when the document does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      expect(await getUserDocument('uid-1')).toBeNull();
    });

    it('should rethrow on error', async () => {
      mockGetDoc.mockRejectedValue(new Error('firestore error'));

      await expect(getUserDocument('uid-1')).rejects.toThrow('firestore error');
    });
  });

  describe('createUserDocument', () => {
    it('should create a document with default settings/stats/subscription', async () => {
      await createUserDocument('uid-1', { email: 'a@b.com', displayName: 'A', photoURL: null });

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          profile: expect.objectContaining({ email: 'a@b.com' }),
          settings: expect.objectContaining({ setupCompleted: false }),
          stats: expect.objectContaining({ totalSquats: 0 }),
          subscription: expect.objectContaining({ isActive: false }),
        })
      );
    });

    it('should rethrow on error', async () => {
      mockSetDoc.mockRejectedValue(new Error('firestore error'));

      await expect(createUserDocument('uid-1', {})).rejects.toThrow('firestore error');
    });
  });

  describe('migrateUserDocumentFields', () => {
    it('should backfill all missing fields for a legacy document', async () => {
      await migrateUserDocumentFields('uid-1', {
        settings: { alarmTime: '07:00', calibrationData: { legacy: true } },
        stats: {},
      });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'settings.setupCompleted': false,
          'settings.timezone': null,
          'settings.calibration': null,
          'settings.calibrationData': '__deleteField__',
          'stats.monthlySquats': 0,
          subscription: expect.objectContaining({ isActive: false }),
          'snsConnections.x.refreshToken': null,
          'snsConnections.x.username': null,
        })
      );
    });

    it('should do nothing (no updateDoc call) when the document is already up to date', async () => {
      await migrateUserDocumentFields('uid-1', fullUserDoc as unknown as Record<string, unknown>);

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should rethrow on error', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('firestore error'));

      await expect(migrateUserDocumentFields('uid-1', { settings: {} })).rejects.toThrow(
        'firestore error'
      );
    });
  });

  describe('updateUserDocument', () => {
    it('should pass through arbitrary field updates', async () => {
      await updateUserDocument('uid-1', { lastAlarmSentAt: 'x' });

      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { lastAlarmSentAt: 'x' });
    });

    it('should rethrow on error', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('firestore error'));

      await expect(updateUserDocument('uid-1', {})).rejects.toThrow('firestore error');
    });
  });

  describe('updateUserProfile', () => {
    it('should update the profile fields', async () => {
      await updateUserProfile('uid-1', { email: 'new@b.com', displayName: 'New', photoURL: null });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ 'profile.email': 'new@b.com' })
      );
    });

    it('should rethrow on error', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('firestore error'));

      await expect(updateUserProfile('uid-1', {})).rejects.toThrow('firestore error');
    });
  });

  describe('getUserSettings', () => {
    it('should return the settings sub-object', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => true, data: () => fullUserDoc });

      expect(await getUserSettings('uid-1')).toEqual(fullUserDoc.settings);
    });

    it('should return null when the user document does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      expect(await getUserSettings('uid-1')).toBeNull();
    });
  });

  describe('updateUserSettings', () => {
    it('should only include the provided fields', async () => {
      await updateUserSettings('uid-1', { alarmTime: '08:00' });

      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), {
        'settings.alarmTime': '08:00',
      });
    });

    it('should include every provided setting field', async () => {
      await updateUserSettings('uid-1', {
        alarmTime: '08:00',
        alarmDays: [1],
        customAlarmSound: null,
        calibration: null,
        language: 'en',
        setupCompleted: true,
        timezone: 'Asia/Tokyo',
      });

      const updates = mockUpdateDoc.mock.calls[0][1];
      expect(Object.keys(updates)).toHaveLength(7);
    });

    it('should rethrow on error', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('firestore error'));

      await expect(updateUserSettings('uid-1', { language: 'en' })).rejects.toThrow(
        'firestore error'
      );
    });
  });

  describe('getUserStats', () => {
    it('should return the stats sub-object', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => true, data: () => fullUserDoc });

      expect(await getUserStats('uid-1')).toEqual(fullUserDoc.stats);
    });
  });

  describe('updateUserStats', () => {
    it('should include every provided stat field', async () => {
      await updateUserStats('uid-1', {
        totalFailures: 1,
        monthlyFailures: 1,
        currentMonth: '2026-07',
        totalSquats: 5,
        monthlySquats: 5,
      });

      const updates = mockUpdateDoc.mock.calls[0][1];
      expect(Object.keys(updates)).toHaveLength(5);
    });

    it('should rethrow on error', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('firestore error'));

      await expect(updateUserStats('uid-1', { totalSquats: 1 })).rejects.toThrow('firestore error');
    });
  });

  describe('incrementSquatCount', () => {
    it('should add to the monthly total when still within the same month', async () => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          ...fullUserDoc,
          stats: { ...fullUserDoc.stats, currentMonth, monthlySquats: 5, totalSquats: 5 },
        }),
      });

      await incrementSquatCount('uid-1', 10);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ 'stats.monthlySquats': 15, 'stats.totalSquats': 15 })
      );
    });

    it('should reset the monthly total when the month has changed', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          ...fullUserDoc,
          stats: {
            ...fullUserDoc.stats,
            currentMonth: '2000-01',
            monthlySquats: 5,
            totalSquats: 5,
          },
        }),
      });

      await incrementSquatCount('uid-1', 10);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ 'stats.monthlySquats': 10 })
      );
    });

    it('should do nothing when the user document does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      await incrementSquatCount('uid-1', 10);

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should rethrow on error', async () => {
      mockGetDoc.mockRejectedValue(new Error('firestore error'));

      await expect(incrementSquatCount('uid-1', 10)).rejects.toThrow('firestore error');
    });
  });

  describe('incrementFailureCount', () => {
    it('should increment failures within the same month', async () => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          ...fullUserDoc,
          stats: { ...fullUserDoc.stats, currentMonth, monthlyFailures: 2, totalFailures: 2 },
        }),
      });

      await incrementFailureCount('uid-1');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ 'stats.monthlyFailures': 3, 'stats.totalFailures': 3 })
      );
    });

    it('should reset the monthly failure count when the month has changed', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          ...fullUserDoc,
          stats: {
            ...fullUserDoc.stats,
            currentMonth: '2000-01',
            monthlyFailures: 2,
            totalFailures: 2,
          },
        }),
      });

      await incrementFailureCount('uid-1');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ 'stats.monthlyFailures': 1 })
      );
    });

    it('should do nothing when the user document does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      await incrementFailureCount('uid-1');

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe('SNS connection helpers', () => {
    it('updateSNSConnection should set the whole connection object', async () => {
      await updateSNSConnection('uid-1', 'x', fullUserDoc.snsConnections.x);

      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), {
        'snsConnections.x': fullUserDoc.snsConnections.x,
      });
    });

    it('updateXConnection should only include the provided fields', async () => {
      await updateXConnection('uid-1', { connected: true });

      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), {
        'snsConnections.x.connected': true,
      });
    });

    it('disconnectX should clear the whole X connection', async () => {
      await disconnectX('uid-1');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'snsConnections.x.connected': false,
          'snsConnections.x.accessToken': null,
        })
      );
    });

    it('disconnectX should rethrow on error', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('firestore error'));

      await expect(disconnectX('uid-1')).rejects.toThrow('firestore error');
    });
  });

  describe('subscription helpers', () => {
    it('getSubscriptionStatus should return the subscription sub-object', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => true, data: () => fullUserDoc });

      expect(await getSubscriptionStatus('uid-1')).toEqual(fullUserDoc.subscription);
    });

    it('updateSubscriptionStatus should include every provided field', async () => {
      await updateSubscriptionStatus('uid-1', {
        isActive: true,
        plan: 'yearly',
        expiresAt: null,
        purchasedAt: null,
      });

      const updates = mockUpdateDoc.mock.calls[0][1];
      expect(Object.keys(updates)).toHaveLength(4);
    });

    it('updateSubscriptionStatus should rethrow on error', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('firestore error'));

      await expect(updateSubscriptionStatus('uid-1', { isActive: true })).rejects.toThrow(
        'firestore error'
      );
    });
  });
});
