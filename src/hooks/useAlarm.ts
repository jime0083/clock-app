import { useState, useEffect, useCallback } from 'react';
import { alarmService, AlarmConfig } from '@/services/alarmService';
import { checkNotificationPermissions } from '@/services/notificationService';
import { useAuth } from '@/contexts/AuthContext';

interface UseAlarmResult {
  isInitialized: boolean;
  hasPermission: boolean;
  isAlarmPlaying: boolean;
  initializeAlarm: () => Promise<boolean>;
  scheduleAlarm: (config: AlarmConfig) => Promise<boolean>;
  updateAlarm: (config: AlarmConfig) => Promise<boolean>;
  cancelAlarm: () => Promise<void>;
  stopAlarm: () => Promise<void>;
  snoozeAlarm: (minutes?: number) => Promise<void>;
  setOnAlarmTriggered: (callback: () => void) => void;
}

export const useAlarm = (): UseAlarmResult => {
  const { user } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);

  // Check permission status
  useEffect(() => {
    const checkPermission = async () => {
      const permitted = await checkNotificationPermissions();
      setHasPermission(permitted);
    };
    checkPermission();
  }, []);

  // Check alarm playing status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setIsAlarmPlaying(alarmService.isAlarmPlaying());
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Initialize alarm service
  const initializeAlarm = useCallback(async (): Promise<boolean> => {
    if (!user?.uid) {
      return false;
    }

    const success = await alarmService.initialize(user.uid);
    setIsInitialized(success);
    setHasPermission(success);
    return success;
  }, [user?.uid]);

  // Schedule alarm
  const scheduleAlarm = useCallback(async (config: AlarmConfig): Promise<boolean> => {
    return alarmService.scheduleAlarm(config);
  }, []);

  // Update alarm
  const updateAlarm = useCallback(async (config: AlarmConfig): Promise<boolean> => {
    return alarmService.updateAlarm(config);
  }, []);

  // Cancel alarm
  const cancelAlarm = useCallback(async (): Promise<void> => {
    await alarmService.cancelAlarm();
  }, []);

  // Stop alarm
  const stopAlarm = useCallback(async (): Promise<void> => {
    await alarmService.stopAlarm();
    setIsAlarmPlaying(false);
  }, []);

  // Snooze alarm
  const snoozeAlarm = useCallback(async (minutes = 5): Promise<void> => {
    await alarmService.snoozeAlarm(minutes);
    setIsAlarmPlaying(false);
  }, []);

  // Set alarm triggered callback
  const setOnAlarmTriggered = useCallback((callback: () => void): void => {
    alarmService.setOnAlarmTriggered(callback);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      alarmService.cleanup();
    };
  }, []);

  return {
    isInitialized,
    hasPermission,
    isAlarmPlaying,
    initializeAlarm,
    scheduleAlarm,
    updateAlarm,
    cancelAlarm,
    stopAlarm,
    snoozeAlarm,
    setOnAlarmTriggered,
  };
};
