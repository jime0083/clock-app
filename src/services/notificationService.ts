import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

// Notification channel ID for Android
const ALARM_CHANNEL_ID = 'alarm-channel';

/**
 * Request notification permissions
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  if (!Device.isDevice) {
    console.warn('Notifications only work on physical devices');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  // Set up Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
      name: 'Alarm',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B35',
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
  }

  return true;
};

/**
 * Check if notifications are enabled
 */
export const checkNotificationPermissions = async (): Promise<boolean> => {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
};

/**
 * Schedule an alarm notification
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
    // Create trigger for each day
    const trigger: Notifications.WeeklyTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: day + 1, // expo-notifications uses 1-7 (1 = Sunday)
      hour: hours,
      minute: minutes,
    };

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        categoryIdentifier: 'alarm',
        data: {
          type: 'alarm',
          alarmTime,
          day,
        },
      },
      trigger,
    });

    notificationIds.push(notificationId);
  }

  return notificationIds;
};

/**
 * Schedule a one-time alarm notification (for testing)
 */
export const scheduleOneTimeAlarm = async (
  secondsFromNow: number,
  title: string,
  body: string
): Promise<string> => {
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      categoryIdentifier: 'alarm',
      data: {
        type: 'alarm',
        isTest: true,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsFromNow,
    },
  });

  return notificationId;
};

/**
 * Cancel all scheduled alarm notifications
 */
export const cancelAllAlarmNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};

/**
 * Cancel a specific notification by ID
 */
export const cancelNotification = async (notificationId: string): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
};

/**
 * Get all scheduled notifications
 */
export const getScheduledNotifications = async (): Promise<
  Notifications.NotificationRequest[]
> => {
  return Notifications.getAllScheduledNotificationsAsync();
};

/**
 * Add a listener for notification received while app is in foreground
 */
export const addNotificationReceivedListener = (
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription => {
  return Notifications.addNotificationReceivedListener(callback);
};

/**
 * Add a listener for notification response (user tapped notification)
 */
export const addNotificationResponseListener = (
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription => {
  return Notifications.addNotificationResponseReceivedListener(callback);
};

/**
 * Get the last notification response (for when app is launched from notification)
 */
export const getLastNotificationResponse =
  async (): Promise<Notifications.NotificationResponse | null> => {
    return Notifications.getLastNotificationResponseAsync();
  };

/**
 * Set notification categories (for action buttons)
 */
export const setNotificationCategories = async (): Promise<void> => {
  await Notifications.setNotificationCategoryAsync('alarm', [
    {
      identifier: 'snooze',
      buttonTitle: 'Snooze 5min',
      options: {
        opensAppToForeground: false,
      },
    },
    {
      identifier: 'dismiss',
      buttonTitle: 'Dismiss',
      options: {
        opensAppToForeground: true,
      },
    },
  ]);
};

/**
 * Dismiss all displayed notifications
 */
export const dismissAllNotifications = async (): Promise<void> => {
  await Notifications.dismissAllNotificationsAsync();
};

/**
 * Get the push token for remote notifications (if needed later)
 */
export const getExpoPushToken = async (): Promise<string | null> => {
  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-project-id', // TODO: Replace with actual project ID
    });
    return token.data;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
};
