const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockRemoveItem = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args: unknown[]) => mockGetItem(...args),
  setItem: (...args: unknown[]) => mockSetItem(...args),
  removeItem: (...args: unknown[]) => mockRemoveItem(...args),
}));

const mockGetLastWeekHistory = jest.fn();
const mockCalculateWeeklyStats = jest.fn();

jest.mock('../../services/historyService', () => ({
  getLastWeekHistory: (...args: unknown[]) => mockGetLastWeekHistory(...args),
  calculateWeeklyStats: (...args: unknown[]) => mockCalculateWeeklyStats(...args),
}));

import {
  shouldShowWeeklySummary,
  markWeeklySummaryShown,
  getWeeklySummary,
  resetWeeklySummaryStatus,
} from '../../services/weeklySummaryService';

describe('weeklySummaryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldShowWeeklySummary', () => {
    it('should return true when never shown', async () => {
      mockGetItem.mockResolvedValue(null);

      expect(await shouldShowWeeklySummary()).toBe(true);
    });

    it('should return true when last shown before this Monday', async () => {
      mockGetItem.mockResolvedValue('2000-01-01');

      expect(await shouldShowWeeklySummary()).toBe(true);
    });

    it('should return false when already shown this week', async () => {
      const farFuture = '2999-01-01';
      mockGetItem.mockResolvedValue(farFuture);

      expect(await shouldShowWeeklySummary()).toBe(false);
    });

    it('should return false when AsyncStorage throws', async () => {
      mockGetItem.mockRejectedValue(new Error('Storage error'));

      expect(await shouldShowWeeklySummary()).toBe(false);
    });
  });

  describe('markWeeklySummaryShown', () => {
    it('should store today as the last-shown date', async () => {
      mockSetItem.mockResolvedValue(undefined);

      await markWeeklySummaryShown();

      const today = new Date().toISOString().slice(0, 10);
      expect(mockSetItem).toHaveBeenCalledWith('weekly_summary_last_shown', today);
    });

    it('should not throw when AsyncStorage fails', async () => {
      mockSetItem.mockRejectedValue(new Error('Storage error'));

      await expect(markWeeklySummaryShown()).resolves.toBeUndefined();
    });
  });

  describe('getWeeklySummary', () => {
    it('should return null when there is no history', async () => {
      mockGetLastWeekHistory.mockResolvedValue([]);

      const result = await getWeeklySummary('uid-1');

      expect(result).toBeNull();
      expect(mockCalculateWeeklyStats).not.toHaveBeenCalled();
    });

    it('should return summary stats with week start/end when history exists', async () => {
      mockGetLastWeekHistory.mockResolvedValue([{ date: '2026-06-29', success: true }]);
      mockCalculateWeeklyStats.mockReturnValue({ successCount: 3, squatCount: 30 });

      const result = await getWeeklySummary('uid-1');

      expect(result).not.toBeNull();
      expect(result?.successCount).toBe(3);
      expect(result?.squatCount).toBe(30);
      expect(result?.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result?.weekEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return null when an error occurs', async () => {
      mockGetLastWeekHistory.mockRejectedValue(new Error('Firestore error'));

      const result = await getWeeklySummary('uid-1');

      expect(result).toBeNull();
    });
  });

  describe('resetWeeklySummaryStatus', () => {
    it('should remove the stored key', async () => {
      mockRemoveItem.mockResolvedValue(undefined);

      await resetWeeklySummaryStatus();

      expect(mockRemoveItem).toHaveBeenCalledWith('weekly_summary_last_shown');
    });

    it('should not throw when AsyncStorage fails', async () => {
      mockRemoveItem.mockRejectedValue(new Error('Storage error'));

      await expect(resetWeeklySummaryStatus()).resolves.toBeUndefined();
    });
  });
});
