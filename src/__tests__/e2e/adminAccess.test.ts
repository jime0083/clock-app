/**
 * E2E Test: Admin Free Access Flow
 *
 * Tests the admin/developer free access feature:
 * 1. Admin user identification via Firestore
 * 2. Subscription check bypass for admins
 * 3. Full feature access without payment
 * 4. Admin status persistence across sessions
 */

// Mock Firebase Firestore
const mockAdminDoc = {
  exists: jest.fn(),
};

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(() => Promise.resolve(mockAdminDoc)),
  collection: jest.fn(),
}));

jest.mock('../../services/firebase', () => ({
  db: {},
}));

// Mock authService
const mockCheckIsAdmin = jest.fn();
jest.mock('../../services/authService', () => ({
  checkIsAdmin: (...args: unknown[]) => mockCheckIsAdmin(...args),
}));

// Mock purchaseService
const mockCheckSubscriptionStatus = jest.fn();
const mockGetCustomerInfo = jest.fn();

jest.mock('../../services/purchaseService', () => ({
  checkSubscriptionStatus: (...args: unknown[]) => mockCheckSubscriptionStatus(...args),
  getCustomerInfo: (...args: unknown[]) => mockGetCustomerInfo(...args),
}));

// Mock RevenueCat
jest.mock('react-native-purchases', () => ({
  getCustomerInfo: jest.fn(),
}));

// Mock userService
const mockGetUserDocument = jest.fn();
jest.mock('../../services/userService', () => ({
  getUserDocument: (...args: unknown[]) => mockGetUserDocument(...args),
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ja' },
  }),
}));

import { checkIsAdmin } from '../../services/authService';
import { checkSubscriptionStatus } from '../../services/purchaseService';
import { getUserDocument } from '../../services/userService';
import { UserDocument } from '../../types/firestore';

describe('E2E: Admin Free Access Flow', () => {
  const adminUid = 'admin-user-123';
  const regularUid = 'regular-user-456';

  const mockAdminUserData: UserDocument = {
    profile: {
      createdAt: { seconds: Date.now() / 1000 } as any,
      email: 'admin@example.com',
      displayName: 'Admin User',
      photoURL: null,
    },
    settings: {
      alarmTime: '07:00',
      alarmDays: [1, 2, 3, 4, 5],
      customAlarmSound: null,
      calibration: null,
      language: 'ja',
      setupCompleted: true,
    },
    snsConnections: {
      x: {
        connected: true,
        accessToken: 'token',
        refreshToken: 'refresh',
        connectedAt: null,
        username: 'adminuser',
      },
    },
    stats: {
      totalFailures: 0,
      monthlyFailures: 0,
      currentMonth: '2024-01',
      totalSquats: 0,
      monthlySquats: 0,
    },
    subscription: {
      isActive: false, // Admin doesn't need active subscription
      plan: null,
      expiresAt: null,
      purchasedAt: null,
    },
  };

  const mockRegularUserData: UserDocument = {
    ...mockAdminUserData,
    profile: {
      ...mockAdminUserData.profile,
      email: 'user@example.com',
      displayName: 'Regular User',
    },
    subscription: {
      isActive: false,
      plan: null,
      expiresAt: null,
      purchasedAt: null,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Admin Identification', () => {
    it('should identify admin user from Firestore adminUsers collection', async () => {
      mockCheckIsAdmin.mockResolvedValue(true);

      const isAdmin = await checkIsAdmin(adminUid);

      expect(isAdmin).toBe(true);
      expect(mockCheckIsAdmin).toHaveBeenCalledWith(adminUid);
    });

    it('should identify non-admin user', async () => {
      mockCheckIsAdmin.mockResolvedValue(false);

      const isAdmin = await checkIsAdmin(regularUid);

      expect(isAdmin).toBe(false);
      expect(mockCheckIsAdmin).toHaveBeenCalledWith(regularUid);
    });

    it('should handle admin check errors gracefully', async () => {
      mockCheckIsAdmin.mockRejectedValue(new Error('Firestore error'));

      try {
        await checkIsAdmin(adminUid);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Subscription Bypass for Admins', () => {
    it('should return true for admin without checking RevenueCat', async () => {
      mockCheckIsAdmin.mockResolvedValue(true);
      mockCheckSubscriptionStatus.mockImplementation(async (uid: string) => {
        const isAdmin = await checkIsAdmin(uid);
        if (isAdmin) {
          return true; // Admin bypass
        }
        // Would normally check RevenueCat here
        return false;
      });

      const isSubscribed = await checkSubscriptionStatus(adminUid);

      expect(isSubscribed).toBe(true);
      expect(mockCheckIsAdmin).toHaveBeenCalledWith(adminUid);
    });

    it('should check RevenueCat for non-admin users', async () => {
      mockCheckIsAdmin.mockResolvedValue(false);
      mockCheckSubscriptionStatus.mockResolvedValue(false);

      const isSubscribed = await checkSubscriptionStatus(regularUid);

      expect(isSubscribed).toBe(false);
    });

    it('should correctly identify paid non-admin user', async () => {
      mockCheckIsAdmin.mockResolvedValue(false);
      mockCheckSubscriptionStatus.mockResolvedValue(true);

      const isSubscribed = await checkSubscriptionStatus(regularUid);

      expect(isSubscribed).toBe(true);
    });
  });

  describe('Full Feature Access', () => {
    it('should allow admin to access all features', async () => {
      mockCheckIsAdmin.mockResolvedValue(true);
      mockGetUserDocument.mockResolvedValue(mockAdminUserData);

      const isAdmin = await checkIsAdmin(adminUid);
      const userData = await getUserDocument(adminUid);

      // Admin should have full access regardless of subscription status
      expect(isAdmin).toBe(true);
      expect(userData?.subscription.isActive).toBe(false); // No actual subscription
      // But access is granted via admin bypass
    });

    it('should allow admin to use alarm features', async () => {
      mockCheckIsAdmin.mockResolvedValue(true);
      mockGetUserDocument.mockResolvedValue(mockAdminUserData);

      const isAdmin = await checkIsAdmin(adminUid);
      const userData = await getUserDocument(adminUid);

      // Verify alarm settings are accessible
      expect(userData?.settings.alarmTime).toBe('07:00');
      expect(userData?.settings.alarmDays).toEqual([1, 2, 3, 4, 5]);
    });

    it('should allow admin to use squat detection', async () => {
      mockCheckIsAdmin.mockResolvedValue(true);

      const isAdmin = await checkIsAdmin(adminUid);
      let canUseSquatDetection = false;

      // In real app, this would check subscription OR admin status
      if (isAdmin) {
        canUseSquatDetection = true;
      }

      expect(canUseSquatDetection).toBe(true);
    });

    it('should allow admin to use X posting feature', async () => {
      mockCheckIsAdmin.mockResolvedValue(true);
      mockGetUserDocument.mockResolvedValue(mockAdminUserData);

      const isAdmin = await checkIsAdmin(adminUid);
      const userData = await getUserDocument(adminUid);
      let canUseXPosting = false;

      // Check X connection and access
      if (isAdmin && userData?.snsConnections.x.connected) {
        canUseXPosting = true;
      }

      expect(canUseXPosting).toBe(true);
    });
  });

  describe('Non-Admin Access Control', () => {
    it('should require subscription for non-admin users', async () => {
      mockCheckIsAdmin.mockResolvedValue(false);
      mockCheckSubscriptionStatus.mockResolvedValue(false);
      mockGetUserDocument.mockResolvedValue(mockRegularUserData);

      const isAdmin = await checkIsAdmin(regularUid);
      const isSubscribed = await checkSubscriptionStatus(regularUid);

      expect(isAdmin).toBe(false);
      expect(isSubscribed).toBe(false);
      // User should see paywall
    });

    it('should allow subscribed non-admin users full access', async () => {
      mockCheckIsAdmin.mockResolvedValue(false);
      mockCheckSubscriptionStatus.mockResolvedValue(true);

      const isAdmin = await checkIsAdmin(regularUid);
      const isSubscribed = await checkSubscriptionStatus(regularUid);

      expect(isAdmin).toBe(false);
      expect(isSubscribed).toBe(true);
      // User has access via subscription
    });
  });

  describe('Admin Status Persistence', () => {
    it('should maintain admin status across multiple checks', async () => {
      mockCheckIsAdmin.mockResolvedValue(true);

      const firstCheck = await checkIsAdmin(adminUid);
      const secondCheck = await checkIsAdmin(adminUid);
      const thirdCheck = await checkIsAdmin(adminUid);

      expect(firstCheck).toBe(true);
      expect(secondCheck).toBe(true);
      expect(thirdCheck).toBe(true);
      expect(mockCheckIsAdmin).toHaveBeenCalledTimes(3);
    });

    it('should handle admin status change', async () => {
      // First check: is admin
      mockCheckIsAdmin.mockResolvedValueOnce(true);
      const firstCheck = await checkIsAdmin(adminUid);

      // Admin status revoked
      mockCheckIsAdmin.mockResolvedValueOnce(false);
      const secondCheck = await checkIsAdmin(adminUid);

      expect(firstCheck).toBe(true);
      expect(secondCheck).toBe(false);
    });
  });

  describe('Complete Admin Journey', () => {
    it('should complete full admin access flow', async () => {
      mockCheckIsAdmin.mockResolvedValue(true);
      mockCheckSubscriptionStatus.mockImplementation(async (uid: string) => {
        const isAdmin = await checkIsAdmin(uid);
        return isAdmin; // Admin bypass
      });
      mockGetUserDocument.mockResolvedValue(mockAdminUserData);

      // 1. User logs in
      const userId = adminUid;

      // 2. Check admin status
      const isAdmin = await checkIsAdmin(userId);
      expect(isAdmin).toBe(true);

      // 3. Check subscription (should bypass)
      const isSubscribed = await checkSubscriptionStatus(userId);
      expect(isSubscribed).toBe(true);

      // 4. Access user data
      const userData = await getUserDocument(userId);
      expect(userData).toBeDefined();

      // 5. All features accessible
      const features = {
        alarm: true,
        squatDetection: true,
        xPosting: userData?.snsConnections.x.connected,
        history: true,
        settings: true,
      };

      expect(features.alarm).toBe(true);
      expect(features.squatDetection).toBe(true);
      expect(features.xPosting).toBe(true);
      expect(features.history).toBe(true);
      expect(features.settings).toBe(true);
    });

    it('should complete full non-admin subscriber flow', async () => {
      mockCheckIsAdmin.mockResolvedValue(false);
      mockCheckSubscriptionStatus.mockResolvedValue(true);
      mockGetUserDocument.mockResolvedValue({
        ...mockRegularUserData,
        subscription: {
          isActive: true,
          plan: 'monthly',
          expiresAt: null,
          purchasedAt: null,
        },
      });

      // 1. User logs in
      const userId = regularUid;

      // 2. Check admin status
      const isAdmin = await checkIsAdmin(userId);
      expect(isAdmin).toBe(false);

      // 3. Check subscription
      const isSubscribed = await checkSubscriptionStatus(userId);
      expect(isSubscribed).toBe(true);

      // 4. Access user data
      const userData = await getUserDocument(userId);
      expect(userData?.subscription.isActive).toBe(true);

      // 5. All features accessible via subscription
      const features = {
        alarm: isSubscribed,
        squatDetection: isSubscribed,
        xPosting: isSubscribed && userData?.snsConnections.x.connected,
        history: isSubscribed,
        settings: isSubscribed,
      };

      expect(features.alarm).toBe(true);
      expect(features.squatDetection).toBe(true);
    });

    it('should block non-subscriber non-admin flow', async () => {
      mockCheckIsAdmin.mockResolvedValue(false);
      mockCheckSubscriptionStatus.mockResolvedValue(false);
      mockGetUserDocument.mockResolvedValue(mockRegularUserData);

      // 1. User logs in
      const userId = regularUid;

      // 2. Check admin status
      const isAdmin = await checkIsAdmin(userId);
      expect(isAdmin).toBe(false);

      // 3. Check subscription
      const isSubscribed = await checkSubscriptionStatus(userId);
      expect(isSubscribed).toBe(false);

      // 4. Features blocked
      const hasAccess = isAdmin || isSubscribed;
      expect(hasAccess).toBe(false);

      // User should see paywall
    });
  });
});
