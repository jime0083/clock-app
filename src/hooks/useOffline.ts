import { useState, useEffect, useCallback } from 'react';
import {
  initializeOfflineService,
  addNetworkListener,
  checkIsOnline,
  syncPendingOperations,
  hasPendingOperations,
  getPendingOperations,
} from '@/services/offlineService';

interface UseOfflineReturn {
  isOnline: boolean;
  pendingCount: number;
  syncNow: () => Promise<{ synced: number; failed: number }>;
  checkConnection: () => Promise<boolean>;
}

export const useOffline = (): UseOfflineReturn => {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Initialize offline service
    const unsubscribe = initializeOfflineService();

    // Initial check
    const initialize = async () => {
      const online = await checkIsOnline();
      setIsOnline(online);

      const pending = await getPendingOperations();
      setPendingCount(pending.length);
    };

    initialize();

    // Listen for network changes
    const removeListener = addNetworkListener((online) => {
      setIsOnline(online);
    });

    return () => {
      unsubscribe();
      removeListener();
    };
  }, []);

  const syncNow = useCallback(async () => {
    const result = await syncPendingOperations();
    const pending = await getPendingOperations();
    setPendingCount(pending.length);
    return result;
  }, []);

  const checkConnection = useCallback(async () => {
    const online = await checkIsOnline();
    setIsOnline(online);
    return online;
  }, []);

  return {
    isOnline,
    pendingCount,
    syncNow,
    checkConnection,
  };
};
