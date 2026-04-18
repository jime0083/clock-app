// NOTE: AppState listener is now managed by App.tsx to avoid dual listener issues
import {
  requestNotificationPermissions,
  scheduleAlarmNotification,
  scheduleAlarmRepeatNotifications,
  cancelAlarmRepeatNotifications,
  cancelAllAlarmNotifications,
  dismissAllNotifications,
  setForegroundEventHandler,
  getInitialNotification,
  setNotificationCategories,
} from './notificationService';
import { audioService } from './audioService';
import { getUserDocument, updateUserDocument } from './userService';
import { db } from './firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import i18n from '@/locales';

// Time window for squat screen display (5 minutes in milliseconds)
const SQUAT_WINDOW_MS = 5 * 60 * 1000;

// Types
export interface AlarmConfig {
  alarmTime: string; // "HH:mm" format
  alarmDays: number[]; // 0-6 (0 = Sunday)
  customAlarmSound: string | null;
}

export type AlarmCallback = () => void;

// Alarm state type
export type AlarmState = 'idle' | 'ringing' | 'snoozed';

class AlarmService {
  private isInitialized = false;
  // NOTE: AppState listener is now managed by App.tsx
  private onAlarmTriggeredCallback: AlarmCallback | null = null;
  private currentUserId: string | null = null;
  private alarmState: AlarmState = 'idle';
  private pendingAlarmFromNotification = false;

  /**
   * Initialize the alarm service
   */
  async initialize(userId: string): Promise<boolean> {
    if (this.isInitialized) {
      // Even if already initialized, check for pending alarm from notification
      await this.checkLaunchNotification();
      return true;
    }

    this.currentUserId = userId;

    // Request notification permissions
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn('Notification permissions not granted');
      return false;
    }

    // Set up notification categories for iOS
    await setNotificationCategories();

    // Set up foreground event handler
    this.setupForegroundEventHandler();

    // NOTE: AppState listener is now handled by App.tsx to avoid dual listener issues

    // Check if app was launched from notification
    await this.checkLaunchNotification();

    this.isInitialized = true;
    return true;
  }

  /**
   * Get current alarm state
   */
  getAlarmState(): AlarmState {
    return this.alarmState;
  }

  /**
   * Check if there's a pending alarm from notification launch
   */
  hasPendingAlarm(): boolean {
    return this.pendingAlarmFromNotification;
  }

  /**
   * Clear pending alarm flag (call after showing squat screen)
   */
  clearPendingAlarm(): void {
    this.pendingAlarmFromNotification = false;
  }

  /**
   * Set up foreground event handler using notifee
   */
  private setupForegroundEventHandler(): void {
    setForegroundEventHandler(
      // onAlarmTriggered
      async () => {
        await this.handleAlarmTriggered();
      },
      // onSnooze
      async () => {
        await this.snoozeAlarm(5);
      },
      // onDismiss
      async () => {
        await this.stopAlarm();
      }
    );
  }

  // NOTE: AppState listener is now handled by App.tsx to avoid dual listener issues.
  // App.tsx calls checkAlarmWindow() directly and manages UI state.

  /**
   * Check if app was launched from an alarm notification
   */
  private async checkLaunchNotification(): Promise<void> {
    try {
      const initialNotification = await getInitialNotification();

      if (initialNotification?.notification?.data?.type === 'alarm') {
        // Mark that we have a pending alarm from notification
        this.pendingAlarmFromNotification = true;
        await this.handleAlarmTriggered();
      }
    } catch (error) {
      console.error('Error checking launch notification:', error);
    }
  }

  /**
   * Handle alarm triggered event
   */
  private async handleAlarmTriggered(): Promise<void> {
    console.log('[Alarm] handleAlarmTriggered called, current state:', this.alarmState);

    const wasAlreadyRinging = this.alarmState === 'ringing';

    // Always trigger callback for UI sync, even if already ringing
    if (wasAlreadyRinging) {
      console.log('[Alarm] Already ringing, but still triggering callback for UI sync');
      // Just trigger callback to ensure UI is updated
      if (this.onAlarmTriggeredCallback) {
        console.log('[Alarm] Triggering UI callback (sync)');
        this.onAlarmTriggeredCallback();
      }
      return;
    }

    this.alarmState = 'ringing';
    this.pendingAlarmFromNotification = true;
    console.log('[Alarm] State set to ringing');

    // Cancel repeat notifications since alarm was acknowledged
    await cancelAlarmRepeatNotifications();

    // Get user settings for custom alarm sound
    let customSound: string | null = null;
    if (this.currentUserId) {
      console.log('[Alarm] Getting user settings for userId:', this.currentUserId);
      try {
        const userData = await getUserDocument(this.currentUserId);
        customSound = userData?.settings?.customAlarmSound || null;
        console.log('[Alarm] Custom sound:', customSound);
      } catch (error) {
        console.error('[Alarm] Error getting user settings:', error);
      }
    } else {
      console.warn('[Alarm] No currentUserId set');
    }

    // Play alarm sound
    console.log('[Alarm] Playing alarm sound...');
    await audioService.playAlarmSound(customSound, true);
    console.log('[Alarm] Alarm sound play requested');

    // Trigger callback to notify UI
    if (this.onAlarmTriggeredCallback) {
      console.log('[Alarm] Triggering UI callback');
      this.onAlarmTriggeredCallback();
    }
  }

  /**
   * Set callback for when alarm is triggered
   */
  setOnAlarmTriggered(callback: AlarmCallback): void {
    this.onAlarmTriggeredCallback = callback;
  }

  /**
   * Schedule alarm based on user settings
   */
  async scheduleAlarm(config: AlarmConfig): Promise<boolean> {
    if (!config.alarmTime) {
      return false;
    }

    try {
      const title = i18n.t('notification.alarmTitle');
      const body = i18n.t('notification.alarmBody');

      await scheduleAlarmNotification(
        config.alarmTime,
        config.alarmDays,
        title,
        body
      );

      return true;
    } catch (error) {
      console.error('Error scheduling alarm:', error);
      return false;
    }
  }

  /**
   * Cancel all scheduled alarms
   */
  async cancelAlarm(): Promise<void> {
    await cancelAllAlarmNotifications();
  }

  /**
   * Stop the currently playing alarm
   */
  async stopAlarm(): Promise<void> {
    this.alarmState = 'idle';
    this.pendingAlarmFromNotification = false;
    await audioService.stopAlarmSound();
    await cancelAlarmRepeatNotifications();
    await dismissAllNotifications();
  }

  /**
   * Snooze the alarm for a specified number of minutes
   */
  async snoozeAlarm(minutes: number): Promise<void> {
    this.alarmState = 'snoozed';
    this.pendingAlarmFromNotification = false;
    await audioService.stopAlarmSound();
    await cancelAlarmRepeatNotifications();
    await dismissAllNotifications();

    // Schedule repeat notifications for snooze (will be handled by background handler)
    const title = i18n.t('notification.alarmTitle');
    const body = i18n.t('notification.alarmBody');
    await scheduleAlarmRepeatNotifications(title, body);
  }

  /**
   * Update alarm schedule with new settings
   */
  async updateAlarm(config: AlarmConfig): Promise<boolean> {
    await this.cancelAlarm();
    return this.scheduleAlarm(config);
  }

  /**
   * Check if alarm sound is currently playing
   */
  isAlarmPlaying(): boolean {
    return audioService.getIsPlaying();
  }

  /**
   * Trigger alarm from FCM notification
   * Called when FCM alarm notification is received
   */
  async triggerAlarmFromFCM(): Promise<void> {
    await this.handleAlarmTriggered();
  }

  /**
   * Check if we're within the alarm window (5 minutes from lastAlarmSentAt)
   * Returns true if squat screen should be shown
   */
  async checkAlarmWindow(): Promise<boolean> {
    if (!this.currentUserId) {
      console.log('[Alarm] checkAlarmWindow: No userId');
      return false;
    }

    try {
      const userDocRef = doc(db, 'users', this.currentUserId);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        console.log('[Alarm] checkAlarmWindow: User document not found');
        return false;
      }

      const userData = userDoc.data();
      const lastAlarmSentAt = userData?.lastAlarmSentAt;
      const squatCompletedAt = userData?.squatCompletedAt;

      if (!lastAlarmSentAt) {
        console.log('[Alarm] checkAlarmWindow: No lastAlarmSentAt');
        return false;
      }

      // Convert Firestore Timestamp to milliseconds
      const alarmTime = lastAlarmSentAt instanceof Timestamp
        ? lastAlarmSentAt.toMillis()
        : new Date(lastAlarmSentAt).getTime();

      const now = Date.now();
      const timeSinceAlarm = now - alarmTime;

      console.log('[Alarm] checkAlarmWindow: timeSinceAlarm =', timeSinceAlarm, 'ms');

      // Check if within 5-minute window
      if (timeSinceAlarm > SQUAT_WINDOW_MS) {
        console.log('[Alarm] checkAlarmWindow: Outside 5-minute window');
        return false;
      }

      // Check if squats already completed for this alarm
      if (squatCompletedAt) {
        const completedTime = squatCompletedAt instanceof Timestamp
          ? squatCompletedAt.toMillis()
          : new Date(squatCompletedAt).getTime();

        // If squats were completed after this alarm was sent, don't show again
        if (completedTime > alarmTime) {
          console.log('[Alarm] checkAlarmWindow: Squats already completed');
          return false;
        }
      }

      console.log('[Alarm] checkAlarmWindow: Within window, should show squat screen');
      return true;
    } catch (error) {
      console.error('[Alarm] checkAlarmWindow error:', error);
      return false;
    }
  }

  /**
   * Check alarm window and start loop alarm if within window
   * Call this when app comes to foreground
   */
  async checkAndStartAlarmIfNeeded(): Promise<boolean> {
    const shouldShowSquatScreen = await this.checkAlarmWindow();

    if (shouldShowSquatScreen) {
      // Start loop alarm
      this.pendingAlarmFromNotification = true;
      await this.handleAlarmTriggered();
      return true;
    }

    return false;
  }

  /**
   * Record squat completion in Firestore
   * Call this when user completes 10 squats
   */
  async recordSquatCompletion(): Promise<void> {
    if (!this.currentUserId) {
      console.warn('[Alarm] recordSquatCompletion: No userId');
      return;
    }

    try {
      await updateUserDocument(this.currentUserId, {
        squatCompletedAt: Timestamp.now(),
      });
      console.log('[Alarm] Squat completion recorded');

      // Stop the alarm
      await this.stopAlarm();
    } catch (error) {
      console.error('[Alarm] Error recording squat completion:', error);
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    // NOTE: AppState listener is now managed by App.tsx
    this.isInitialized = false;
  }
}

// Export singleton instance
export const alarmService = new AlarmService();
