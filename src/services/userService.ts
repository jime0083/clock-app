import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  UserDocument,
  UserProfile,
  UserSettings,
  UserStats,
  SNSConnections,
  SubscriptionStatus,
  defaultUserSettings,
  defaultSNSConnection,
  defaultUserStats,
  defaultSubscriptionStatus,
} from '@/types/firestore';

// ===== User Profile =====

export const getUserDocument = async (uid: string): Promise<UserDocument | null> => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return null;
    }

    return userDoc.data() as UserDocument;
  } catch (error) {
    console.error('Error getting user document:', error);
    throw error;
  }
};

export const createUserDocument = async (
  uid: string,
  profile: Partial<UserProfile>
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    const now = Timestamp.now();

    const userDocument: UserDocument = {
      profile: {
        createdAt: now,
        email: profile.email || null,
        displayName: profile.displayName || null,
        photoURL: profile.photoURL || null,
      },
      settings: defaultUserSettings,
      snsConnections: {
        x: defaultSNSConnection,
      },
      stats: defaultUserStats,
      subscription: defaultSubscriptionStatus,
    };

    await setDoc(userRef, userDocument);
  } catch (error) {
    console.error('Error creating user document:', error);
    throw error;
  }
};

export const updateUserProfile = async (
  uid: string,
  profile: Partial<UserProfile>
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      'profile.email': profile.email,
      'profile.displayName': profile.displayName,
      'profile.photoURL': profile.photoURL,
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

// ===== User Settings =====

export const getUserSettings = async (uid: string): Promise<UserSettings | null> => {
  try {
    const userDoc = await getUserDocument(uid);
    return userDoc?.settings || null;
  } catch (error) {
    console.error('Error getting user settings:', error);
    throw error;
  }
};

export const updateUserSettings = async (
  uid: string,
  settings: Partial<UserSettings>
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    const updates: Record<string, unknown> = {};

    if (settings.alarmTime !== undefined) {
      updates['settings.alarmTime'] = settings.alarmTime;
    }
    if (settings.alarmDays !== undefined) {
      updates['settings.alarmDays'] = settings.alarmDays;
    }
    if (settings.customAlarmSound !== undefined) {
      updates['settings.customAlarmSound'] = settings.customAlarmSound;
    }
    if (settings.calibration !== undefined) {
      updates['settings.calibration'] = settings.calibration;
    }
    if (settings.language !== undefined) {
      updates['settings.language'] = settings.language;
    }

    await updateDoc(userRef, updates);
  } catch (error) {
    console.error('Error updating user settings:', error);
    throw error;
  }
};

// ===== User Stats =====

export const getUserStats = async (uid: string): Promise<UserStats | null> => {
  try {
    const userDoc = await getUserDocument(uid);
    return userDoc?.stats || null;
  } catch (error) {
    console.error('Error getting user stats:', error);
    throw error;
  }
};

export const updateUserStats = async (
  uid: string,
  stats: Partial<UserStats>
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    const updates: Record<string, unknown> = {};

    if (stats.totalFailures !== undefined) {
      updates['stats.totalFailures'] = stats.totalFailures;
    }
    if (stats.monthlyFailures !== undefined) {
      updates['stats.monthlyFailures'] = stats.monthlyFailures;
    }
    if (stats.currentMonth !== undefined) {
      updates['stats.currentMonth'] = stats.currentMonth;
    }
    if (stats.totalSquats !== undefined) {
      updates['stats.totalSquats'] = stats.totalSquats;
    }
    if (stats.monthlySquats !== undefined) {
      updates['stats.monthlySquats'] = stats.monthlySquats;
    }

    await updateDoc(userRef, updates);
  } catch (error) {
    console.error('Error updating user stats:', error);
    throw error;
  }
};

export const incrementSquatCount = async (uid: string, count: number): Promise<void> => {
  try {
    const userDoc = await getUserDocument(uid);
    if (!userDoc) return;

    const currentMonth = new Date().toISOString().slice(0, 7);
    const stats = userDoc.stats;

    // Reset monthly stats if month changed
    const newMonthlySquats =
      stats.currentMonth === currentMonth ? stats.monthlySquats + count : count;

    await updateUserStats(uid, {
      totalSquats: stats.totalSquats + count,
      monthlySquats: newMonthlySquats,
      currentMonth,
    });
  } catch (error) {
    console.error('Error incrementing squat count:', error);
    throw error;
  }
};

export const incrementFailureCount = async (uid: string): Promise<void> => {
  try {
    const userDoc = await getUserDocument(uid);
    if (!userDoc) return;

    const currentMonth = new Date().toISOString().slice(0, 7);
    const stats = userDoc.stats;

    // Reset monthly stats if month changed
    const newMonthlyFailures =
      stats.currentMonth === currentMonth ? stats.monthlyFailures + 1 : 1;

    await updateUserStats(uid, {
      totalFailures: stats.totalFailures + 1,
      monthlyFailures: newMonthlyFailures,
      currentMonth,
    });
  } catch (error) {
    console.error('Error incrementing failure count:', error);
    throw error;
  }
};

// ===== SNS Connections =====

export const updateXConnection = async (
  uid: string,
  connection: Partial<SNSConnections['x']>
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    const updates: Record<string, unknown> = {};

    if (connection.connected !== undefined) {
      updates['snsConnections.x.connected'] = connection.connected;
    }
    if (connection.accessToken !== undefined) {
      updates['snsConnections.x.accessToken'] = connection.accessToken;
    }
    if (connection.refreshToken !== undefined) {
      updates['snsConnections.x.refreshToken'] = connection.refreshToken;
    }
    if (connection.connectedAt !== undefined) {
      updates['snsConnections.x.connectedAt'] = connection.connectedAt;
    }
    if (connection.username !== undefined) {
      updates['snsConnections.x.username'] = connection.username;
    }

    await updateDoc(userRef, updates);
  } catch (error) {
    console.error('Error updating X connection:', error);
    throw error;
  }
};

export const disconnectX = async (uid: string): Promise<void> => {
  try {
    await updateXConnection(uid, {
      connected: false,
      accessToken: null,
      refreshToken: null,
      connectedAt: null,
      username: null,
    });
  } catch (error) {
    console.error('Error disconnecting X:', error);
    throw error;
  }
};

// ===== Subscription =====

export const getSubscriptionStatus = async (
  uid: string
): Promise<SubscriptionStatus | null> => {
  try {
    const userDoc = await getUserDocument(uid);
    return userDoc?.subscription || null;
  } catch (error) {
    console.error('Error getting subscription status:', error);
    throw error;
  }
};

export const updateSubscriptionStatus = async (
  uid: string,
  subscription: Partial<SubscriptionStatus>
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    const updates: Record<string, unknown> = {};

    if (subscription.isActive !== undefined) {
      updates['subscription.isActive'] = subscription.isActive;
    }
    if (subscription.plan !== undefined) {
      updates['subscription.plan'] = subscription.plan;
    }
    if (subscription.expiresAt !== undefined) {
      updates['subscription.expiresAt'] = subscription.expiresAt;
    }
    if (subscription.purchasedAt !== undefined) {
      updates['subscription.purchasedAt'] = subscription.purchasedAt;
    }

    await updateDoc(userRef, updates);
  } catch (error) {
    console.error('Error updating subscription status:', error);
    throw error;
  }
};
