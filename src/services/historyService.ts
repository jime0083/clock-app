import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import { WakeUpHistory } from '@/types/firestore';

// ===== Wake Up History =====

export const getWakeUpHistory = async (
  uid: string,
  date: string
): Promise<WakeUpHistory | null> => {
  try {
    const historyRef = doc(db, 'users', uid, 'history', date);
    const historyDoc = await getDoc(historyRef);

    if (!historyDoc.exists()) {
      return null;
    }

    return historyDoc.data() as WakeUpHistory;
  } catch (error) {
    console.error('Error getting wake up history:', error);
    throw error;
  }
};

export const createWakeUpHistory = async (
  uid: string,
  history: WakeUpHistory
): Promise<void> => {
  try {
    const historyRef = doc(db, 'users', uid, 'history', history.date);
    await setDoc(historyRef, history);
  } catch (error) {
    console.error('Error creating wake up history:', error);
    throw error;
  }
};

export const updateWakeUpHistory = async (
  uid: string,
  date: string,
  updates: Partial<WakeUpHistory>
): Promise<void> => {
  try {
    const historyRef = doc(db, 'users', uid, 'history', date);
    await updateDoc(historyRef, updates);
  } catch (error) {
    console.error('Error updating wake up history:', error);
    throw error;
  }
};

export const recordWakeUpSuccess = async (
  uid: string,
  alarmTime: string,
  squatCount: number
): Promise<void> => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const history: WakeUpHistory = {
      date: today,
      alarmTime,
      success: true,
      squatCount,
      completedAt: Timestamp.now(),
      penaltyPosted: false,
      penaltyPostId: null,
    };
    await createWakeUpHistory(uid, history);
  } catch (error) {
    console.error('Error recording wake up success:', error);
    throw error;
  }
};

export const recordWakeUpFailure = async (
  uid: string,
  alarmTime: string,
  squatCount: number
): Promise<void> => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const history: WakeUpHistory = {
      date: today,
      alarmTime,
      success: false,
      squatCount,
      completedAt: Timestamp.now(),
      penaltyPosted: false,
      penaltyPostId: null,
    };
    await createWakeUpHistory(uid, history);
  } catch (error) {
    console.error('Error recording wake up failure:', error);
    throw error;
  }
};

export const updatePenaltyPostStatus = async (
  uid: string,
  date: string,
  posted: boolean,
  postId: string | null
): Promise<void> => {
  try {
    await updateWakeUpHistory(uid, date, {
      penaltyPosted: posted,
      penaltyPostId: postId,
    });
  } catch (error) {
    console.error('Error updating penalty post status:', error);
    throw error;
  }
};

/**
 * Record wake-up history and update user stats
 */
export const recordWakeUpHistory = async (
  uid: string,
  data: {
    success: boolean;
    squatCount: number;
  }
): Promise<string> => {
  try {
    const now = new Date();
    const dateString = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const timeString = now.toTimeString().slice(0, 5); // "HH:mm"
    const currentMonth = now.toISOString().slice(0, 7); // "YYYY-MM"

    // Create history document
    const history: WakeUpHistory = {
      date: dateString,
      alarmTime: timeString,
      success: data.success,
      squatCount: data.squatCount,
      completedAt: data.success ? Timestamp.now() : null,
      penaltyPosted: false,
      penaltyPostId: null,
    };

    await createWakeUpHistory(uid, history);

    // Update user stats
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      const statsUpdate: Record<string, any> = {
        'stats.totalSquats': increment(data.squatCount),
      };

      // Check if we need to reset monthly stats
      if (userData.stats?.currentMonth !== currentMonth) {
        // New month - reset monthly stats
        statsUpdate['stats.currentMonth'] = currentMonth;
        statsUpdate['stats.monthlyFailures'] = data.success ? 0 : 1;
        statsUpdate['stats.monthlySquats'] = data.squatCount;
      } else {
        // Same month - increment
        statsUpdate['stats.monthlySquats'] = increment(data.squatCount);
        if (!data.success) {
          statsUpdate['stats.monthlyFailures'] = increment(1);
        }
      }

      if (!data.success) {
        statsUpdate['stats.totalFailures'] = increment(1);
      }

      await updateDoc(userRef, statsUpdate);
    }

    return dateString;
  } catch (error) {
    console.error('Error recording wake-up history:', error);
    throw error;
  }
};

// ===== Statistics =====

export const getWeeklyHistory = async (uid: string): Promise<WakeUpHistory[]> => {
  try {
    // Get Monday of current week
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    const mondayStr = monday.toISOString().slice(0, 10);

    const historyRef = collection(db, 'users', uid, 'history');
    const q = query(historyRef, where('date', '>=', mondayStr), orderBy('date', 'asc'));

    const querySnapshot = await getDocs(q);
    const history: WakeUpHistory[] = [];

    querySnapshot.forEach(doc => {
      history.push(doc.data() as WakeUpHistory);
    });

    return history;
  } catch (error) {
    console.error('Error getting weekly history:', error);
    throw error;
  }
};

export const getLastWeekHistory = async (uid: string): Promise<WakeUpHistory[]> => {
  try {
    // Get Monday of last week
    const today = new Date();
    const dayOfWeek = today.getDay();
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);

    const lastSunday = new Date(thisMonday);
    lastSunday.setDate(thisMonday.getDate() - 1);

    const lastMondayStr = lastMonday.toISOString().slice(0, 10);
    const lastSundayStr = lastSunday.toISOString().slice(0, 10);

    const historyRef = collection(db, 'users', uid, 'history');
    const q = query(
      historyRef,
      where('date', '>=', lastMondayStr),
      where('date', '<=', lastSundayStr),
      orderBy('date', 'asc')
    );

    const querySnapshot = await getDocs(q);
    const history: WakeUpHistory[] = [];

    querySnapshot.forEach(doc => {
      history.push(doc.data() as WakeUpHistory);
    });

    return history;
  } catch (error) {
    console.error('Error getting last week history:', error);
    throw error;
  }
};

export const getMonthlyHistory = async (
  uid: string,
  yearMonth: string
): Promise<WakeUpHistory[]> => {
  try {
    const startDate = `${yearMonth}-01`;
    const [year, month] = yearMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${yearMonth}-${lastDay.toString().padStart(2, '0')}`;

    const historyRef = collection(db, 'users', uid, 'history');
    const q = query(
      historyRef,
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'asc')
    );

    const querySnapshot = await getDocs(q);
    const history: WakeUpHistory[] = [];

    querySnapshot.forEach(doc => {
      history.push(doc.data() as WakeUpHistory);
    });

    return history;
  } catch (error) {
    console.error('Error getting monthly history:', error);
    throw error;
  }
};

export const calculateWeeklyStats = (
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

export const getRecentHistory = async (
  uid: string,
  count: number = 7
): Promise<WakeUpHistory[]> => {
  try {
    const historyRef = collection(db, 'users', uid, 'history');
    const q = query(historyRef, orderBy('date', 'desc'), limit(count));

    const querySnapshot = await getDocs(q);
    const history: WakeUpHistory[] = [];

    querySnapshot.forEach(doc => {
      history.push(doc.data() as WakeUpHistory);
    });

    return history.reverse();
  } catch (error) {
    console.error('Error getting recent history:', error);
    throw error;
  }
};
