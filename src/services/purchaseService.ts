import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  PurchasesOffering,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import { checkIsAdmin } from './authService';

// RevenueCat API Keys
const REVENUECAT_API_KEY_IOS = 'appl_xxxxxxxxxxxxxxxxxxxxxxxx'; // TODO: RevenueCatダッシュボードから取得したキーに置き換え
const REVENUECAT_API_KEY_ANDROID = 'goog_xxxxxxxxxxxxxxxxxxxxxxxx'; // Android用（将来対応）

// Entitlement ID (RevenueCatで設定したもの)
const ENTITLEMENT_ID = 'pro';

// Product IDs
export const PRODUCT_IDS = {
  MONTHLY: 'com.okiroya.app.monthly',
  YEARLY: 'com.okiroya.app.yearly',
} as const;

// Initialize RevenueCat
export const initializePurchases = async (userId?: string): Promise<void> => {
  try {
    const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

    Purchases.configure({
      apiKey,
      appUserID: userId,
    });
  } catch (error) {
    console.error('Error initializing RevenueCat:', error);
    throw error;
  }
};

// Set user ID after login
export const setRevenueCatUserId = async (userId: string): Promise<void> => {
  try {
    await Purchases.logIn(userId);
  } catch (error) {
    console.error('Error setting RevenueCat user ID:', error);
    throw error;
  }
};

// Logout from RevenueCat
export const logoutRevenueCat = async (): Promise<void> => {
  try {
    await Purchases.logOut();
  } catch (error) {
    console.error('Error logging out from RevenueCat:', error);
  }
};

// Check if user has active subscription
export const checkSubscriptionStatus = async (uid: string): Promise<boolean> => {
  try {
    // Check if user is admin (free access)
    const isAdmin = await checkIsAdmin(uid);
    if (isAdmin) {
      return true;
    }

    // Check RevenueCat subscription
    const customerInfo = await Purchases.getCustomerInfo();
    const isSubscribed = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;

    return isSubscribed;
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return false;
  }
};

// Get customer info
export const getCustomerInfo = async (): Promise<CustomerInfo> => {
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    console.error('Error getting customer info:', error);
    throw error;
  }
};

// Get available offerings
export const getOfferings = async (): Promise<PurchasesOffering | null> => {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (error) {
    console.error('Error getting offerings:', error);
    return null;
  }
};

// Purchase a package
export const purchasePackage = async (
  packageToPurchase: PurchasesPackage
): Promise<{ success: boolean; customerInfo?: CustomerInfo; error?: string }> => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    const isSubscribed = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;

    return {
      success: isSubscribed,
      customerInfo,
    };
  } catch (error: any) {
    // User cancelled
    if (error.userCancelled) {
      return { success: false, error: 'cancelled' };
    }

    console.error('Error purchasing package:', error);
    return { success: false, error: error.message };
  }
};

// Restore purchases
export const restorePurchases = async (): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}> => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    const isSubscribed = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;

    return {
      success: isSubscribed,
      customerInfo,
    };
  } catch (error: any) {
    console.error('Error restoring purchases:', error);
    return { success: false, error: error.message };
  }
};

// Get subscription expiration date
export const getSubscriptionExpirationDate = async (): Promise<Date | null> => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];

    if (entitlement && entitlement.expirationDate) {
      return new Date(entitlement.expirationDate);
    }

    return null;
  } catch (error) {
    console.error('Error getting expiration date:', error);
    return null;
  }
};
