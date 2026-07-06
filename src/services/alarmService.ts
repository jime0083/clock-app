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
import { doc, getDoc, getDocFromServer, Timestamp } from 'firebase/firestore';
import { evaluateAlarmWindow, extractAlarmWindowState } from './alarmWindow';
import i18n from '@/locales';
import { logger } from '@/utils/logger';

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
    logger.log('[Alarm] handleAlarmTriggered called, current state:', this.alarmState);

    const wasAlreadyRinging = this.alarmState === 'ringing';

    // Always trigger callback for UI sync, even if already ringing
    if (wasAlreadyRinging) {
      logger.log('[Alarm] Already ringing, but still triggering callback for UI sync');
      // Just trigger callback to ensure UI is updated
      if (this.onAlarmTriggeredCallback) {
        logger.log('[Alarm] Triggering UI callback (sync)');
        this.onAlarmTriggeredCallback();
      }
      return;
    }

    this.alarmState = 'ringing';
    this.pendingAlarmFromNotification = true;
    logger.log('[Alarm] State set to ringing');

    // Tell the server the squat screen is showing so it stops re-alerting
    // (Problem 43). Fire-and-forget so the alarm sound is not delayed.
    if (this.currentUserId) {
      updateUserDocument(this.currentUserId, {
        alarmAcknowledgedAt: Timestamp.now(),
      }).catch(error => {
        console.error('[Alarm] Error recording alarmAcknowledgedAt:', error);
      });
    }

    // Cancel repeat notifications since alarm was acknowledged
    await cancelAlarmRepeatNotifications();

    // Play alarm sound
    await this.startAlarmSound();

    // Trigger callback to notify UI
    if (this.onAlarmTriggeredCallback) {
      logger.log('[Alarm] Triggering UI callback');
      this.onAlarmTriggeredCallback();
    }
  }

  /**
   * Resolve the configured alarm sound and start looping playback
   */
  private async startAlarmSound(): Promise<void> {
    // Get user settings for custom alarm sound
    let customSound: string | null = null;
    if (this.currentUserId) {
      logger.log('[Alarm] Getting user settings for userId:', this.currentUserId);
      try {
        const userData = await getUserDocument(this.currentUserId);
        customSound = userData?.settings?.customAlarmSound || null;
        logger.log('[Alarm] Custom sound:', customSound);
      } catch (error) {
        console.error('[Alarm] Error getting user settings:', error);
      }
    } else {
      console.warn('[Alarm] No currentUserId set');
    }

    logger.log('[Alarm] Playing alarm sound...');
    await audioService.playAlarmSound(customSound, true);
    logger.log('[Alarm] Alarm sound play requested');
  }

  /**
   * Restart the loop alarm sound if the alarm is ringing but no sound is
   * playing. The audio session can fail to activate while the app is still
   * transitioning to the foreground (Problem 42) — calling this once the app
   * is active recovers the sound.
   */
  async ensureAlarmSoundPlaying(): Promise<void> {
    if (this.alarmState !== 'ringing' || audioService.getIsPlaying()) {
      return;
    }
    logger.log('[Alarm] Alarm is ringing but sound is not playing — restarting sound');
    await this.startAlarmSound();
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

      await scheduleAlarmNotification(config.alarmTime, config.alarmDays, title, body);

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

    // Re-schedule the local backup notifications: the alarm was handled, so
    // this week's backup (alarm time + 1 min) must not fire — rescheduling
    // moves every backup to its next occurrence
    await this.rescheduleLocalBackup();
  }

  /**
   * Re-schedule local backup notifications from the saved user settings
   */
  private async rescheduleLocalBackup(): Promise<void> {
    if (!this.currentUserId) {
      return;
    }

    try {
      const userData = await getUserDocument(this.currentUserId);
      const alarmTime = userData?.settings?.alarmTime;
      if (!alarmTime) {
        return;
      }

      await this.scheduleAlarm({
        alarmTime,
        alarmDays: userData?.settings?.alarmDays || [],
        customAlarmSound: userData?.settings?.customAlarmSound || null,
      });
    } catch (error) {
      console.error('[Alarm] Error rescheduling local backup:', error);
    }
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
   * Check if we're within the alarm window (5 minutes from the alarm occurrence).
   * Judged by evaluateAlarmWindow: the alarm schedule itself (primary) plus the
   * server-recorded lastAlarmSentAt (secondary). Returns true if the squat
   * screen should be shown.
   */
  async checkAlarmWindow(): Promise<boolean> {
    if (!this.currentUserId) {
      logger.log('[Alarm] checkAlarmWindow: No userId');
      return false;
    }

    try {
      const userDocRef = doc(db, 'users', this.currentUserId);
      // Read from the server first: the server writes lastAlarmSentAt while the app is
      // terminated/backgrounded, so the local cache can be stale on icon launch / background
      // resume, causing this check to miss a live alarm window. Fall back to cache only if
      // the network read fails (offline), so we still surface the screen when possible.
      let userDoc;
      try {
        userDoc = await getDocFromServer(userDocRef);
      } catch (serverError) {
        logger.log(
          '[Alarm] checkAlarmWindow: server read failed, falling back to cache:',
          serverError
        );
        userDoc = await getDoc(userDocRef);
      }

      if (!userDoc.exists()) {
        logger.log('[Alarm] checkAlarmWindow: User document not found');
        return false;
      }

      const state = extractAlarmWindowState(userDoc.data());
      const withinWindow = evaluateAlarmWindow(state, Date.now());

      logger.log(
        '[Alarm] checkAlarmWindow: source=',
        userDoc.metadata?.fromCache ? 'cache' : 'server',
        'userId=',
        this.currentUserId,
        'alarmTime=',
        state.alarmTime,
        'hasLastAlarmSentAt=',
        state.lastAlarmSentAt !== null,
        'hasSquatCompletedAt=',
        state.squatCompletedAt !== null,
        'withinWindow=',
        withinWindow
      );

      return withinWindow;
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
      logger.log('[Alarm] Squat completion recorded');

      // Stop the alarm
      await this.stopAlarm();
    } catch (error) {
      console.error('[Alarm] Error recording squat completion:', error);
    }
  }

  /**
   * Record alarm failure (squats not completed within the time limit) in Firestore
   * The server (checkSquatCompletion) posts the penalty tweet based on this record
   */
  async recordAlarmFailure(): Promise<void> {
    if (!this.currentUserId) {
      console.warn('[Alarm] recordAlarmFailure: No userId');
      return;
    }

    try {
      await updateUserDocument(this.currentUserId, {
        alarmFailedAt: Timestamp.now(),
      });
      logger.log('[Alarm] Alarm failure recorded');

      // Stop the alarm
      await this.stopAlarm();
    } catch (error) {
      console.error('[Alarm] Error recording alarm failure:', error);
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
