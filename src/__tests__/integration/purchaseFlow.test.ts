/**
 * Purchase Flow Integration Tests
 *
 * Tests the complete purchase flow including:
 * - RevenueCat initialization
 * - Subscription status checking
 * - Purchase flow
 * - Restore purchases
 * - Admin bypass
 */

// Mock RevenueCat
const mockConfigure = jest.fn();
const mockLogIn = jest.fn();
const mockLogOut = jest.fn();
const mockGetCustomerInfo = jest.fn();
const mockGetOfferings = jest.fn();
const mockPurchasePackage = jest.fn();
const mockRestorePurchases = jest.fn();

jest.mock('react-native-purchases', () => ({
  configure: (...args: unknown[]) => mockConfigure(...args),
  logIn: (...args: unknown[]) => mockLogIn(...args),
  logOut: (...args: unknown[]) => mockLogOut(...args),
  getCustomerInfo: (...args: unknown[]) => mockGetCustomerInfo(...args),
  getOfferings: (...args: unknown[]) => mockGetOfferings(...args),
  purchasePackage: (...args: unknown[]) => mockPurchasePackage(...args),
  restorePurchases: (...args: unknown[]) => mockRestorePurchases(...args),
}));

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

// Mock authService
const mockCheckIsAdmin = jest.fn();

jest.mock('../../services/authService', () => ({
  checkIsAdmin: (...args: unknown[]) => mockCheckIsAdmin(...args),
}));

import {
  initializePurchases,
  setRevenueCatUserId,
  logoutRevenueCat,
  checkSubscriptionStatus,
  getCustomerInfo,
  getOfferings,
  purchasePackage,
  restorePurchases,
  getSubscriptionExpirationDate,
  PRODUCT_IDS,
} from '../../services/purchaseService';

describe('Purchase Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('RevenueCat Initialization', () => {
    it('should initialize with iOS API key', async () => {
      await initializePurchases();

      expect(mockConfigure).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: expect.stringContaining('appl_'),
        })
      );
    });

    it('should initialize with user ID', async () => {
      await initializePurchases('user-123');

      expect(mockConfigure).toHaveBeenCalledWith(
        expect.objectContaining({
          appUserID: 'user-123',
        })
      );
    });
  });

  describe('User Management', () => {
    it('should set user ID after login', async () => {
      mockLogIn.mockResolvedValue({ customerInfo: {} });

      await setRevenueCatUserId('user-123');

      expect(mockLogIn).toHaveBeenCalledWith('user-123');
    });

    it('should log out from RevenueCat', async () => {
      mockLogOut.mockResolvedValue(undefined);

      await logoutRevenueCat();

      expect(mockLogOut).toHaveBeenCalled();
    });
  });

  describe('Subscription Status Check', () => {
    it('should return true for admin users without checking RevenueCat', async () => {
      mockCheckIsAdmin.mockResolvedValue(true);

      const isSubscribed = await checkSubscriptionStatus('admin-uid');

      expect(isSubscribed).toBe(true);
      expect(mockCheckIsAdmin).toHaveBeenCalledWith('admin-uid');
      expect(mockGetCustomerInfo).not.toHaveBeenCalled();
    });

    it('should return true for users with active subscription', async () => {
      mockCheckIsAdmin.mockResolvedValue(false);
      mockGetCustomerInfo.mockResolvedValue({
        entitlements: {
          active: {
            pro: {
              identifier: 'pro',
              isActive: true,
            },
          },
        },
      });

      const isSubscribed = await checkSubscriptionStatus('user-123');

      expect(isSubscribed).toBe(true);
    });

    it('should return false for users without subscription', async () => {
      mockCheckIsAdmin.mockResolvedValue(false);
      mockGetCustomerInfo.mockResolvedValue({
        entitlements: {
          active: {},
        },
      });

      const isSubscribed = await checkSubscriptionStatus('user-123');

      expect(isSubscribed).toBe(false);
    });

    it('should return false when RevenueCat fails', async () => {
      mockCheckIsAdmin.mockResolvedValue(false);
      mockGetCustomerInfo.mockRejectedValue(new Error('Network error'));

      const isSubscribed = await checkSubscriptionStatus('user-123');

      expect(isSubscribed).toBe(false);
    });
  });

  describe('Get Customer Info', () => {
    it('should return customer info', async () => {
      const mockCustomerInfo = {
        entitlements: { active: { pro: { identifier: 'pro' } } },
        originalAppUserId: 'user-123',
      };
      mockGetCustomerInfo.mockResolvedValue(mockCustomerInfo);

      const info = await getCustomerInfo();

      expect(info).toEqual(mockCustomerInfo);
    });

    it('should throw error when failed', async () => {
      mockGetCustomerInfo.mockRejectedValue(new Error('Failed'));

      await expect(getCustomerInfo()).rejects.toThrow('Failed');
    });
  });

  describe('Get Offerings', () => {
    it('should return current offering', async () => {
      const mockOffering = {
        identifier: 'default',
        availablePackages: [
          {
            identifier: 'monthly',
            product: {
              identifier: PRODUCT_IDS.MONTHLY,
              price: 200,
            },
          },
          {
            identifier: 'yearly',
            product: {
              identifier: PRODUCT_IDS.YEARLY,
              price: 2000,
            },
          },
        ],
      };
      mockGetOfferings.mockResolvedValue({
        current: mockOffering,
      });

      const offering = await getOfferings();

      expect(offering).toEqual(mockOffering);
    });

    it('should return null when no offerings', async () => {
      mockGetOfferings.mockResolvedValue({
        current: null,
      });

      const offering = await getOfferings();

      expect(offering).toBeNull();
    });

    it('should return null when failed', async () => {
      mockGetOfferings.mockRejectedValue(new Error('Failed'));

      const offering = await getOfferings();

      expect(offering).toBeNull();
    });
  });

  describe('Purchase Package', () => {
    const mockPackage = {
      identifier: 'monthly',
      product: {
        identifier: PRODUCT_IDS.MONTHLY,
      },
    };

    it('should complete purchase successfully', async () => {
      mockPurchasePackage.mockResolvedValue({
        customerInfo: {
          entitlements: {
            active: {
              pro: { identifier: 'pro' },
            },
          },
        },
      });

      const result = await purchasePackage(mockPackage as any);

      expect(result.success).toBe(true);
      expect(result.customerInfo).toBeDefined();
    });

    it('should handle user cancellation', async () => {
      mockPurchasePackage.mockRejectedValue({
        userCancelled: true,
      });

      const result = await purchasePackage(mockPackage as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe('cancelled');
    });

    it('should handle purchase error', async () => {
      mockPurchasePackage.mockRejectedValue({
        message: 'Payment failed',
      });

      const result = await purchasePackage(mockPackage as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment failed');
    });

    it('should return false when entitlement not granted', async () => {
      mockPurchasePackage.mockResolvedValue({
        customerInfo: {
          entitlements: {
            active: {},
          },
        },
      });

      const result = await purchasePackage(mockPackage as any);

      expect(result.success).toBe(false);
    });
  });

  describe('Restore Purchases', () => {
    it('should restore successfully with active subscription', async () => {
      mockRestorePurchases.mockResolvedValue({
        entitlements: {
          active: {
            pro: { identifier: 'pro' },
          },
        },
      });

      const result = await restorePurchases();

      expect(result.success).toBe(true);
      expect(result.customerInfo).toBeDefined();
    });

    it('should return false when no subscription to restore', async () => {
      mockRestorePurchases.mockResolvedValue({
        entitlements: {
          active: {},
        },
      });

      const result = await restorePurchases();

      expect(result.success).toBe(false);
    });

    it('should handle restore error', async () => {
      mockRestorePurchases.mockRejectedValue({
        message: 'Restore failed',
      });

      const result = await restorePurchases();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Restore failed');
    });
  });

  describe('Subscription Expiration Date', () => {
    it('should return expiration date when subscribed', async () => {
      const expirationDate = '2024-02-15T00:00:00.000Z';
      mockGetCustomerInfo.mockResolvedValue({
        entitlements: {
          active: {
            pro: {
              identifier: 'pro',
              expirationDate,
            },
          },
        },
      });

      const result = await getSubscriptionExpirationDate();

      expect(result).toEqual(new Date(expirationDate));
    });

    it('should return null when no active subscription', async () => {
      mockGetCustomerInfo.mockResolvedValue({
        entitlements: {
          active: {},
        },
      });

      const result = await getSubscriptionExpirationDate();

      expect(result).toBeNull();
    });

    it('should return null when no expiration date', async () => {
      mockGetCustomerInfo.mockResolvedValue({
        entitlements: {
          active: {
            pro: {
              identifier: 'pro',
              expirationDate: null,
            },
          },
        },
      });

      const result = await getSubscriptionExpirationDate();

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockGetCustomerInfo.mockRejectedValue(new Error('Failed'));

      const result = await getSubscriptionExpirationDate();

      expect(result).toBeNull();
    });
  });

  describe('Product IDs', () => {
    it('should have correct product IDs', () => {
      expect(PRODUCT_IDS.MONTHLY).toBe('com.okiroya.app.monthly');
      expect(PRODUCT_IDS.YEARLY).toBe('com.okiroya.app.yearly');
    });
  });
});
