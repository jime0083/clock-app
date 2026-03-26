import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLastWeekHistory, calculateWeeklyStats } from './historyService';

const LAST_SUMMARY_SHOWN_KEY = 'weekly_summary_last_shown';

interface WeeklySummary {
  successCount: number;
  squatCount: number;
  weekStart: string;
  weekEnd: string;
}

/**
 * Get Monday of the current week
 */
const getMondayOfCurrentWeek = (): Date => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

/**
 * Get Monday of last week
 */
const getMondayOfLastWeek = (): Date => {
  const thisMonday = getMondayOfCurrentWeek();
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  return lastMonday;
};

/**
 * Check if weekly summary should be shown
 * Returns true if it's a new week and summary hasn't been shown yet
 */
export const shouldShowWeeklySummary = async (): Promise<boolean> => {
  try {
    const lastShown = await AsyncStorage.getItem(LAST_SUMMARY_SHOWN_KEY);
    const thisMonday = getMondayOfCurrentWeek();
    const thisMondayStr = thisMonday.toISOString().slice(0, 10);

    // If never shown or shown before this week's Monday, show summary
    if (!lastShown || lastShown < thisMondayStr) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking weekly summary status:', error);
    return false;
  }
};

/**
 * Mark weekly summary as shown
 */
export const markWeeklySummaryShown = async (): Promise<void> => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    await AsyncStorage.setItem(LAST_SUMMARY_SHOWN_KEY, today);
  } catch (error) {
    console.error('Error marking weekly summary as shown:', error);
  }
};

/**
 * Get last week's summary data
 */
export const getWeeklySummary = async (uid: string): Promise<WeeklySummary | null> => {
  try {
    const history = await getLastWeekHistory(uid);

    // If no history, return null
    if (history.length === 0) {
      return null;
    }

    const stats = calculateWeeklyStats(history);
    const lastMonday = getMondayOfLastWeek();
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);

    return {
      successCount: stats.successCount,
      squatCount: stats.squatCount,
      weekStart: lastMonday.toISOString().slice(0, 10),
      weekEnd: lastSunday.toISOString().slice(0, 10),
    };
  } catch (error) {
    console.error('Error getting weekly summary:', error);
    return null;
  }
};

/**
 * Reset summary shown status (for testing)
 */
export const resetWeeklySummaryStatus = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(LAST_SUMMARY_SHOWN_KEY);
  } catch (error) {
    console.error('Error resetting weekly summary status:', error);
  }
};
