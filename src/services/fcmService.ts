import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Request permission for push notifications
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('Notification permission granted:', authStatus);
    } else {
      console.log('Notification permission denied');
    }

    return enabled;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

/**
 * Get FCM token
 */
export const getFCMToken = async (): Promise<string | null> => {
  try {
    // Register for remote messages (required for iOS)
    if (Platform.OS === 'ios') {
      await messaging().registerDeviceForRemoteMessages();
    }

    const token = await messaging().getToken();
    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

/**
 * Save FCM token to Firestore user document
 */
export const saveFCMTokenToFirestore = async (
  uid: string,
  token: string
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      fcmToken: token,
      fcmTokenUpdatedAt: new Date().toISOString(),
    });
    console.log('FCM token saved to Firestore');
  } catch (error) {
    console.error('Error saving FCM token to Firestore:', error);
    throw error;
  }
};

/**
 * Initialize FCM and save token
 */
export const initializeFCM = async (uid: string): Promise<void> => {
  console.log('[FCM] Starting FCM initialization for user:', uid);

  try {
    // Request permission
    console.log('[FCM] Requesting notification permission...');
    const hasPermission = await requestNotificationPermission();
    console.log('[FCM] Permission result:', hasPermission);

    if (!hasPermission) {
      console.warn('[FCM] Notification permission not granted');
      return;
    }

    // Get token
    console.log('[FCM] Getting FCM token...');
    const token = await getFCMToken();
    console.log('[FCM] Token result:', token ? `${token.substring(0, 20)}...` : 'null');

    if (!token) {
      console.warn('[FCM] Failed to get FCM token');
      return;
    }

    // Save to Firestore
    console.log('[FCM] Saving token to Firestore...');
    await saveFCMTokenToFirestore(uid, token);
    console.log('[FCM] Token saved successfully');

    // Listen for token refresh
    messaging().onTokenRefresh(async (newToken) => {
      console.log('FCM Token refreshed:', newToken);
      await saveFCMTokenToFirestore(uid, newToken);
    });
  } catch (error) {
    console.error('Error initializing FCM:', error);
  }
};

/**
 * Set up foreground message handler
 */
export const setForegroundMessageHandler = (
  onMessage: (message: FirebaseMessagingTypes.RemoteMessage) => void
): (() => void) => {
  return messaging().onMessage(async (remoteMessage) => {
    console.log('Foreground message received:', remoteMessage);
    onMessage(remoteMessage);
  });
};

/**
 * Set up background message handler
 * NOTE: This must be called outside of React component lifecycle (e.g., in index.ts)
 *
 * For iOS: The notification display and sound are handled by iOS itself
 * based on the APNs payload. This handler is for data processing only.
 */
export const setBackgroundMessageHandler = (): void => {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('Background message received:', remoteMessage);

    // Handle alarm notification - just log, let iOS handle display and sound
    if (remoteMessage.data?.type === 'alarm') {
      console.log('Alarm notification received in background');
      // iOS handles the notification display and sound via APNs payload
      // We don't need to do anything here for the notification itself
    }
  });
};

/**
 * Get initial notification (when app is opened from notification)
 */
export const getInitialNotification =
  async (): Promise<FirebaseMessagingTypes.RemoteMessage | null> => {
    try {
      const remoteMessage = await messaging().getInitialNotification();
      if (remoteMessage) {
        console.log('App opened from notification:', remoteMessage);
      }
      return remoteMessage;
    } catch (error) {
      console.error('Error getting initial notification:', error);
      return null;
    }
  };

/**
 * Set up notification opened handler (when app is in background and notification is tapped)
 */
export const setNotificationOpenedHandler = (
  onNotificationOpened: (message: FirebaseMessagingTypes.RemoteMessage) => void
): (() => void) => {
  return messaging().onNotificationOpenedApp((remoteMessage) => {
    console.log('Notification opened:', remoteMessage);
    onNotificationOpened(remoteMessage);
  });
};

/**
 * Check if notification permission is granted
 */
export const checkNotificationPermission = async (): Promise<boolean> => {
  try {
    const authStatus = await messaging().hasPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  } catch (error) {
    console.error('Error checking notification permission:', error);
    return false;
  }
};
