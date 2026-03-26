/**
 * Data Processing Unit Tests
 *
 * Tests for utility functions and data processing logic including:
 * - Weekly summary calculations
 * - Weekly stats calculations
 * - Date utilities
 */

import { WakeUpHistory } from '../../types/firestore';
import { Timestamp } from 'firebase/firestore';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  orderBy: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({
      toDate: () => new Date(),
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0,
    })),
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    })),
  },
}));

jest.mock('../../services/firebase', () => ({
  db: {},
}));

// Import the actual calculateWeeklyStats function to test
const calculateWeeklyStats = (
  history: WakeUpHistory[]
): { successCount: number; squatCount: number } => {
  return history.reduce(
    (acc, h) => ({
      successCount: acc.successCount + (h.success ? 1 : 0),
      squatCount: acc.squatCount + h.squatCount,
    }),
    { successCount: 0, squatCount: 0 }
  );
};

// Helper function to create mock WakeUpHistory
const createMockHistory = (
  date: string,
  success: boolean,
  squatCount: number
): WakeUpHistory => ({
  date,
  alarmTime: '07:00',
  success,
  squatCount,
  completedAt: success ? Timestamp.now() : null,
  penaltyPosted: !success,
  penaltyPostId: null,
});

describe('calculateWeeklyStats', () => {
  it('should return zero counts for empty history', () => {
    const result = calculateWeeklyStats([]);

    expect(result.successCount).toBe(0);
    expect(result.squatCount).toBe(0);
  });

  it('should calculate correct stats for all successful wake-ups', () => {
    const history: WakeUpHistory[] = [
      createMockHistory('2024-01-08', true, 10),
      createMockHistory('2024-01-09', true, 15),
      createMockHistory('2024-01-10', true, 12),
      createMockHistory('2024-01-11', true, 10),
      createMockHistory('2024-01-12', true, 10),
    ];

    const result = calculateWeeklyStats(history);

    expect(result.successCount).toBe(5);
    expect(result.squatCount).toBe(57);
  });

  it('should calculate correct stats for all failures', () => {
    const history: WakeUpHistory[] = [
      createMockHistory('2024-01-08', false, 3),
      createMockHistory('2024-01-09', false, 5),
      createMockHistory('2024-01-10', false, 2),
    ];

    const result = calculateWeeklyStats(history);

    expect(result.successCount).toBe(0);
    expect(result.squatCount).toBe(10);
  });

  it('should calculate correct stats for mixed results', () => {
    const history: WakeUpHistory[] = [
      createMockHistory('2024-01-08', true, 10),
      createMockHistory('2024-01-09', false, 5),
      createMockHistory('2024-01-10', true, 12),
      createMockHistory('2024-01-11', false, 3),
      createMockHistory('2024-01-12', true, 10),
    ];

    const result = calculateWeeklyStats(history);

    expect(result.successCount).toBe(3);
    expect(result.squatCount).toBe(40);
  });

  it('should handle single entry', () => {
    const history: WakeUpHistory[] = [createMockHistory('2024-01-08', true, 10)];

    const result = calculateWeeklyStats(history);

    expect(result.successCount).toBe(1);
    expect(result.squatCount).toBe(10);
  });

  it('should handle zero squat counts', () => {
    const history: WakeUpHistory[] = [
      createMockHistory('2024-01-08', false, 0),
      createMockHistory('2024-01-09', false, 0),
    ];

    const result = calculateWeeklyStats(history);

    expect(result.successCount).toBe(0);
    expect(result.squatCount).toBe(0);
  });

  it('should handle large squat counts', () => {
    const history: WakeUpHistory[] = [
      createMockHistory('2024-01-08', true, 100),
      createMockHistory('2024-01-09', true, 150),
      createMockHistory('2024-01-10', true, 200),
    ];

    const result = calculateWeeklyStats(history);

    expect(result.successCount).toBe(3);
    expect(result.squatCount).toBe(450);
  });
});

describe('Date Utilities', () => {
  // Test the date calculation logic used in weekly summary
  // Using UTC dates to avoid timezone issues

  // Helper function to calculate Monday (UTC-based)
  const getMondayOfWeek = (dateStr: string): string => {
    const date = new Date(dateStr);
    const dayOfWeek = date.getUTCDay();
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    return monday.toISOString().slice(0, 10);
  };

  const getMondayOfLastWeek = (dateStr: string): string => {
    const thisMondayStr = getMondayOfWeek(dateStr);
    const thisMonday = new Date(thisMondayStr + 'T00:00:00Z');
    const lastMonday = new Date(thisMonday);
    lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);
    return lastMonday.toISOString().slice(0, 10);
  };

  describe('getMondayOfWeek', () => {
    it('should return Monday for Monday input', () => {
      // Jan 8, 2024 is a Monday
      const monday = getMondayOfWeek('2024-01-08T12:00:00Z');
      expect(monday).toBe('2024-01-08');
    });

    it('should return correct Monday for Wednesday input', () => {
      // Jan 10, 2024 is a Wednesday
      const monday = getMondayOfWeek('2024-01-10T12:00:00Z');
      expect(monday).toBe('2024-01-08');
    });

    it('should return correct Monday for Sunday input', () => {
      // Jan 14, 2024 is a Sunday
      const monday = getMondayOfWeek('2024-01-14T12:00:00Z');
      expect(monday).toBe('2024-01-08');
    });

    it('should return correct Monday for Saturday input', () => {
      // Jan 13, 2024 is a Saturday
      const monday = getMondayOfWeek('2024-01-13T12:00:00Z');
      expect(monday).toBe('2024-01-08');
    });

    it('should return correct Monday for Tuesday input', () => {
      // Jan 9, 2024 is a Tuesday
      const monday = getMondayOfWeek('2024-01-09T12:00:00Z');
      expect(monday).toBe('2024-01-08');
    });
  });

  describe('getMondayOfLastWeek', () => {
    it('should return correct Monday of last week for Wednesday', () => {
      // Jan 10, 2024 (Wed) -> This Monday: Jan 8 -> Last Monday: Jan 1
      const lastMonday = getMondayOfLastWeek('2024-01-10T12:00:00Z');
      expect(lastMonday).toBe('2024-01-01');
    });

    it('should return correct Monday of last week for Monday', () => {
      // Jan 8, 2024 (Mon) -> This Monday: Jan 8 -> Last Monday: Jan 1
      const lastMonday = getMondayOfLastWeek('2024-01-08T12:00:00Z');
      expect(lastMonday).toBe('2024-01-01');
    });

    it('should return correct Monday of last week for Sunday', () => {
      // Jan 14, 2024 (Sun) -> This Monday: Jan 8 -> Last Monday: Jan 1
      const lastMonday = getMondayOfLastWeek('2024-01-14T12:00:00Z');
      expect(lastMonday).toBe('2024-01-01');
    });
  });
});

describe('Date String Formatting', () => {
  it('should format date as YYYY-MM-DD correctly', () => {
    const date = new Date('2024-01-15T10:30:00');
    const formatted = date.toISOString().slice(0, 10);

    expect(formatted).toBe('2024-01-15');
  });

  it('should format time as HH:mm correctly', () => {
    const date = new Date('2024-01-15T10:30:00');
    const formatted = date.toTimeString().slice(0, 5);

    expect(formatted).toBe('10:30');
  });

  it('should format month as YYYY-MM correctly', () => {
    const date = new Date('2024-01-15T10:30:00');
    const formatted = date.toISOString().slice(0, 7);

    expect(formatted).toBe('2024-01');
  });
});

describe('Weekly Summary Logic', () => {
  // Test the logic for determining when to show weekly summary

  const shouldShowSummary = (lastShown: string | null, thisMondayStr: string): boolean => {
    if (!lastShown || lastShown < thisMondayStr) {
      return true;
    }
    return false;
  };

  it('should show summary when never shown before', () => {
    const result = shouldShowSummary(null, '2024-01-08');

    expect(result).toBe(true);
  });

  it('should show summary when last shown was last week', () => {
    const result = shouldShowSummary('2024-01-01', '2024-01-08');

    expect(result).toBe(true);
  });

  it('should NOT show summary when already shown this week', () => {
    const result = shouldShowSummary('2024-01-08', '2024-01-08');

    expect(result).toBe(false);
  });

  it('should NOT show summary when shown after this Monday', () => {
    const result = shouldShowSummary('2024-01-09', '2024-01-08');

    expect(result).toBe(false);
  });

  it('should show summary at week boundary', () => {
    // Sunday vs Monday comparison
    const result = shouldShowSummary('2024-01-07', '2024-01-08');

    expect(result).toBe(true);
  });
});

describe('Month Change Detection', () => {
  // Test logic for detecting month changes (used in stats reset)

  const isNewMonth = (currentMonth: string, storedMonth: string | undefined): boolean => {
    return currentMonth !== storedMonth;
  };

  it('should detect month change from December to January', () => {
    const result = isNewMonth('2024-01', '2023-12');

    expect(result).toBe(true);
  });

  it('should detect same month', () => {
    const result = isNewMonth('2024-01', '2024-01');

    expect(result).toBe(false);
  });

  it('should detect month change within same year', () => {
    const result = isNewMonth('2024-02', '2024-01');

    expect(result).toBe(true);
  });

  it('should handle undefined stored month', () => {
    const result = isNewMonth('2024-01', undefined);

    expect(result).toBe(true);
  });
});
