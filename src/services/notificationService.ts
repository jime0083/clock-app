import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AndroidCategory,
  TriggerType,
  RepeatFrequency,
  TimestampTrigger,
  EventType,
  Event,
  AuthorizationStatus,
  InitialNotification,
} from '@notifee/react-native';
import { Platform } from 'react-native';

// Notification channel ID for Android
const ALARM_CHANNEL_ID = 'alarm-channel';

// Number of repeat notifications to schedule for alarm
const ALARM_REPEAT_COUNT = 10;
// Interval between repeat notifications (in seconds)
const ALARM_REPEAT_INTERVAL = 30;

/**
 * Create Android notification channel for alarms
 */
export const createAlarmChannel = async (): Promise<string> => {
  return notifee.createChannel({
    id: ALARM_CHANNEL_ID,
    name: 'Alarm',
    description: 'Wake up alarm notifications',
    importance: AndroidImportance.HIGH,
    vibration: true,
    vibrationPattern: [0, 500, 200, 500, 200, 500, 200, 500],
    lights: true,
    lightColor: '#FF6B35',
    sound: 'default',
    bypassDnd: true,
    visibility: AndroidVisibility.PUBLIC,
  });
};

/**
 * Request notification permissions
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  // Request permissions
  const settings = await notifee.requestPermission({
    sound: true,
    badge: true,
    alert: true,
    provisional: false,
  });

  if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) {
    console.warn('Notification permissions not granted');
    return false;
  }

  // Create Android notification channel
  if (Platform.OS === 'android') {
    await createAlarmChannel();

    // Request exact alarm permission for Android 12+
    const batteryOptimizationStatus = await notifee.isBatteryOptimizationEnabled();
    if (batteryOptimizationStatus) {
      // Prompt user to disable battery optimization for reliable alarms
      await notifee.openBatteryOptimizationSettings();
    }
  }

  return true;
};

/**
 * Check if notifications are enabled
 */
export const checkNotificationPermissions = async (): Promise<boolean> => {
  const settings = await notifee.getNotificationSettings();
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
};

/**
 * Get the next occurrence of a specific day and time
 */
const getNextOccurrence = (
  dayOfWeek: number, // 0-6 (0 = Sunday)
  hours: number,
  minutes: number
): Date => {
  const now = new Date();
  const targetDate = new Date();

  // Set the target time
  targetDate.setHours(hours, minutes, 0, 0);

  // Calculate days until target day
  const currentDay = now.getDay();
  let daysUntilTarget = dayOfWeek - currentDay;

  // If the target day is today but time has passed, or if the day is in the past this week
  if (daysUntilTarget < 0 || (daysUntilTarget === 0 && targetDate <= now)) {
    daysUntilTarget += 7;
  }

  targetDate.setDate(targetDate.getDate() + daysUntilTarget);

  return targetDate;
};

/**
 * Schedule alarm notifications with Full-screen Intent for Android
 */
export const scheduleAlarmNotification = async (
  alarmTime: string, // "HH:mm" format
  alarmDays: number[], // 0-6 (0 = Sunday)
  title: string,
  body: string
): Promise<string[]> => {
  // Cancel existing alarms first
  await cancelAllAlarmNotifications();

  const notificationIds: string[] = [];

  // Parse alarm time
  const [hours, minutes] = alarmTime.split(':').map(Number);

  // If no specific days selected, schedule for every day
  const daysToSchedule = alarmDays.length > 0 ? alarmDays : [0, 1, 2, 3, 4, 5, 6];

  for (const day of daysToSchedule) {
    const triggerDate = getNextOccurrence(day, hours, minutes);

    // Create timestamp trigger
    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: triggerDate.getTime(),
      repeatFrequency: RepeatFrequency.WEEKLY,
      alarmManager: {
        allowWhileIdle: true, // Fire even in Doze mode
      },
    };

    // Schedule notification with Full-screen Intent for Android
    const notificationId = await notifee.createTriggerNotification(
      {
        id: `alarm-${day}`,
        title,
        body,
        data: {
          type: 'alarm',
          alarmTime,
          day: day.toString(),
          isMainAlarm: 'true',
        },
        android: {
          channelId: ALARM_CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          category: AndroidCategory.ALARM,
          visibility: AndroidVisibility.PUBLIC,
          fullScreenAction: {
            id: 'default',
            mainComponent: 'main', // Opens app's main component
          },
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
          actions: [
            {
              title: 'Snooze 5min',
              pressAction: {
                id: 'snooze',
              },
            },
            {
              title: 'Dismiss',
              pressAction: {
                id: 'dismiss',
              },
            },
          ],
          sound: 'default',
          vibrationPattern: [0, 500, 200, 500, 200, 500],
          lights: ['#FF6B35', 300, 600],
          autoCancel: false,
          ongoing: true, // Keep notification visible
        },
        ios: {
          sound: 'default',
          interruptionLevel: 'timeSensitive',
          categoryId: 'alarm',
        },
      },
      trigger
    );

    notificationIds.push(notificationId);
  }

  return notificationIds;
};

/**
 * Schedule immediate repeat notifications when alarm fires
 */
export const scheduleAlarmRepeatNotifications = async (
  title: string,
  body: string
): Promise<string[]> => {
  const notificationIds: string[] = [];
  const now = Date.now();

  for (let i = 1; i <= ALARM_REPEAT_COUNT; i++) {
    const triggerTimestamp = now + i * ALARM_REPEAT_INTERVAL * 1000;

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: triggerTimestamp,
      alarmManager: {
        allowWhileIdle: true,
      },
    };

    const notificationId = await notifee.createTriggerNotification(
      {
        id: `alarm-repeat-${i}`,
        title,
        body: `${body} (${i})`,
        data: {
          type: 'alarm',
          isRepeat: 'true',
          repeatIndex: i.toString(),
        },
        android: {
          channelId: ALARM_CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          category: AndroidCategory.ALARM,
          fullScreenAction: {
            id: 'default',
            mainComponent: 'main',
          },
          sound: 'default',
          vibrationPattern: [0, 500, 200, 500, 200, 500],
          autoCancel: false,
          ongoing: true,
        },
        ios: {
          sound: 'default',
          interruptionLevel: 'timeSensitive',
        },
      },
      trigger
    );

    notificationIds.push(notificationId);
  }

  return notificationIds;
};

/**
 * Cancel all repeat notifications
 */
export const cancelAlarmRepeatNotifications = async (): Promise<void> => {
  const triggers = await notifee.getTriggerNotificationIds();

  for (const id of triggers) {
    if (id.startsWith('alarm-repeat-')) {
      await notifee.cancelTriggerNotification(id);
    }
  }

  // Also cancel any displayed repeat notifications
  const displayed = await notifee.getDisplayedNotifications();
  for (const notification of displayed) {
    if (notification.id?.startsWith('alarm-repeat-')) {
      await notifee.cancelNotification(notification.id);
    }
  }
};

/**
 * Cancel all scheduled alarm notifications
 */
export const cancelAllAlarmNotifications = async (): Promise<void> => {
  await notifee.cancelAllNotifications();
  await notifee.cancelTriggerNotifications();
};

/**
 * Cancel a specific notification by ID
 */
export const cancelNotification = async (notificationId: string): Promise<void> => {
  await notifee.cancelNotification(notificationId);
};

/**
 * Get all scheduled notifications
 */
export const getScheduledNotifications = async (): Promise<string[]> => {
  return notifee.getTriggerNotificationIds();
};

/**
 * Dismiss all displayed notifications
 */
export const dismissAllNotifications = async (): Promise<void> => {
  await notifee.cancelAllNotifications();
};

/**
 * Set up foreground event handler
 */
export const setForegroundEventHandler = (
  onAlarmTriggered: () => void,
  onSnooze: () => void,
  onDismiss: () => void
): void => {
  notifee.onForegroundEvent(({ type, detail }: Event) => {
    const { notification, pressAction } = detail;

    if (notification?.data?.type !== 'alarm') {
      return;
    }

    switch (type) {
      case EventType.DELIVERED:
        // Alarm notification delivered
        onAlarmTriggered();
        break;

      case EventType.PRESS:
        // User pressed notification
        onAlarmTriggered();
        break;

      case EventType.ACTION_PRESS:
        if (pressAction?.id === 'snooze') {
          onSnooze();
        } else if (pressAction?.id === 'dismiss') {
          onDismiss();
        }
        break;
    }
  });
};

/**
 * Set up background event handler
 * This must be called outside of React component lifecycle
 */
export const setBackgroundEventHandler = (): void => {
  notifee.onBackgroundEvent(async ({ type, detail }: Event) => {
    const { notification, pressAction } = detail;

    if (notification?.data?.type !== 'alarm') {
      return;
    }

    switch (type) {
      case EventType.PRESS:
        // User pressed notification - app will open
        // The foreground handler will take over
        break;

      case EventType.ACTION_PRESS:
        if (pressAction?.id === 'snooze') {
          // Schedule snooze notification
          const snoozeTimestamp = Date.now() + 5 * 60 * 1000; // 5 minutes
          const trigger: TimestampTrigger = {
            type: TriggerType.TIMESTAMP,
            timestamp: snoozeTimestamp,
            alarmManager: {
              allowWhileIdle: true,
            },
          };

          await notifee.createTriggerNotification(
            {
              id: 'alarm-snooze',
              title: notification?.title || 'Alarm',
              body: notification?.body || 'Time to wake up!',
              data: {
                type: 'alarm',
                isSnooze: 'true',
                isMainAlarm: 'true',
              },
              android: {
                channelId: ALARM_CHANNEL_ID,
                importance: AndroidImportance.HIGH,
                category: AndroidCategory.ALARM,
                fullScreenAction: {
                  id: 'default',
                  mainComponent: 'main',
                },
                sound: 'default',
                vibrationPattern: [0, 500, 200, 500, 200, 500],
                autoCancel: false,
                ongoing: true,
              },
              ios: {
                sound: 'default',
                interruptionLevel: 'timeSensitive',
              },
            },
            trigger
          );

          // Cancel the current notification
          if (notification?.id) {
            await notifee.cancelNotification(notification.id);
          }
        } else if (pressAction?.id === 'dismiss') {
          // Cancel all alarm notifications
          await cancelAlarmRepeatNotifications();
          if (notification?.id) {
            await notifee.cancelNotification(notification.id);
          }
        }
        break;
    }
  });
};

/**
 * Get initial notification (when app is launched from notification)
 */
export const getInitialNotification = async (): Promise<InitialNotification | null> => {
  return notifee.getInitialNotification();
};

/**
 * Schedule a one-time alarm notification (for testing)
 */
export const scheduleOneTimeAlarm = async (
  secondsFromNow: number,
  title: string,
  body: string
): Promise<string> => {
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: Date.now() + secondsFromNow * 1000,
    alarmManager: {
      allowWhileIdle: true,
    },
  };

  return notifee.createTriggerNotification(
    {
      id: 'alarm-test',
      title,
      body,
      data: {
        type: 'alarm',
        isTest: 'true',
        isMainAlarm: 'true',
      },
      android: {
        channelId: ALARM_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        category: AndroidCategory.ALARM,
        fullScreenAction: {
          id: 'default',
          mainComponent: 'main',
        },
        sound: 'default',
        vibrationPattern: [0, 500, 200, 500, 200, 500],
        autoCancel: false,
        ongoing: true,
      },
      ios: {
        sound: 'default',
        interruptionLevel: 'timeSensitive',
      },
    },
    trigger
  );
};

/**
 * Display an immediate notification
 */
export const displayImmediateNotification = async (
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<string> => {
  return notifee.displayNotification({
    title,
    body,
    data,
    android: {
      channelId: ALARM_CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      sound: 'default',
    },
    ios: {
      sound: 'default',
    },
  });
};

/**
 * Schedule a success notification (squats completed)
 */
export const scheduleSuccessNotification = async (
  title: string,
  body: string
): Promise<void> => {
  await notifee.displayNotification({
    title,
    body,
    data: { type: 'success' },
    android: {
      channelId: ALARM_CHANNEL_ID,
      importance: AndroidImportance.DEFAULT,
      sound: 'default',
    },
    ios: {
      sound: 'default',
    },
  });
};

/**
 * Schedule a failure notification (squats not completed)
 */
export const scheduleFailureNotification = async (
  title: string,
  body: string
): Promise<void> => {
  await notifee.displayNotification({
    title,
    body,
    data: { type: 'failure' },
    android: {
      channelId: ALARM_CHANNEL_ID,
      importance: AndroidImportance.DEFAULT,
      sound: 'default',
    },
    ios: {
      sound: 'default',
    },
  });
};

// Set up notification categories for iOS
export const setNotificationCategories = async (): Promise<void> => {
  await notifee.setNotificationCategories([
    {
      id: 'alarm',
      actions: [
        {
          id: 'snooze',
          title: 'Snooze 5min',
        },
        {
          id: 'dismiss',
          title: 'Dismiss',
          destructive: true,
        },
      ],
    },
  ]);
};
