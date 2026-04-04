import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
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
  try {
    // Request permission
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.warn('Notification permission not granted');
      return;
    }

    // Get token
    const token = await getFCMToken();
    if (!token) {
      console.warn('Failed to get FCM token');
      return;
    }

    // Save to Firestore
    await saveFCMTokenToFirestore(uid, token);

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
 */
export const setBackgroundMessageHandler = (): void => {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('Background message received:', remoteMessage);

    // Handle alarm notification
    if (remoteMessage.data?.type === 'alarm') {
      // The notification will be displayed automatically by FCM
      // We can trigger additional actions here if needed
      console.log('Alarm notification received in background');
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
