const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockGetDocs = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({ id: 'mock-doc' })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  collection: jest.fn(() => ({ id: 'mock-collection' })),
  query: jest.fn((...args: unknown[]) => args),
  where: jest.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  orderBy: jest.fn((field: string, dir: string) => ({ field, dir })),
  limit: jest.fn((n: number) => ({ limit: n })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  Timestamp: { now: jest.fn(() => ({ seconds: 0, nanoseconds: 0 })) },
  increment: jest.fn((n: number) => ({ __increment: n })),
}));

jest.mock('../../services/firebase', () => ({ db: {} }));

import {
  getWakeUpHistory,
  createWakeUpHistory,
  updateWakeUpHistory,
  recordWakeUpSuccess,
  recordWakeUpFailure,
  updatePenaltyPostStatus,
  recordWakeUpHistory,
  getWeeklyHistory,
  getLastWeekHistory,
  getMonthlyHistory,
  calculateWeeklyStats,
  getRecentHistory,
} from '../../services/historyService';
import { WakeUpHistory } from '../../types/firestore';

const snapshotOf = (docs: WakeUpHistory[]) => ({
  forEach: (cb: (doc: { data: () => WakeUpHistory }) => void) => {
    docs.forEach(d => cb({ data: () => d }));
  },
});

describe('historyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetDoc.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  describe('getWakeUpHistory', () => {
    it('should return the history document when it exists', async () => {
      const history: WakeUpHistory = {
        date: '2026-07-06',
        alarmTime: '07:00',
        success: true,
        squatCount: 10,
        completedAt: null,
        penaltyPosted: false,
        penaltyPostId: null,
      };
      mockGetDoc.mockResolvedValue({ exists: () => true, data: () => history });

      expect(await getWakeUpHistory('uid-1', '2026-07-06')).toEqual(history);
    });

    it('should return null when the document does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      expect(await getWakeUpHistory('uid-1', '2026-07-06')).toBeNull();
    });

    it('should rethrow on error', async () => {
      mockGetDoc.mockRejectedValue(new Error('firestore error'));

      await expect(getWakeUpHistory('uid-1', '2026-07-06')).rejects.toThrow('firestore error');
    });
  });

  describe('createWakeUpHistory / updateWakeUpHistory', () => {
    const history: WakeUpHistory = {
      date: '2026-07-06',
      alarmTime: '07:00',
      success: true,
      squatCount: 10,
      completedAt: null,
      penaltyPosted: false,
      penaltyPostId: null,
    };

    it('should create the history document', async () => {
      await createWakeUpHistory('uid-1', history);

      expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), history);
    });

    it('should rethrow on create error', async () => {
      mockSetDoc.mockRejectedValue(new Error('firestore error'));

      await expect(createWakeUpHistory('uid-1', history)).rejects.toThrow('firestore error');
    });

    it('should update the history document', async () => {
      await updateWakeUpHistory('uid-1', '2026-07-06', { penaltyPosted: true });

      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { penaltyPosted: true });
    });

    it('should rethrow on update error', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('firestore error'));

      await expect(
        updateWakeUpHistory('uid-1', '2026-07-06', { penaltyPosted: true })
      ).rejects.toThrow('firestore error');
    });
  });

  describe('recordWakeUpSuccess / recordWakeUpFailure', () => {
    it('should create a success history entry', async () => {
      await recordWakeUpSuccess('uid-1', '07:00', 10);

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ success: true, squatCount: 10 })
      );
    });

    it('should rethrow on success-record error', async () => {
      mockSetDoc.mockRejectedValue(new Error('firestore error'));

      await expect(recordWakeUpSuccess('uid-1', '07:00', 10)).rejects.toThrow('firestore error');
    });

    it('should create a failure history entry', async () => {
      await recordWakeUpFailure('uid-1', '07:00', 5);

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ success: false, squatCount: 5 })
      );
    });

    it('should rethrow on failure-record error', async () => {
      mockSetDoc.mockRejectedValue(new Error('firestore error'));

      await expect(recordWakeUpFailure('uid-1', '07:00', 5)).rejects.toThrow('firestore error');
    });
  });

  describe('updatePenaltyPostStatus', () => {
    it('should update the penalty post fields', async () => {
      await updatePenaltyPostStatus('uid-1', '2026-07-06', true, 'tweet-1');

      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), {
        penaltyPosted: true,
        penaltyPostId: 'tweet-1',
      });
    });

    it('should rethrow on error', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('firestore error'));

      await expect(updatePenaltyPostStatus('uid-1', '2026-07-06', true, null)).rejects.toThrow(
        'firestore error'
      );
    });
  });

  describe('recordWakeUpHistory', () => {
    it('should create the history doc and increment stats within the same month', async () => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ stats: { currentMonth } }),
      });

      const dateString = await recordWakeUpHistory('uid-1', { success: true, squatCount: 10 });

      expect(mockSetDoc).toHaveBeenCalled();
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ 'stats.totalSquats': { __increment: 10 } })
      );
      expect(dateString).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should reset monthly stats when the month has changed', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ stats: { currentMonth: '2000-01' } }),
      });

      await recordWakeUpHistory('uid-1', { success: false, squatCount: 3 });

      const statsUpdate = mockUpdateDoc.mock.calls[0][1];
      expect(statsUpdate['stats.monthlyFailures']).toBe(1);
      expect(statsUpdate['stats.monthlySquats']).toBe(3);
    });

    it('should increment failure counters on failure within the same month', async () => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ stats: { currentMonth } }),
      });

      await recordWakeUpHistory('uid-1', { success: false, squatCount: 3 });

      const statsUpdate = mockUpdateDoc.mock.calls[0][1];
      expect(statsUpdate['stats.totalFailures']).toEqual({ __increment: 1 });
      expect(statsUpdate['stats.monthlyFailures']).toEqual({ __increment: 1 });
    });

    it('should skip the stats update when the user document does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      await recordWakeUpHistory('uid-1', { success: true, squatCount: 10 });

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should rethrow on error', async () => {
      mockGetDoc.mockRejectedValue(new Error('firestore error'));

      await expect(recordWakeUpHistory('uid-1', { success: true, squatCount: 10 })).rejects.toThrow(
        'firestore error'
      );
    });
  });

  describe('history queries', () => {
    const sample: WakeUpHistory[] = [
      {
        date: '2026-06-29',
        alarmTime: '07:00',
        success: true,
        squatCount: 10,
        completedAt: null,
        penaltyPosted: false,
        penaltyPostId: null,
      },
    ];

    it('getWeeklyHistory should return this week`s history', async () => {
      mockGetDocs.mockResolvedValue(snapshotOf(sample));

      expect(await getWeeklyHistory('uid-1')).toEqual(sample);
    });

    it('getWeeklyHistory should rethrow on error', async () => {
      mockGetDocs.mockRejectedValue(new Error('firestore error'));

      await expect(getWeeklyHistory('uid-1')).rejects.toThrow('firestore error');
    });

    it('getLastWeekHistory should return last week`s history', async () => {
      mockGetDocs.mockResolvedValue(snapshotOf(sample));

      expect(await getLastWeekHistory('uid-1')).toEqual(sample);
    });

    it('getLastWeekHistory should rethrow on error', async () => {
      mockGetDocs.mockRejectedValue(new Error('firestore error'));

      await expect(getLastWeekHistory('uid-1')).rejects.toThrow('firestore error');
    });

    it('getMonthlyHistory should return the given month`s history', async () => {
      mockGetDocs.mockResolvedValue(snapshotOf(sample));

      expect(await getMonthlyHistory('uid-1', '2026-06')).toEqual(sample);
    });

    it('getMonthlyHistory should rethrow on error', async () => {
      mockGetDocs.mockRejectedValue(new Error('firestore error'));

      await expect(getMonthlyHistory('uid-1', '2026-06')).rejects.toThrow('firestore error');
    });

    it('getRecentHistory should return the N most recent entries in chronological order', async () => {
      mockGetDocs.mockResolvedValue(snapshotOf(sample));

      expect(await getRecentHistory('uid-1', 5)).toEqual(sample);
    });

    it('getRecentHistory should rethrow on error', async () => {
      mockGetDocs.mockRejectedValue(new Error('firestore error'));

      await expect(getRecentHistory('uid-1')).rejects.toThrow('firestore error');
    });
  });

  describe('calculateWeeklyStats', () => {
    it('should sum successes and squat counts', () => {
      const stats = calculateWeeklyStats([
        {
          date: '1',
          alarmTime: '07:00',
          success: true,
          squatCount: 10,
          completedAt: null,
          penaltyPosted: false,
          penaltyPostId: null,
        },
        {
          date: '2',
          alarmTime: '07:00',
          success: false,
          squatCount: 3,
          completedAt: null,
          penaltyPosted: true,
          penaltyPostId: 'x',
        },
      ]);

      expect(stats).toEqual({ successCount: 1, squatCount: 13 });
    });

    it('should return zeros for empty history', () => {
      expect(calculateWeeklyStats([])).toEqual({ successCount: 0, squatCount: 0 });
    });
  });
});
