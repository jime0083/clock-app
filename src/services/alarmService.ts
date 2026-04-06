import { AppState, AppStateStatus } from 'react-native';
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
import { getUserDocument } from './userService';
import i18n from '@/locales';

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
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
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

    // Set up app state listener
    this.setupAppStateListener();

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

  /**
   * Set up app state listener for background/foreground transitions
   */
  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange
    );
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange = async (nextAppState: AppStateStatus): Promise<void> => {
    if (nextAppState === 'active') {
      // App came to foreground - check for pending alarms
      await this.checkLaunchNotification();
    }
  };

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

    // Don't re-trigger if already ringing
    if (this.alarmState === 'ringing') {
      console.log('[Alarm] Already ringing, skipping');
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
   * Clean up resources
   */
  cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.isInitialized = false;
  }
}

// Export singleton instance
export const alarmService = new AlarmService();
