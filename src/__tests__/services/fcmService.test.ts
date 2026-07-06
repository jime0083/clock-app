const mockRequestPermission = jest.fn();
const mockGetToken = jest.fn();
const mockRegisterDeviceForRemoteMessages = jest.fn();
const mockOnTokenRefresh = jest.fn();
const mockOnMessage = jest.fn();
const mockGetInitialNotification = jest.fn();
const mockOnNotificationOpenedApp = jest.fn();
const mockHasPermission = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock('@react-native-firebase/messaging', () => {
  const instance = {
    requestPermission: (...args: unknown[]) => mockRequestPermission(...args),
    getToken: (...args: unknown[]) => mockGetToken(...args),
    registerDeviceForRemoteMessages: (...args: unknown[]) =>
      mockRegisterDeviceForRemoteMessages(...args),
    onTokenRefresh: (...args: unknown[]) => mockOnTokenRefresh(...args),
    onMessage: (...args: unknown[]) => mockOnMessage(...args),
    getInitialNotification: (...args: unknown[]) => mockGetInitialNotification(...args),
    onNotificationOpenedApp: (...args: unknown[]) => mockOnNotificationOpenedApp(...args),
    hasPermission: (...args: unknown[]) => mockHasPermission(...args),
  };
  const messagingFn: unknown = jest.fn(() => instance);
  (messagingFn as { AuthorizationStatus: unknown }).AuthorizationStatus = {
    AUTHORIZED: 1,
    PROVISIONAL: 2,
    DENIED: -1,
    NOT_DETERMINED: -2,
  };

  return { __esModule: true, default: messagingFn };
});

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({ id: 'mock-doc' })),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
}));

jest.mock('../../services/firebase', () => ({ db: {} }));

import {
  requestNotificationPermission,
  getFCMToken,
  saveFCMTokenToFirestore,
  initializeFCM,
  setForegroundMessageHandler,
  getInitialNotification,
  setNotificationOpenedHandler,
  checkNotificationPermission,
} from '../../services/fcmService';

describe('fcmService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  describe('requestNotificationPermission', () => {
    it('should return true when authorized', async () => {
      mockRequestPermission.mockResolvedValue(1); // AUTHORIZED

      expect(await requestNotificationPermission()).toBe(true);
    });

    it('should return true when provisional', async () => {
      mockRequestPermission.mockResolvedValue(2); // PROVISIONAL

      expect(await requestNotificationPermission()).toBe(true);
    });

    it('should return false when denied', async () => {
      mockRequestPermission.mockResolvedValue(-1); // DENIED

      expect(await requestNotificationPermission()).toBe(false);
    });

    it('should return false when the native call throws', async () => {
      mockRequestPermission.mockRejectedValue(new Error('native error'));

      expect(await requestNotificationPermission()).toBe(false);
    });
  });

  describe('getFCMToken', () => {
    it('should register for remote messages on iOS before getting the token', async () => {
      mockGetToken.mockResolvedValue('fcm-token-abc');

      const token = await getFCMToken();

      expect(mockRegisterDeviceForRemoteMessages).toHaveBeenCalled();
      expect(token).toBe('fcm-token-abc');
    });

    it('should return null when the native call throws', async () => {
      mockGetToken.mockRejectedValue(new Error('native error'));

      expect(await getFCMToken()).toBeNull();
    });
  });

  describe('saveFCMTokenToFirestore', () => {
    it('should write the token and timestamp to Firestore', async () => {
      await saveFCMTokenToFirestore('uid-1', 'token-abc');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ fcmToken: 'token-abc' })
      );
    });

    it('should rethrow when the Firestore write fails', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('firestore error'));

      await expect(saveFCMTokenToFirestore('uid-1', 'token-abc')).rejects.toThrow(
        'firestore error'
      );
    });
  });

  describe('initializeFCM', () => {
    it('should request permission, fetch the token, and save it', async () => {
      mockRequestPermission.mockResolvedValue(1);
      mockGetToken.mockResolvedValue('token-xyz');
      mockUpdateDoc.mockResolvedValue(undefined);

      await initializeFCM('uid-1');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ fcmToken: 'token-xyz' })
      );
      expect(mockOnTokenRefresh).toHaveBeenCalled();
    });

    it('should stop early when permission is not granted', async () => {
      mockRequestPermission.mockResolvedValue(-1);

      await initializeFCM('uid-1');

      expect(mockGetToken).not.toHaveBeenCalled();
    });

    it('should stop early when no token is returned', async () => {
      mockRequestPermission.mockResolvedValue(1);
      mockGetToken.mockResolvedValue(null);

      await initializeFCM('uid-1');

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should not throw when an unexpected error occurs', async () => {
      mockRequestPermission.mockRejectedValue(new Error('boom'));

      await expect(initializeFCM('uid-1')).resolves.toBeUndefined();
    });
  });

  describe('message handlers', () => {
    it('should wire up the foreground message handler', () => {
      const unsubscribe = jest.fn();
      mockOnMessage.mockReturnValue(unsubscribe);
      const onMessage = jest.fn();

      const result = setForegroundMessageHandler(onMessage);

      expect(mockOnMessage).toHaveBeenCalled();
      expect(result).toBe(unsubscribe);
    });

    it('should wire up the notification-opened handler', () => {
      const unsubscribe = jest.fn();
      mockOnNotificationOpenedApp.mockReturnValue(unsubscribe);
      const onOpened = jest.fn();

      const result = setNotificationOpenedHandler(onOpened);

      expect(mockOnNotificationOpenedApp).toHaveBeenCalled();
      expect(result).toBe(unsubscribe);
    });
  });

  describe('getInitialNotification', () => {
    it('should return the initial notification when present', async () => {
      mockGetInitialNotification.mockResolvedValue({ data: { type: 'alarm' } });

      const result = await getInitialNotification();

      expect(result).toEqual({ data: { type: 'alarm' } });
    });

    it('should return null when there is no initial notification', async () => {
      mockGetInitialNotification.mockResolvedValue(null);

      expect(await getInitialNotification()).toBeNull();
    });

    it('should return null when the native call throws', async () => {
      mockGetInitialNotification.mockRejectedValue(new Error('native error'));

      expect(await getInitialNotification()).toBeNull();
    });
  });

  describe('checkNotificationPermission', () => {
    it('should return true when authorized', async () => {
      mockHasPermission.mockResolvedValue(1);

      expect(await checkNotificationPermission()).toBe(true);
    });

    it('should return false when not authorized', async () => {
      mockHasPermission.mockResolvedValue(-1);

      expect(await checkNotificationPermission()).toBe(false);
    });

    it('should return false when the native call throws', async () => {
      mockHasPermission.mockRejectedValue(new Error('native error'));

      expect(await checkNotificationPermission()).toBe(false);
    });
  });
});
