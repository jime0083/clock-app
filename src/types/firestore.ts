import { Timestamp } from 'firebase/firestore';

// ===== User Document =====

export interface UserProfile {
  createdAt: Timestamp;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface AlarmSettings {
  alarmTime: string | null; // "HH:mm" format
  alarmDays: number[]; // 0-6 (0 = Sunday)
  customAlarmSound: string | null; // Firebase Storage URL
}

export interface CalibrationData {
  peakThreshold: number;
  minSquatDuration: number;
  maxSquatDuration: number;
  calibratedAt: string; // ISO string
}

export interface UserSettings {
  alarmTime: string | null;
  alarmDays: number[];
  customAlarmSound: string | null;
  calibration: CalibrationData | null;
  language: 'ja' | 'en';
  setupCompleted: boolean;
}

export interface SNSConnection {
  connected: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  connectedAt: Timestamp | null;
  username: string | null;
}

export interface SNSConnections {
  x: SNSConnection;
  instagram?: SNSConnection; // Future implementation
}

export interface UserStats {
  totalFailures: number;
  monthlyFailures: number;
  currentMonth: string; // "YYYY-MM" format
  totalSquats: number;
  monthlySquats: number;
}

export interface SubscriptionStatus {
  isActive: boolean;
  plan: 'monthly' | 'yearly' | null;
  expiresAt: Timestamp | null;
  purchasedAt: Timestamp | null;
}

export interface UserDocument {
  profile: UserProfile;
  settings: UserSettings;
  snsConnections: SNSConnections;
  stats: UserStats;
  subscription: SubscriptionStatus;
}

// ===== History Document =====

export interface WakeUpHistory {
  date: string; // "YYYY-MM-DD" format
  alarmTime: string; // "HH:mm" format
  success: boolean;
  squatCount: number;
  completedAt: Timestamp | null;
  penaltyPosted: boolean;
  penaltyPostId: string | null;
}

// ===== Admin Users Collection =====

export interface AdminUser {
  uid: string;
  email: string;
  role: 'admin' | 'developer';
  createdAt: Timestamp;
}

// ===== Helper Types =====

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_NAMES: Record<DayOfWeek, string> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

// ===== Default Values =====

export const defaultUserSettings: UserSettings = {
  alarmTime: null,
  alarmDays: [],
  customAlarmSound: null,
  calibration: null,
  language: 'ja',
  setupCompleted: false,
};

export const defaultSNSConnection: SNSConnection = {
  connected: false,
  accessToken: null,
  refreshToken: null,
  connectedAt: null,
  username: null,
};

export const defaultUserStats: UserStats = {
  totalFailures: 0,
  monthlyFailures: 0,
  currentMonth: new Date().toISOString().slice(0, 7),
  totalSquats: 0,
  monthlySquats: 0,
};

export const defaultSubscriptionStatus: SubscriptionStatus = {
  isActive: false,
  plan: null,
  expiresAt: null,
  purchasedAt: null,
};
