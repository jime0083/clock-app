/**
 * Purchase Service Unit Tests
 *
 * Tests subscription status checking including admin bypass functionality.
 */

import { checkSubscriptionStatus } from '../../services/purchaseService';

// Mock RevenueCat
jest.mock('react-native-purchases', () => ({
  configure: jest.fn(),
  logIn: jest.fn(),
  logOut: jest.fn(),
  getCustomerInfo: jest.fn(),
  getOfferings: jest.fn(),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
}));

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

// Mock authService
jest.mock('../../services/authService', () => ({
  checkIsAdmin: jest.fn(),
}));

import Purchases from 'react-native-purchases';
import { checkIsAdmin } from '../../services/authService';

const mockedCheckIsAdmin = checkIsAdmin as jest.MockedFunction<typeof checkIsAdmin>;
const mockedGetCustomerInfo = Purchases.getCustomerInfo as jest.MockedFunction<
  typeof Purchases.getCustomerInfo
>;

describe('purchaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkSubscriptionStatus', () => {
    it('should return true for admin users without checking RevenueCat', async () => {
      // Setup: User is admin
      mockedCheckIsAdmin.mockResolvedValue(true);

      const result = await checkSubscriptionStatus('admin-uid');

      expect(result).toBe(true);
      expect(mockedCheckIsAdmin).toHaveBeenCalledWith('admin-uid');
      // RevenueCat should NOT be called for admin users
      expect(mockedGetCustomerInfo).not.toHaveBeenCalled();
    });

    it('should return true for subscribed non-admin users', async () => {
      // Setup: User is not admin but has active subscription
      mockedCheckIsAdmin.mockResolvedValue(false);
      mockedGetCustomerInfo.mockResolvedValue({
        entitlements: {
          active: {
            pro: {
              identifier: 'pro',
              isActive: true,
              willRenew: true,
              periodType: 'NORMAL',
              latestPurchaseDate: '2024-01-01',
              originalPurchaseDate: '2024-01-01',
              expirationDate: '2024-02-01',
              productIdentifier: 'com.okiroya.app.monthly',
              isSandbox: false,
              ownershipType: 'PURCHASED',
            },
          },
          all: {},
        },
        originalAppUserId: 'user-uid',
        managementURL: null,
        originalPurchaseDate: null,
        firstSeen: '2024-01-01',
        requestDate: '2024-01-15',
        allPurchaseDates: {},
        allExpirationDates: {},
        activeSubscriptions: ['com.okiroya.app.monthly'],
        allPurchasedProductIdentifiers: ['com.okiroya.app.monthly'],
        nonSubscriptionTransactions: [],
        latestExpirationDate: '2024-02-01',
      } as any);

      const result = await checkSubscriptionStatus('user-uid');

      expect(result).toBe(true);
      expect(mockedCheckIsAdmin).toHaveBeenCalledWith('user-uid');
      expect(mockedGetCustomerInfo).toHaveBeenCalled();
    });

    it('should return false for non-admin users without subscription', async () => {
      // Setup: User is not admin and has no subscription
      mockedCheckIsAdmin.mockResolvedValue(false);
      mockedGetCustomerInfo.mockResolvedValue({
        entitlements: {
          active: {},
          all: {},
        },
        originalAppUserId: 'user-uid',
        managementURL: null,
        originalPurchaseDate: null,
        firstSeen: '2024-01-01',
        requestDate: '2024-01-15',
        allPurchaseDates: {},
        allExpirationDates: {},
        activeSubscriptions: [],
        allPurchasedProductIdentifiers: [],
        nonSubscriptionTransactions: [],
        latestExpirationDate: null,
      } as any);

      const result = await checkSubscriptionStatus('user-uid');

      expect(result).toBe(false);
    });

    it('should return false for users with expired subscription', async () => {
      // Setup: User has expired subscription (not in active entitlements)
      mockedCheckIsAdmin.mockResolvedValue(false);
      mockedGetCustomerInfo.mockResolvedValue({
        entitlements: {
          active: {},
          all: {
            pro: {
              identifier: 'pro',
              isActive: false,
              expirationDate: '2023-12-01', // Expired
            },
          },
        },
        originalAppUserId: 'user-uid',
        activeSubscriptions: [],
      } as any);

      const result = await checkSubscriptionStatus('user-uid');

      expect(result).toBe(false);
    });

    it('should return false when RevenueCat throws error', async () => {
      // Setup: RevenueCat throws error
      mockedCheckIsAdmin.mockResolvedValue(false);
      mockedGetCustomerInfo.mockRejectedValue(new Error('Network error'));

      const result = await checkSubscriptionStatus('user-uid');

      expect(result).toBe(false);
    });

    it('should return true if admin check passes even when RevenueCat would fail', async () => {
      // This ensures admin bypass works correctly
      mockedCheckIsAdmin.mockResolvedValue(true);

      const result = await checkSubscriptionStatus('admin-uid');

      expect(result).toBe(true);
      // RevenueCat should never be called
      expect(mockedGetCustomerInfo).not.toHaveBeenCalled();
    });

    it('should return false when admin check throws error', async () => {
      // Setup: Admin check fails
      mockedCheckIsAdmin.mockRejectedValue(new Error('Firestore error'));
      mockedGetCustomerInfo.mockResolvedValue({
        entitlements: {
          active: {},
          all: {},
        },
      } as any);

      const result = await checkSubscriptionStatus('user-uid');

      // Should still check RevenueCat and return false since entitlements empty
      expect(result).toBe(false);
    });
  });
});
