import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { PurchasesPackage, PurchasesOffering } from 'react-native-purchases';
import { useAuth } from './AuthContext';
import {
  initializePurchases,
  setRevenueCatUserId,
  logoutRevenueCat,
  checkSubscriptionStatus,
  getOfferings,
  purchasePackage,
  restorePurchases,
} from '@/services/purchaseService';

interface SubscriptionContextType {
  isSubscribed: boolean;
  isLoading: boolean;
  offerings: PurchasesOffering | null;
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  refreshSubscriptionStatus: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize RevenueCat
  useEffect(() => {
    const initialize = async () => {
      try {
        await initializePurchases();
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize purchases:', error);
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  // Handle user authentication changes
  useEffect(() => {
    const handleAuthChange = async () => {
      if (!isInitialized) return;

      if (isAuthenticated && user?.uid) {
        try {
          await setRevenueCatUserId(user.uid);
          await refreshSubscriptionStatus();
          await loadOfferings();
        } catch (error) {
          console.error('Error setting up subscription:', error);
        }
      } else {
        await logoutRevenueCat();
        setIsSubscribed(false);
        setOfferings(null);
      }
      setIsLoading(false);
    };

    handleAuthChange();
  }, [isAuthenticated, user?.uid, isInitialized]);

  const refreshSubscriptionStatus = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const subscribed = await checkSubscriptionStatus(user.uid);
      setIsSubscribed(subscribed);
    } catch (error) {
      console.error('Error refreshing subscription status:', error);
    }
  }, [user?.uid]);

  const loadOfferings = useCallback(async () => {
    try {
      const currentOffering = await getOfferings();
      setOfferings(currentOffering);
    } catch (error) {
      console.error('Error loading offerings:', error);
    }
  }, []);

  const purchase = useCallback(
    async (pkg: PurchasesPackage): Promise<boolean> => {
      try {
        const result = await purchasePackage(pkg);
        if (result.success) {
          setIsSubscribed(true);
          return true;
        }
        return false;
      } catch (error) {
        console.error('Error purchasing:', error);
        return false;
      }
    },
    []
  );

  const restore = useCallback(async (): Promise<boolean> => {
    try {
      const result = await restorePurchases();
      if (result.success) {
        setIsSubscribed(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error restoring:', error);
      return false;
    }
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        isSubscribed,
        isLoading,
        offerings,
        purchase,
        restore,
        refreshSubscriptionStatus,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
