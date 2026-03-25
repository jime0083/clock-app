import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  requestNotificationPermissions,
  scheduleAlarmNotification,
  cancelAllAlarmNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  getLastNotificationResponse,
  dismissAllNotifications,
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

class AlarmService {
  private isInitialized = false;
  private notificationSubscription: Notifications.Subscription | null = null;
  private responseSubscription: Notifications.Subscription | null = null;
  private appStateSubscription: any = null;
  private onAlarmTriggeredCallback: AlarmCallback | null = null;
  private currentUserId: string | null = null;

  /**
   * Initialize the alarm service
   */
  async initialize(userId: string): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    this.currentUserId = userId;

    // Request notification permissions
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn('Notification permissions not granted');
      return false;
    }

    // Set up notification listeners
    this.setupNotificationListeners();

    // Set up app state listener
    this.setupAppStateListener();

    // Check if app was launched from notification
    await this.checkLaunchNotification();

    this.isInitialized = true;
    return true;
  }

  /**
   * Set up notification event listeners
   */
  private setupNotificationListeners(): void {
    // Listener for notifications received while app is in foreground
    this.notificationSubscription = addNotificationReceivedListener(
      async (notification) => {
        const data = notification.request.content.data;
        if (data?.type === 'alarm') {
          await this.handleAlarmTriggered();
        }
      }
    );

    // Listener for notification response (user interaction)
    this.responseSubscription = addNotificationResponseListener(
      async (response) => {
        const data = response.notification.request.content.data;
        if (data?.type === 'alarm') {
          const actionId = response.actionIdentifier;

          if (actionId === 'snooze') {
            // Snooze for 5 minutes
            await this.snoozeAlarm(5);
          } else {
            // User tapped notification or dismissed - trigger alarm
            await this.handleAlarmTriggered();
          }
        }
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
    const response = await getLastNotificationResponse();
    if (response?.notification.request.content.data?.type === 'alarm') {
      await this.handleAlarmTriggered();
    }
  }

  /**
   * Handle alarm triggered event
   */
  private async handleAlarmTriggered(): Promise<void> {
    // Dismiss all notifications
    await dismissAllNotifications();

    // Get user settings for custom alarm sound
    let customSound: string | null = null;
    if (this.currentUserId) {
      try {
        const userData = await getUserDocument(this.currentUserId);
        customSound = userData?.settings?.customAlarmSound || null;
      } catch (error) {
        console.error('Error getting user settings:', error);
      }
    }

    // Play alarm sound
    await audioService.playAlarmSound(customSound, true);

    // Trigger callback
    if (this.onAlarmTriggeredCallback) {
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
      const title = i18n.t('alarm.title');
      const body = i18n.t('squat.instruction');

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
    await audioService.stopAlarmSound();
    await dismissAllNotifications();
  }

  /**
   * Snooze the alarm for a specified number of minutes
   */
  async snoozeAlarm(minutes: number): Promise<void> {
    await this.stopAlarm();

    // Schedule a one-time notification for snooze
    const snoozeSeconds = minutes * 60;
    const title = i18n.t('alarm.title');
    const body = i18n.t('squat.instruction');

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: { type: 'alarm', isSnooze: true },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: snoozeSeconds,
      },
    });
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
   * Clean up resources
   */
  cleanup(): void {
    if (this.notificationSubscription) {
      this.notificationSubscription.remove();
      this.notificationSubscription = null;
    }
    if (this.responseSubscription) {
      this.responseSubscription.remove();
      this.responseSubscription = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.isInitialized = false;
  }
}

// Export singleton instance
export const alarmService = new AlarmService();
